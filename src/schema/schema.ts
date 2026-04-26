export const SQL_SCHEMA = `
-- Sessions Table
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    project TEXT NOT NULL,
    summary TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Observations Table
CREATE TABLE IF NOT EXISTS observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT NOT NULL,
    project TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Full Text Search Table
CREATE VIRTUAL TABLE IF NOT EXISTS observations_fts USING fts5(
    title,
    content,
    content='observations',
    content_rowid='id'
);

-- Triggers for FTS
CREATE TRIGGER IF NOT EXISTS observations_ai AFTER INSERT ON observations BEGIN
    INSERT INTO observations_fts(rowid, title, content) VALUES (new.id, new.title, new.content);
END;

CREATE TRIGGER IF NOT EXISTS observations_ad AFTER DELETE ON observations BEGIN
    INSERT INTO observations_fts(observations_fts, rowid, title, content) VALUES('delete', old.id, old.title, old.content);
END;

CREATE TRIGGER IF NOT EXISTS observations_au AFTER UPDATE ON observations BEGIN
    INSERT INTO observations_fts(observations_fts, rowid, title, content) VALUES('delete', old.id, old.title, old.content);
    INSERT INTO observations_fts(rowid, title, content) VALUES (new.id, new.title, new.content);
END;

-- Settings Table
CREATE TABLE IF NOT EXISTS project_settings (
    project TEXT PRIMARY KEY,
    persona TEXT DEFAULT 'architect',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;
