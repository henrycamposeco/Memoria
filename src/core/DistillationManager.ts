import { SQLiteStorage } from './SQLiteStorage.js';
import { EmbeddingManager } from './EmbeddingManager.js';
import { Observation } from './StorageProvider.js';

export class DistillationManager {
  constructor(
    private storage: SQLiteStorage,
    private embeddings: EmbeddingManager
  ) {}

  /**
   * Consolidate old memories for a project to save token space.
   * Currently implements logical consolidation (concatenation).
   */
  async distill(project: string, threshold: number = 20, batchSize: number = 10): Promise<{ success: boolean; count?: number }> {
    // 1. Check if we have enough observations to justify distillation
    const allObs = await this.storage.listObservations(project, threshold + 1);
    if (allObs.length <= threshold) {
      return { success: false };
    }

    // 2. Fetch the oldest batch of observations
    // Since listObservations returns most recent first, we need to skip the threshold and get older ones
    const oldObs = await this.storage.getOldObservations(project, threshold);
    if (oldObs.length === 0) return { success: false };

    const batchToDistill = oldObs.slice(0, batchSize);
    
    // 3. Create consolidated content
    const consolidatedTitle = `Consolidated Memory (${new Date().toLocaleDateString()})`;
    const consolidatedContent = batchToDistill.map(o => `[${o.type.toUpperCase()}] ${o.title}: ${o.content}`).join('\n\n---\n\n');
    
    // 4. Store the new consolidated observation
    const newId = await this.storage.storeObservation({
      title: consolidatedTitle,
      content: consolidatedContent,
      type: 'context',
      project: project
    });

    await this.embeddings.addVector(newId, `${consolidatedTitle} ${consolidatedContent}`, {
      title: consolidatedTitle,
      type: 'context',
      project: project
    });

    // 5. Delete the old individual observations
    for (const obs of batchToDistill) {
      if (obs.id) {
        await this.storage.deleteObservation(obs.id);
        await this.embeddings.deleteVector(obs.id);
      }
    }

    return { success: true, count: batchToDistill.length };
  }
}
