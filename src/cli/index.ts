import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import os from 'os';

const program = new Command();

program
  .name('memoria')
  .description('Memoria: Persistent Memory for AI Agents')
  .version('0.1.0');

program
  .command('setup')
  .description('Initialize Memoria data directory and configure MCP clients')
  .action(async () => {
    const memoriaDir = path.join(process.cwd(), '.memoria');
    const dbPath = path.join(memoriaDir, 'memoria.db');
    const vectorsDir = path.join(memoriaDir, 'vectors');

    console.log('--- Memoria Setup ---');

    if (!fs.existsSync(memoriaDir)) {
      console.log(`Creating directory: ${memoriaDir}`);
      fs.mkdirSync(memoriaDir, { recursive: true });
    }

    if (!fs.existsSync(vectorsDir)) {
      console.log(`Creating directory: ${vectorsDir}`);
      fs.mkdirSync(vectorsDir, { recursive: true });
    }

    console.log('Database path:', dbPath);
    console.log('Vectors path:', vectorsDir);

    const mcpConfig = {
      command: 'npx',
      args: ['-y', '@memoria/brain'],
      env: {}
    };

    const configPaths = [
      { name: 'Claude Desktop', path: path.join(os.homedir(), 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json') },
      { name: 'Cursor', path: path.join(os.homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'mcp_config.json') },
    ];

    console.log('\n--- MCP Client Detection ---');
    for (const client of configPaths) {
      if (fs.existsSync(client.path)) {
        console.log(`[DETECTED] ${client.name} configuration found at: ${client.path}`);
        try {
          const content = JSON.parse(fs.readFileSync(client.path, 'utf8'));
          content.mcpServers = content.mcpServers || {};
          content.mcpServers.memoria = mcpConfig;
          
          fs.writeFileSync(client.path, JSON.stringify(content, null, 2));
          console.log(`[SUCCESS] Automatically added Memoria to ${client.name} config.`);
        } catch (e: any) {
          console.log(`[ERROR] Failed to update ${client.name} config:`, e.message);
        }
      } else {
        console.log(`[MISSING] ${client.name} configuration not found.`);
      }
    }

    console.log('\nTo manually use Memoria with an MCP client, add the following to your configuration:');
    console.log(JSON.stringify({
      mcpServers: {
        memoria: mcpConfig
      }
    }, null, 2));

    console.log('\nSetup complete! The system will automatically download embedding models on first run.');
  });

program
  .command('store')
  .description('Save a new memory manualy')
  .requiredOption('-t, --title <string>', 'Title of the memory')
  .requiredOption('-c, --content <string>', 'Detailed content')
  .requiredOption('--type <string>', 'Type (bug, decision, learned, architecture, todo, context)')
  .option('-p, --project <string>', 'Project name', path.basename(process.cwd()))
  .action(async (options) => {
    const { SQLiteStorage } = await import('../core/SQLiteStorage.js');
    const { EmbeddingManager } = await import('../core/EmbeddingManager.js');
    
    const storage = new SQLiteStorage();
    const embeddings = new EmbeddingManager();
    await storage.initialize();
    await embeddings.initialize();

    const id = await storage.storeObservation({
      title: options.title,
      content: options.content,
      type: options.type as any,
      project: options.project
    });

    await embeddings.addVector(id, `${options.title} ${options.content}`, {
      title: options.title,
      type: options.type,
      project: options.project,
    });

    console.log(`Successfully stored memory with ID: ${id}`);
    await storage.close();
  });

program
  .command('persona')
  .description('Set the branding persona for a project')
  .argument('[project]', 'Project name', path.basename(process.cwd()))
  .argument('<persona>', 'Persona type (architect, slang, grumpy)')
  .action(async (project, persona) => {
    const { SQLiteStorage } = await import('../core/SQLiteStorage.js');
    const { PERSONAS } = await import('../core/PersonaManager.js');

    const personaType = persona as any;
    const personaObj = (PERSONAS as any)[personaType];
    
    if (!personaObj) {
      console.error(`Error: Invalid persona "${persona}". Valid types are: ${Object.keys(PERSONAS).join(', ')}`);
      process.exit(1);
    }

    const storage = new SQLiteStorage();
    await storage.initialize();
    await storage.setPersona(project, personaType);
    console.log(`[SUCCESS] Persona for project "${project}" set to: ${personaObj.name}`);
    await storage.close();
  });

program
  .command('dashboard')
  .description('Launch the Memoria Dashboard GUI')
  .option('-p, --port <number>', 'Port to run the dashboard on', '3001')
  .action(async (options) => {
    const { startDashboardServer } = await import('../dashboard/server.js');
    const port = parseInt(options.port);
    await startDashboardServer(port);
  });
  
program
  .command('changelog')
  .description('Generate a Semantic Developer Changelog from project memories')
  .argument('[project]', 'Project name', path.basename(process.cwd()))
  .option('--force', 'Skip checking for unrecorded local changes')
  .action(async (project, options) => {
    const { SQLiteStorage } = await import('../core/SQLiteStorage.js');
    const storage = new SQLiteStorage();
    await storage.initialize();

    const observations = await storage.listObservations(project, 1000);
    
    // Safety check for unrecorded changes
    if (!options.force && observations.length > 0) {
      const lastObs = observations[0];
      const lastTimestamp = new Date(lastObs.timestamp + 'Z').getTime(); // Assume UTC
      
      const unrecordedFiles: string[] = [];
      const extensions = ['.ts', '.js', '.html', '.css', '.json', '.md'];
      const ignoreDirs = ['node_modules', 'dist', '.memoria', '.git'];

      const checkDir = (dir: string) => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (ignoreDirs.includes(file)) continue;
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory()) {
            checkDir(fullPath);
          } else if (extensions.includes(path.extname(file))) {
            if (stat.mtimeMs > lastTimestamp && file !== 'CHANGELOG.md') {
              unrecordedFiles.push(path.relative(process.cwd(), fullPath));
            }
          }
        }
      };

      try {
        checkDir(process.cwd());
      } catch (e) {
        // Ignore walk errors
      }

      if (unrecordedFiles.length > 0) {
        console.error('😾 [Mr. Grumpy]: **STRIKE ONE.** I found unrecorded changes in your files.');
        console.error('The following files have been modified since your last saved memory:');
        unrecordedFiles.slice(0, 5).forEach(f => console.error(`  - ${f}`));
        if (unrecordedFiles.length > 5) console.error(`  - ... and ${unrecordedFiles.length - 5} more.`);
        console.error('\nIf you generate a changelog now, it will be INCOMPLETE and USELESS.');
        console.error('Run "save-memory" first, or use --force if you want to be sloppy.');
        await storage.close();
        process.exit(1);
      }
    }

    const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
    
    let existingContent = '';
    if (fs.existsSync(changelogPath)) {
      existingContent = fs.readFileSync(changelogPath, 'utf8');
    }

    // Filter out memories already in the changelog (checking for (ID: X))
    const newMemories = observations.filter(obs => {
      return !existingContent.includes(`(ID: ${obs.id})`);
    });

    if (newMemories.length === 0) {
      console.log('No new memories to add to changelog.');
      await storage.close();
      return;
    }

    // Map types to Semantic tags
    const groups: Record<string, any[]> = {
      'Added': [],
      'Changed': [],
      'Fixed': [],
      'Removed': [] // Placeholder for future use
    };

    newMemories.forEach(obs => {
      let tag = 'Added';
      if (obs.type === 'bug') tag = 'Fixed';
      else if (obs.type === 'decision' || obs.type === 'architecture') tag = 'Changed';
      
      groups[tag].push(obs);
    });

    // Format and sync content
    const date = new Date().toISOString().split('T')[0];
    const dateHeader = `## [${date}] - Developer Update`;
    
    // Group existing entries from the same date if they exist
    const newGroups: Record<string, string[]> = {};
    for (const [tag, items] of Object.entries(groups)) {
      items.forEach(item => {
        let entry = `- **${item.title}** (ID: ${item.id})\n`;
        entry += `  - *Technical Detail*: ${item.content}\n`;
        entry += `  - *Type*: ${item.type}`;
        if (!newGroups[tag]) newGroups[tag] = [];
        newGroups[tag].push(entry);
      });
    }

    if (!fs.existsSync(changelogPath)) {
      let content = '# Changelog\n\nAll notable technical changes derived from Memoria persistent storage.\n';
      content += `\n${dateHeader}\n`;
      for (const [tag, entries] of Object.entries(newGroups)) {
        content += `### ${tag}\n${entries.join('\n\n')}\n\n`;
      }
      fs.writeFileSync(changelogPath, content);
    } else {
      let content = fs.readFileSync(changelogPath, 'utf8');
      const dateHeaderIndex = content.indexOf(dateHeader);

      if (dateHeaderIndex !== -1) {
        // Date exists, merge into it
        // We'll find the section for this date (until the next ## or end of file)
        const nextDateIndex = content.indexOf('## [', dateHeaderIndex + dateHeader.length);
        const sectionEnd = nextDateIndex !== -1 ? nextDateIndex : content.length;
        let dateSection = content.substring(dateHeaderIndex, sectionEnd);

        for (const [tag, entries] of Object.entries(newGroups)) {
          const tagHeader = `### ${tag}`;
          const tagIndex = dateSection.indexOf(tagHeader);

          if (tagIndex !== -1) {
            // Tag exists, append to it
            // Find end of tag section
            const nextTagIndex = dateSection.indexOf('### ', tagIndex + tagHeader.length);
            const tagSectionEnd = nextTagIndex !== -1 ? nextTagIndex : dateSection.length;
            const tagContent = dateSection.substring(tagIndex, tagSectionEnd).trim();
            
            const updatedTagContent = `${tagContent}\n\n${entries.join('\n\n')}\n\n`;
            dateSection = dateSection.replace(tagSectionEnd === dateSection.length ? dateSection.substring(tagIndex) : dateSection.substring(tagIndex, tagSectionEnd), updatedTagContent);
          } else {
            // Tag doesn't exist, add it to the date section
            dateSection += `### ${tag}\n${entries.join('\n\n')}\n\n`;
          }
        }

        // Replace the old date section with the updated one
        content = content.substring(0, dateHeaderIndex) + dateSection.trim() + '\n\n' + content.substring(sectionEnd);
      } else {
        // New date, prepend
        let newEntry = `${dateHeader}\n`;
        for (const [tag, entries] of Object.entries(newGroups)) {
          newEntry += `### ${tag}\n${entries.join('\n\n')}\n\n`;
        }
        
        const lines = content.split('\n');
        const titleIndex = lines.findIndex(l => l.startsWith('# '));
        const insertIndex = titleIndex !== -1 ? titleIndex + 2 : 0;
        lines.splice(insertIndex, 0, newEntry);
        content = lines.join('\n');
      }

      fs.writeFileSync(changelogPath, content.replace(/\n{3,}/g, '\n\n')); // Clean up extra newlines
    }

    console.log(`[SUCCESS] Added ${newMemories.length} memories to CHANGELOG.md`);
    await storage.close();
  });

program.parse();
