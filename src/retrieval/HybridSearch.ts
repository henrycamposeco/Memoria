import { StorageProvider, Observation } from '../core/StorageProvider.js';
import { EmbeddingManager } from '../core/EmbeddingManager.js';

export interface SearchResult extends Observation {
  score: number;
}

export class HybridSearch {
  constructor(
    private storage: StorageProvider,
    private embeddings: EmbeddingManager
  ) {}

  async search(query: string, project: string, limit: number = 10): Promise<SearchResult[]> {
    // 1. Get FTS results
    const ftsResults = await this.storage.searchObservations(query, project);
    
    // 2. Get Vector results
    const vectorResults = await this.embeddings.searchVectors(query, limit * 2);

    const merged = new Map<number, SearchResult>();

    // Process FTS results
    // better-sqlite3 FTS5 rank: lower is better. 
    // We'll normalize it roughly. If we don't have a good normalization, we'll just give it a weight.
    ftsResults.forEach((obs, index) => {
      if (obs.id) {
        merged.set(obs.id, {
          ...obs,
          score: 1.0 / (index + 1) // Reciprocal Rank Fusion (RRF) style
        });
      }
    });

    // Process Vector results
    vectorResults.forEach((res) => {
      const id = parseInt(res.item.id);
      const vectorScore = res.score; // Cosine similarity typically 0-1
      
      if (merged.has(id)) {
        const existing = merged.get(id)!;
        existing.score += vectorScore; // Combine scores
      } else {
        // Find observation in DB if not found by FTS
        // Note: For efficiency, we might want to store metadata in Vector Index
        // or fetch missing observations in bulk.
        // For now, we'll use the metadata stored in Vector Index or fetch from DB.
        const metadata = res.item.metadata;
        if (metadata && metadata.project === project) {
          merged.set(id, {
            id: id,
            title: metadata.title || 'Untitled',
            content: '', // Content will be fetched from DB below
            type: metadata.type || 'context',
            project: metadata.project,
            score: vectorScore
          });
        }
      }
    });

    // Fetch missing content for vector-only results if needed
    // (In a real system, we'd fetch these in one query)
    const finalResults = await Promise.all(
      Array.from(merged.values()).map(async (res) => {
        if (!res.content && res.id) {
          const full = await this.storage.getObservation(res.id);
          if (full) {
            res.content = full.content;
            res.timestamp = full.timestamp;
            res.session_id = full.session_id;
          }
        }
        return res;
      })
    );

    // Filter by project (already done above but just in case) and sort by score
    return finalResults
      .filter(r => r.project === project)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}
