import { ConfirmationStatus, StepStatus } from "./constants.js";
import { getDb } from "./db.js";

export interface PendingConfirmationRow {
  id: string;
  step_id: string | null;
  command: string;
  status: string;
  type?: string | null;
  question?: string | null;
  answer_text?: string | null;
  created_at?: string;
}

/**
 * Apply approve/reject to a pending confirmation and sync step status.
 * Optional answerText is stored for clarification flows.
 */
export function resolvePendingConfirmation(
  id: string,
  response: ConfirmationStatus.APPROVED | ConfirmationStatus.REJECTED,
  answerText?: string,
): { success: boolean; error?: string; reason?: string } {
  const db = getDb();
  const row = db
    .prepare("SELECT id, step_id, status FROM pending_confirmations WHERE id = ?")
    .get(id) as { id: string; step_id: string | null; status: string } | undefined;

  if (!row) {
    return { success: false, error: "not_found", reason: `No confirmation '${id}'` };
  }
  if (row.status !== ConfirmationStatus.PENDING) {
    return {
      success: false,
      error: "already_resolved",
      reason: `Confirmation already '${row.status}'`,
    };
  }

  try {
    db.prepare("UPDATE pending_confirmations SET status = ?, answer_text = ? WHERE id = ?").run(
      response,
      answerText ?? null,
      id,
    );
  } catch {
    // Pre-migration DBs may lack answer_text
    db.prepare("UPDATE pending_confirmations SET status = ? WHERE id = ?").run(response, id);
  }

  if (row.step_id) {
    const nextStepStatus =
      response === ConfirmationStatus.APPROVED ? StepStatus.RUNNING : StepStatus.FAILED;
    db.prepare("UPDATE workflow_steps SET status = ? WHERE id = ?").run(
      nextStepStatus,
      row.step_id,
    );
  }

  return { success: true };
}

export function listPendingConfirmations(): PendingConfirmationRow[] {
  const db = getDb();
  try {
    return db
      .prepare(
        `SELECT id, step_id, command, status, type, question, answer_text, created_at
         FROM pending_confirmations
         WHERE status = ?
         ORDER BY created_at DESC
         LIMIT 20`,
      )
      .all(ConfirmationStatus.PENDING) as PendingConfirmationRow[];
  } catch {
    try {
      return db
        .prepare(
          `SELECT id, step_id, command, status, type, question, created_at
           FROM pending_confirmations
           WHERE status = ?
           ORDER BY created_at DESC
           LIMIT 20`,
        )
        .all(ConfirmationStatus.PENDING) as PendingConfirmationRow[];
    } catch {
      return db
        .prepare(
          `SELECT id, step_id, command, status, created_at
           FROM pending_confirmations
           WHERE status = ?
           ORDER BY created_at DESC
           LIMIT 20`,
        )
        .all(ConfirmationStatus.PENDING) as PendingConfirmationRow[];
    }
  }
}
