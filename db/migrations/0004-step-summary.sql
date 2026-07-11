-- Store a model-facing truncated summary separately from the complete full_log.
ALTER TABLE workflow_steps ADD COLUMN summary TEXT;
