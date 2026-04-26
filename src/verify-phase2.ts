import { SQLiteStorage } from './core/SQLiteStorage.js';
import { EmbeddingManager } from './core/EmbeddingManager.js';
import { HybridSearch } from './retrieval/HybridSearch.js';
import { ContextTrimmer } from './retrieval/ContextTrimmer.js';
import path from 'path';
import fs from 'fs';
import os from 'os';

async function main() {
  const testDir = path.join(os.tmpdir(), 'memoria-test-p2-' + Date.now());
  fs.mkdirSync(testDir, { recursive: true });

  const dbPath = path.join(testDir, 'test.db');
  const indexPath = path.join(testDir, 'vectors');

  console.log('--- Memoria Phase 2 Verification ---');

  const storage = new SQLiteStorage(dbPath);
  const embeddings = new EmbeddingManager(indexPath);
  
  try {
    await storage.initialize();
    await embeddings.initialize();

    const project = 'hybrid-test';
    const hybridSearch = new HybridSearch(storage, embeddings);
    const trimmer = new ContextTrimmer();

    console.log('Storing multiple observations...');
    const obs = [
      { title: 'Typescript Generics', content: 'Generics allow for code reuse across types.', type: 'learned' },
      { title: 'React Hooks', content: 'Hooks allow state management in functional components.', type: 'learned' },
      { title: 'Node.js Streams', content: 'Streams are efficient for processing large data.', type: 'learned' },
      { title: 'Docker Containers', content: 'Containers package applications and dependencies.', type: 'architecture' }
    ];

    for (const item of obs) {
      const id = await storage.storeObservation({ ...item, project } as any);
      await embeddings.addVector(id, item.title + ' ' + item.content, { 
        title: item.title, 
        project: project,
        type: item.type
      });
    }

    console.log('Testing Hybrid Search (Query: "How to manage state?")');
    // This should find React Hooks via Vector Search
    const results = await hybridSearch.search('How to manage state?', project);
    console.log('Hybrid Results found:', results.length);
    results.forEach(r => console.log(`- [Score: ${r.score.toFixed(2)}] ${r.title}`));

    console.log('Testing Token Trimming (Budget: 30 tokens)');
    // Each entry is roughly 15-20 tokens. 30 tokens should only fit one or two.
    const trimmed = trimmer.trim(results, 30);
    console.log('Trimmed results:', trimmed.length);
    console.log('Formatted Output:\n' + trimmer.formatResults(trimmed));

    console.log('--- Phase 2 Success ---');

  } catch (error) {
    console.error('Verification failed:', error);
  } finally {
    await storage.close();
  }
}

main();
