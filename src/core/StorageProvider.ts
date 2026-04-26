export type ObservationType = 'bug' | 'decision' | 'learned' | 'architecture' | 'todo' | 'context';

export interface Observation {
  id?: number;
  title: string;
  content: string;
  type: ObservationType;
  project: string;
  session_id?: number;
  timestamp?: string;
}

export interface Session {
  id?: number;
  title: string;
  project: string;
  summary?: string;
  created_at?: string;
  updated_at?: string;
}

export interface StorageProvider {
  initialize(): Promise<void>;
  
  createSession(session: Session): Promise<number>;
  getSession(id: number): Promise<Session | undefined>;
  listSessions(project: string): Promise<Session[]>;
  updateSession(id: number, updates: Partial<Session>): Promise<void>;
  
  storeObservation(observation: Observation): Promise<number>;
  getObservation(id: number): Promise<Observation | undefined>;
  deleteObservation(id: number): Promise<void>;
  updateObservation(id: number, updates: Partial<Observation>): Promise<void>;
  searchObservations(query: string, project: string): Promise<Observation[]>;
  listObservations(project: string, limit?: number): Promise<Observation[]>;
  listProjects(): Promise<string[]>;
  
  close(): Promise<void>;
}
