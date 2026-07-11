import * as crypto from "crypto";
import { getDb } from "../core/db.js";
import { ConfirmationStatus } from "../core/constants.js";

/**
 * Inserts approved pending_confirmations rows so Tier 2 commands can run in tests.
 * Prefer this over weakening permission-rules for node/npm install, etc.
 * Inserts multiple rows because approvals are single-use (ADR 0009).
 */
export function approveCommandForTests(
  command: string,
  stepId: string | null = null,
  uses = 8
): void {
  const db = getDb();
  const insert = db.prepare(`
    INSERT INTO pending_confirmations (id, step_id, command, status)
    VALUES (?, ?, ?, ?)
  `);
  for (let i = 0; i < uses; i++) {
    insert.run(crypto.randomUUID(), stepId, command, ConfirmationStatus.APPROVED);
  }
}
