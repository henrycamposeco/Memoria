import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import path from 'path';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { SQLiteStorage } from '../core/SQLiteStorage.js';
import { EmbeddingManager } from '../core/EmbeddingManager.js';
import { HybridSearch } from '../retrieval/HybridSearch.js';
import { ContextTrimmer } from '../retrieval/ContextTrimmer.js';
import { PERSONAS, PersonaType } from '../core/PersonaManager.js';
import { DistillationManager } from '../core/DistillationManager.js';

const StoreSchema = z.object({
  title: z.string(),
  content: z.string(),
  type: z.enum(['bug', 'decision', 'learned', 'architecture', 'todo', 'context']),
  project: z.string().optional(),
  session_id: z.number().optional(),
});

const RememberSchema = z.object({
  query: z.string(),
  project: z.string().optional(),
  limit: z.number().optional().default(10),
  max_tokens: z.number().optional().default(2000),
  persona: z.enum(['architect', 'slang', 'grumpy']).optional(),
});

const ContextSchema = z.object({
  project: z.string().optional(),
  persona: z.enum(['architect', 'slang', 'grumpy']).optional(),
});

const PersonaActionSchema = z.object({
  project: z.string().optional(),
  persona: z.enum(['architect', 'slang', 'grumpy']),
});

const DistillSchema = z.object({
  project: z.string().optional(),
});

const DeleteSchema = z.object({
  id: z.number(),
});

const EditSchema = z.object({
  id: z.number(),
  title: z.string().optional(),
  content: z.string().optional(),
});

export class MemoriaServer {
  private server: Server;
  private storage: SQLiteStorage;
  private embeddings: EmbeddingManager;
  private hybridSearch!: HybridSearch;
  private trimmer: ContextTrimmer;
  private distillation: DistillationManager;

  constructor() {
    this.server = new Server(
      {
        name: 'memoria',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.storage = new SQLiteStorage();
    this.embeddings = new EmbeddingManager();
    this.trimmer = new ContextTrimmer();
    this.distillation = new DistillationManager(this.storage, this.embeddings);

    this.setupTools();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.storage.close();
      process.exit(0);
    });
  }

  async initialize() {
    await this.storage.initialize();
    await this.embeddings.initialize();
    this.hybridSearch = new HybridSearch(this.storage, this.embeddings);
  }

  private setupTools() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'mem_store',
          description: 'Save a new memory (observation) to the persistent store.',
          inputSchema: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Short title of the memory' },
              content: { type: 'string', description: 'Detailed content' },
              type: { type: 'string', enum: ['bug', 'decision', 'learned', 'architecture', 'todo', 'context'] },
              project: { type: 'string', description: 'Project name' },
              session_id: { type: 'number', description: 'Optional session ID' },
            },
            required: ['title', 'content', 'type', 'project'],
          },
        },
        {
          name: 'mem_remember',
          description: 'Search for relevant memories based on a query.',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Natural language query' },
              project: { type: 'string', description: 'Project name' },
              limit: { type: 'number', description: 'Max results to return' },
              max_tokens: { type: 'number', description: 'Max total tokens for the response' },
              persona: { type: 'string', enum: ['architect', 'slang', 'grumpy'], description: 'Optional branding style' },
            },
            required: ['query', 'project'],
          },
        },
        {
          name: 'mem_set_persona',
          description: 'Set a project-wide branding persona for all Memoria responses.',
          inputSchema: {
            type: 'object',
            properties: {
              project: { type: 'string', description: 'Project name' },
              persona: { type: 'string', enum: ['architect', 'slang', 'grumpy'] },
            },
            required: ['project', 'persona'],
          },
        },
        {
          name: 'mem_context',
          description: 'Get a token-optimized snapshot of recent project context.',
          inputSchema: {
            type: 'object',
            properties: {
              project: { type: 'string', description: 'Project name' },
              persona: { type: 'string', enum: ['architect', 'slang', 'grumpy'] },
            },
            required: ['project'],
          },
        },
        {
          name: 'mem_distill',
          description: 'Summarize and compress old memories for a project.',
          inputSchema: {
            type: 'object',
            properties: {
              project: { type: 'string', description: 'Project name' },
            },
            required: ['project'],
          },
        },
        {
          name: 'mem_delete',
          description: 'Delete a specific memory by its ID.',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'number', description: 'Memory ID' },
            },
            required: ['id'],
          },
        },
        {
          name: 'mem_edit',
          description: 'Update the title or content of an existing memory.',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'number', description: 'Memory ID' },
              title: { type: 'string', description: 'New title' },
              content: { type: 'string', description: 'New content' },
            },
            required: ['id'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case 'mem_store': {
            const args = StoreSchema.parse(request.params.arguments);
            const projectName = this.getProjectName(args.project);
            const id = await this.storage.storeObservation({
              title: args.title,
              content: args.content,
              type: args.type,
              project: projectName,
              session_id: args.session_id,
            });

            try {
              await this.embeddings.addVector(id, `${args.title} ${args.content}`, {
                title: args.title,
                type: args.type,
                project: projectName,
              });

              return {
                content: [{ type: 'text', text: `Memory stored with ID: ${id} in project: ${projectName}` }],
              };
            } catch (e: any) {
              console.error(`[Memoria] Failed to generate embedding for memory ${id}: ${e.message}`);
              return {
                content: [{ type: 'text', text: `Memory stored with ID: ${id} but embedding failed. It might not be searchable via semantic search.` }],
              };
            }
          }

          case 'mem_set_persona': {
            const args = PersonaActionSchema.parse(request.params.arguments);
            const projectName = this.getProjectName(args.project);
            await this.storage.setPersona(projectName, args.persona);
            return {
              content: [{ type: 'text', text: `Persona for project ${projectName} set to ${args.persona}.` }],
            };
          }

          case 'mem_remember': {
            const args = RememberSchema.parse(request.params.arguments);
            const projectName = this.getProjectName(args.project);
            const personaType = args.persona || (await this.storage.getPersona(projectName)) as PersonaType || 'architect';
            const persona = PERSONAS[personaType];

            const rawResults = await this.hybridSearch.search(args.query, projectName, args.limit);
            const results = this.trimmer.trim(rawResults, args.max_tokens);

            const responseText = results.length > 0
              ? `${persona.prefix}${persona.directive}\n\nRelevant Memories:\n` + 
                results.map(r => `- [${r.type}] ${r.title}: ${r.content}`).join('\n')
              : `${persona.prefix}No relevant memories found for "${args.query}" in ${projectName}.`;

            return {
              content: [{ type: 'text', text: responseText }],
            };
          }

          case 'mem_context': {
            const args = ContextSchema.parse(request.params.arguments);
            const projectName = this.getProjectName(args.project);
            const personaType = args.persona || (await this.storage.getPersona(projectName)) as PersonaType || 'architect';
            const persona = PERSONAS[personaType];

            // Get the 5 most recent observations for context
            const results = await this.storage.listObservations(projectName, 5);
            const formatted = this.trimmer.formatResults(results as any);

            const responseText = `${persona.prefix}**SYSTEM DIRECTIVE**: ${persona.directive}\n\n${formatted || 'No recent context found.'}`;

            return {
              content: [{ type: 'text', text: responseText }],
            };
          }

          case 'mem_distill': {
            const args = DistillSchema.parse(request.params.arguments);
            const projectName = this.getProjectName(args.project);
            const result = await this.distillation.distill(projectName);
            
            if (result.success) {
              return {
                content: [{ type: 'text', text: `Successfully consolidated ${result.count} memories for project ${projectName}.` }],
              };
            } else {
              return {
                content: [{ type: 'text', text: `No distillation needed for project ${projectName} (below threshold).` }],
              };
            }
          }

          case 'mem_delete': {
            const args = DeleteSchema.parse(request.params.arguments);
            await this.storage.deleteObservation(args.id);
            await this.embeddings.deleteVector(args.id);
            return {
              content: [{ type: 'text', text: `Memory ${args.id} deleted.` }],
            };
          }

          case 'mem_edit': {
            const args = EditSchema.parse(request.params.arguments);
            const updates: any = {};
            if (args.title) updates.title = args.title;
            if (args.content) updates.content = args.content;
            
            await this.storage.updateObservation(args.id, updates);
            
            // Re-embed if content or title changed
            const updated = await this.storage.getObservation(args.id);
            if (updated) {
              await this.embeddings.addVector(args.id, `${updated.title} ${updated.content}`, {
                title: updated.title,
                type: updated.type,
                project: updated.project,
              });
            }
            
            return {
              content: [{ type: 'text', text: `Memory ${args.id} updated and re-indexed.` }],
            };
          }

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new McpError(ErrorCode.InvalidParams, `Invalid arguments: ${error.message}`);
        }
        throw error;
      }
    });
  }

  private getProjectName(project?: string): string {
    return project || path.basename(process.cwd());
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Memoria MCP Server running on stdio');
  }
}

const server = new MemoriaServer();
server.initialize().then(() => server.run()).catch(console.error);
