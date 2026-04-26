import { SQLiteStorage } from '../core/SQLiteStorage.js';
import { HybridSearch } from '../retrieval/HybridSearch.js';
import { EmbeddingManager } from '../core/EmbeddingManager.js';
import { PERSONAS, PersonaType } from '../core/PersonaManager.js';

export class DashboardAPI {
  constructor(
    private storage: SQLiteStorage,
    private embeddings: EmbeddingManager,
    private hybridSearch: HybridSearch
  ) {}

  async getRecentMemories(project: string, limit: number = 50) {
    return await this.storage.listObservations(project, limit);
  }

  async search(query: string, project: string, limit: number = 10) {
    return await this.hybridSearch.search(query, project, limit);
  }

  async getPersonas() {
    return Object.entries(PERSONAS).map(([key, p]) => ({
      id: key,
      ...p
    }));
  }

  async listProjects() {
    return await this.storage.listProjects();
  }

  async setPersona(project: string, persona: PersonaType) {
    return { success: true, persona: persona, name: PERSONAS[persona].name };
  }

  async deleteMemory(id: number) {
    await this.storage.deleteObservation(id);
    await this.embeddings.deleteVector(id);
    return { success: true };
  }

  async updateMemory(id: number, updates: any) {
    await this.storage.updateObservation(id, updates);
    // If title or content changed, we should ideally re-embed.
    // For now, let's just update the DB.
    // TODO: Add re-embedding logic if content changes.
    return { success: true };
  }
}
