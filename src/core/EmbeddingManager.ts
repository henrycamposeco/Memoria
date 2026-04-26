import { pipeline } from '@xenova/transformers';
import { LocalIndex } from 'vectra';
import path from 'path';
import fs from 'fs';
import os from 'os';

export class EmbeddingManager {
  private extractor: any;
  private vectorIndex!: LocalIndex;
  private indexPath: string;

  constructor(indexPath?: string) {
    this.indexPath = indexPath || path.join(process.cwd(), '.memoria', 'vectors');
  }

  async initialize(): Promise<void> {
    // Initialize transformer pipeline
    this.extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

    // Initialize Vectra index
    if (!fs.existsSync(this.indexPath)) {
      fs.mkdirSync(this.indexPath, { recursive: true });
    }
    this.vectorIndex = new LocalIndex(this.indexPath);
    
    if (!await this.vectorIndex.isIndexCreated()) {
      await this.vectorIndex.createIndex();
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const output = await this.extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }

  async addVector(id: number, text: string, metadata: any): Promise<void> {
    const vector = await this.generateEmbedding(text);
    await this.vectorIndex.upsertItem({
      id: id.toString(),
      vector: vector,
      metadata: metadata
    });
  }

  async searchVectors(query: string, limit: number = 10): Promise<any[]> {
    const vector = await this.generateEmbedding(query);
    const results = await this.vectorIndex.queryItems(vector, query, limit);
    return results;
  }

  async deleteVector(id: number): Promise<void> {
    await this.vectorIndex.deleteItem(id.toString());
  }
}
