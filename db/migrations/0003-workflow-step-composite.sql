-- Enforce uniqueness of (workflow_id, id). Step id remains the row PRIMARY KEY
-- for existing FK references (checkpoints, pending_confirmations); the composite
-- unique index documents and enforces the workflow-scoped identity contract.
CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_steps_workflow_id_id
  ON workflow_steps (workflow_id, id);
