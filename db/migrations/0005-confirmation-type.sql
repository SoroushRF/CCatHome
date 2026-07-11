-- Add confirmation type/question for clarification HITL and keep permission rows.
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS pending_confirmations_new (
    id TEXT PRIMARY KEY,
    step_id TEXT REFERENCES workflow_steps(id) ON DELETE CASCADE,
    command TEXT NOT NULL,
    status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    type TEXT CHECK(type IN ('permission', 'clarification')) DEFAULT 'permission',
    question TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO pending_confirmations_new (id, step_id, command, status, type, question, created_at)
SELECT id, step_id, command, status, 'permission', NULL, created_at FROM pending_confirmations;

DROP TABLE pending_confirmations;
ALTER TABLE pending_confirmations_new RENAME TO pending_confirmations;

PRAGMA foreign_keys = ON;
