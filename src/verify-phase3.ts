import { SQLiteStorage } from './core/SQLiteStorage.js';
import { EmbeddingManager } from './core/EmbeddingManager.js';
import { DistillationManager } from './core/DistillationManager.js';
import path from 'path';
import fs from 'fs';
import os from 'os';

async function main() {
  const testDir = path.join(os.tmpdir(), 'memoria-test-p3-' + Date.now());
  fs.mkdirSync(testDir, { recursive: true });

  const dbPath = path.join(testDir, 'test.db');
  const indexPath = path.join(testDir, 'vectors');

  console.log('--- Memoria Phase 3 Verification ---');

  const storage = new SQLiteStorage(dbPath);
  const embeddings = new EmbeddingManager(indexPath);
  const distillation = new DistillationManager(storage, embeddings);
  
  try {
    await storage.initialize();
    await embeddings.initialize();

    const project = 'distill-test';

    console.log('Storing 25 observations to trigger distillation threshold (20)...');
    for (let i = 1; i <= 25; i++) {
      const id = await storage.storeObservation({
        title: `Observation ${i}`,
        content: `This is the content of observation ${i} which discusses topic ${i % 3}.`,
        type: 'learned',
        project
      });
      await embeddings.addVector(id, `Observation ${i} content ${i}`, { project });
    }

    const initialCount = (await storage.listObservations(project, 100)).length;
    console.log(`Initial count: ${initialCount}`);

    console.log('Running Distillation...');
    const result = await distillation.distill(project, 20, 10);
    
    if (result.success) {
      console.log(`Successfully distilled ${result.count} memories.`);
      const finalCount = (await storage.listObservations(project, 100)).length;
      console.log(`Final count: ${finalCount} (Expected: ${initialCount - 10 + 1})`);
      
      const recent = await storage.listObservations(project, 1);
      console.log('Newest observation title:', recent[0].title);
    } else {
      console.error('Distillation failed to trigger!');
    }

    console.log('\nTesting Update & Delete...');
    const obs = await storage.listObservations(project, 1);
    const targetId = obs[0].id!;

    await storage.updateObservation(targetId, { title: 'UPDATED TITLE' });
    const updated = await storage.getObservation(targetId);
    console.log('Update Title check:', updated?.title === 'UPDATED TITLE' ? 'PASS' : 'FAIL');

    await storage.deleteObservation(targetId);
    const deleted = await storage.getObservation(targetId);
    console.log('Delete check:', deleted === undefined ? 'PASS' : 'FAIL');

    console.log('--- Phase 3 Success ---');

  } catch (error) {
    console.error('Verification failed:', error);
  } finally {
    await storage.close();
  }
}

main();
