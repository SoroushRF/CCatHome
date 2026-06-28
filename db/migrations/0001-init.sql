CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT CHECK(status IN ('pending','running','completed','failed')) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workflow_steps (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    depends_on TEXT,           -- JSON array of step IDs
    status TEXT CHECK(status IN ('pending','running','completed','failed')) DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    full_log TEXT,             -- complete execution record
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS checkpoints (
    id TEXT PRIMARY KEY,
    workflow_step_id TEXT REFERENCES workflow_steps(id),
    git_sha TEXT,
    backup_meta TEXT,          -- JSON: affected file paths + backup locations
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE VIRTUAL TABLE IF NOT EXISTS project_memory USING fts5(
    key, value, category, embedding UNINDEXED
);

CREATE TABLE IF NOT EXISTS command_log (
    id TEXT PRIMARY KEY,
    pid INTEGER,
    log_path TEXT,
    status TEXT CHECK(status IN ('running','ready','exited','killed')),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
