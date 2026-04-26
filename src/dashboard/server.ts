import express from 'express';
import cors from 'cors';
import { DashboardAPI } from './DashboardAPI.js';
import { SQLiteStorage } from '../core/SQLiteStorage.js';
import { EmbeddingManager } from '../core/EmbeddingManager.js';
import { HybridSearch } from '../retrieval/HybridSearch.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function startDashboardServer(port: number = 3001) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Initialize core systems
  const storage = new SQLiteStorage();
  const embeddings = new EmbeddingManager();
  await storage.initialize();
  await embeddings.initialize();
  const hybridSearch = new HybridSearch(storage, embeddings);
  
  const api = new DashboardAPI(storage, embeddings, hybridSearch);

  // API Endpoints
  app.get('/api/memories', async (req, res) => {
    const project = req.query.project as string;
    if (!project) return res.status(400).json({ error: 'Project is required' });
    const memories = await api.getRecentMemories(project);
    res.json(memories);
  });

  app.post('/api/search', async (req, res) => {
    const { query, project, limit } = req.body;
    if (!project || !query) return res.status(400).json({ error: 'Project and query are required' });
    const results = await api.search(query, project, limit);
    res.json(results);
  });

  app.get('/api/projects', async (req, res) => {
    const projects = await api.listProjects();
    res.json(projects);
  });

  app.get('/api/personas', async (req, res) => {
    const personas = await api.getPersonas();
    res.json(personas);
  });
  
  app.delete('/api/memories/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const result = await api.deleteMemory(id);
    res.json(result);
  });
  
  app.patch('/api/memories/:id', async (req, res) => {
    try {
      const { title, content } = req.body;
      await storage.updateObservation(parseInt(req.params.id), { title, content });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/persona', async (req, res) => {
    try {
      const { project, persona } = req.body;
      if (!project || !persona) {
        return res.status(400).json({ error: 'Project and persona are required' });
      }
      await storage.setPersona(project, persona);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/persona/:project', async (req, res) => {
    try {
      const persona = await storage.getPersona(req.params.project);
      res.json({ persona });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/config', (req, res) => {
    res.json({
      currentProject: path.basename(process.cwd())
    });
  });

  // Serve static frontend (when built)
  const frontendPath = path.join(__dirname, '..', '..', 'dist', 'dashboard', 'public');
  const assetsPath = path.join(__dirname, '..', '..', 'assets');
  
  app.use(express.static(frontendPath));
  app.use('/assets', express.static(assetsPath));

  // Fallback for SPA
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendPath, 'index.html'), (err) => {
      if (err) {
        res.status(200).send('<h1>Memoria Dashboard API is running.</h1><p>Frontend not yet built. Please run <code>npm run build</code>.</p>');
      }
    });
  });

  return app.listen(port, () => {
    console.error(`[Memoria] Dashboard running at http://localhost:${port}`);
  });
}
