-- Disable foreign key constraints during table updates
PRAGMA foreign_keys = OFF;

-- Update workflows CHECK constraints to include 'requires_confirmation'
CREATE TABLE IF NOT EXISTS workflows_new (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT CHECK(status IN ('pending','running','completed','failed','requires_confirmation')) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO workflows_new (id, name, status, created_at, updated_at)
SELECT id, name, status, created_at, updated_at FROM workflows;

DROP TABLE workflows;
ALTER TABLE workflows_new RENAME TO workflows;

-- Update workflow_steps CHECK constraints to include 'requires_confirmation'
CREATE TABLE IF NOT EXISTS workflow_steps_new (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    depends_on TEXT,
    status TEXT CHECK(status IN ('pending','running','completed','failed','requires_confirmation')) DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    full_log TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO workflow_steps_new (id, workflow_id, title, depends_on, status, retry_count, full_log, created_at)
SELECT id, workflow_id, title, depends_on, status, retry_count, full_log, created_at FROM workflow_steps;

DROP TABLE workflow_steps;
ALTER TABLE workflow_steps_new RENAME TO workflow_steps;

-- Create pending_confirmations table
CREATE TABLE IF NOT EXISTS pending_confirmations (
    id TEXT PRIMARY KEY,
    step_id TEXT REFERENCES workflow_steps(id) ON DELETE CASCADE,
    command TEXT NOT NULL,
    status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Re-enable foreign key constraints
PRAGMA foreign_keys = ON;
