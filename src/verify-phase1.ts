import { SQLiteStorage } from './core/SQLiteStorage.js';
import { EmbeddingManager } from './core/EmbeddingManager.js';
import path from 'path';
import fs from 'fs';
import os from 'os';

async function main() {
  const testDir = path.join(os.tmpdir(), 'memoria-test-' + Date.now());
  fs.mkdirSync(testDir, { recursive: true });

  const dbPath = path.join(testDir, 'test.db');
  const indexPath = path.join(testDir, 'vectors');

  console.log('--- Memoria Phase 1 Verification ---');
  console.log('Test directory:', testDir);

  const storage = new SQLiteStorage(dbPath);
  const embeddings = new EmbeddingManager(indexPath);

  try {
    console.log('Initializing Storage...');
    await storage.initialize();
    console.log('Storage initialized.');

    console.log('Initializing Embedding Manager (this may download the model)...');
    await embeddings.initialize();
    console.log('Embedding Manager initialized.');

    const project = 'test-project';
    
    console.log('Storing Session...');
    const sessionId = await storage.createSession({
      title: 'Initial Research',
      project: project,
      summary: 'Researching the core engine'
    });
    console.log('Session stored with ID:', sessionId);

    console.log('Storing Observation...');
    const obsId = await storage.storeObservation({
      title: 'SQLite FTS5',
      content: 'SQLite FTS5 is great for full-text search.',
      type: 'learned',
      project: project,
      session_id: sessionId
    });
    console.log('Observation stored with ID:', obsId);

    console.log('Adding Vector...');
    await embeddings.addVector(obsId, 'SQLite FTS5 is great for full-text search.', {
      title: 'SQLite FTS5',
      type: 'learned',
      project: project
    });
    console.log('Vector added.');

    console.log('Testing FTS Search...');
    const ftsResults = await storage.searchObservations('search', project);
    console.log('FTS Results:', ftsResults.length);
    if (ftsResults.length > 0) {
      console.log('Top FTS Result:', ftsResults[0].title);
    }

    console.log('Testing Vector Search...');
    const vectorResults = await embeddings.searchVectors('How to search in SQLite?', 1);
    console.log('Vector Results:', vectorResults.length);
    if (vectorResults.length > 0) {
      console.log('Top Vector Result metadata:', vectorResults[0].item.metadata.title);
      console.log('Score:', vectorResults[0].score);
    }

    console.log('--- Phase 1 Success ---');

  } catch (error) {
    console.error('Verification failed:', error);
  } finally {
    await storage.close();
    // Cleanup
    // fs.rmSync(testDir, { recursive: true, force: true });
  }
}

main();
