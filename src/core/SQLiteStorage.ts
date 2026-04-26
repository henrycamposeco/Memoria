import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { StorageProvider, Session, Observation } from './StorageProvider.js';
import { SQL_SCHEMA } from '../schema/schema.js';

export class SQLiteStorage implements StorageProvider {
  private db!: Database.Database;
  private dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(os.homedir(), '.memoria', 'memoria.db');
  }

  async initialize(): Promise<void> {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');

    this.db.exec(SQL_SCHEMA);
  }

  async createSession(session: Session): Promise<number> {
    const stmt = this.db.prepare(
      'INSERT INTO sessions (title, project, summary) VALUES (?, ?, ?)'
    );
    const result = stmt.run(session.title, session.project, session.summary || null);
    return result.lastInsertRowid as number;
  }

  async getSession(id: number): Promise<Session | undefined> {
    const stmt = this.db.prepare('SELECT * FROM sessions WHERE id = ?');
    return stmt.get(id) as Session | undefined;
  }

  async listSessions(project: string): Promise<Session[]> {
    const stmt = this.db.prepare('SELECT * FROM sessions WHERE project = ? ORDER BY updated_at DESC');
    return stmt.all(project) as Session[];
  }

  async updateSession(id: number, updates: Partial<Session>): Promise<void> {
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    const stmt = this.db.prepare(`UPDATE sessions SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
    stmt.run(...values, id);
  }

  async storeObservation(observation: Observation): Promise<number> {
    const stmt = this.db.prepare(
      'INSERT INTO observations (session_id, title, content, type, project) VALUES (?, ?, ?, ?, ?)'
    );
    const result = stmt.run(
      observation.session_id || null,
      observation.title,
      observation.content,
      observation.type,
      observation.project
    );
    return result.lastInsertRowid as number;
  }

  async getObservation(id: number): Promise<Observation | undefined> {
    const stmt = this.db.prepare('SELECT * FROM observations WHERE id = ?');
    return stmt.get(id) as Observation | undefined;
  }

  async deleteObservation(id: number): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM observations WHERE id = ?');
    stmt.run(id);
  }

  async updateObservation(id: number, updates: Partial<Observation>): Promise<void> {
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    const stmt = this.db.prepare(`UPDATE observations SET ${fields} WHERE id = ?`);
    stmt.run(...values, id);
  }

  async searchObservations(query: string, project: string): Promise<Observation[]> {
    // Sanitize query for FTS5 (remove special characters that might cause syntax errors)
    const sanitizedQuery = query.replace(/[^\w\s]/g, ' ').trim();
    if (!sanitizedQuery) {
      return this.listObservations(project, 10);
    }

    const stmt = this.db.prepare(`
      SELECT o.* FROM observations o
      WHERE o.id IN (SELECT rowid FROM observations_fts WHERE observations_fts MATCH ?)
      AND o.project = ?
    `);
    return stmt.all(sanitizedQuery, project) as Observation[];
  }

  async listObservations(project: string, limit: number = 50): Promise<Observation[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM observations 
      WHERE project = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);
    return stmt.all(project, limit) as Observation[];
  }

  async getOldObservations(project: string, olderThanCount: number): Promise<Observation[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM observations 
      WHERE project = ? 
      ORDER BY timestamp DESC 
      LIMIT -1 OFFSET ?
    `);
    return stmt.all(project, olderThanCount) as Observation[];
  }

  async listProjects(): Promise<string[]> {
    const stmt = this.db.prepare('SELECT DISTINCT project FROM observations ORDER BY project ASC');
    return stmt.all().map((row: any) => row.project);
  }

  async getPersona(project: string): Promise<string> {
    const stmt = this.db.prepare('SELECT persona FROM project_settings WHERE project = ?');
    const row = stmt.get(project) as { persona: string } | undefined;
    return row?.persona || 'architect';
  }

  async setPersona(project: string, persona: string): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO project_settings (project, persona) 
      VALUES (?, ?) 
      ON CONFLICT(project) DO UPDATE SET persona = excluded.persona, updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(project, persona);
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
    }
  }
}
