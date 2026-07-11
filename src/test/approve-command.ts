import * as crypto from "crypto";
import { getDb } from "../core/db.js";
import { ConfirmationStatus } from "../core/constants.js";

/**
 * Inserts an approved pending_confirmations row so Tier 2 commands can run in tests.
 * Prefer this over weakening permission-rules for node/npm install, etc.
 */
export function approveCommandForTests(command: string, stepId: string | null = null): void {
  const db = getDb();
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO pending_confirmations (id, step_id, command, status)
    VALUES (?, ?, ?, ?)
  `).run(id, stepId, command, ConfirmationStatus.APPROVED);
}
