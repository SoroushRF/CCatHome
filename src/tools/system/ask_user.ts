import { z } from "zod";
import {
  PermissionTier,
  CapabilityName,
  ConfirmationStatus,
  StepStatus,
} from "../../core/constants.js";
import { CapabilityDefinition } from "../../core/router.js";
import { getDb } from "../../core/db.js";
import { config } from "../../core/config.js";

import * as crypto from "crypto";

export const askUserDefinition: CapabilityDefinition = {
  name: CapabilityName.ASK_USER,
  description: "Asks the user for clarification or permission to execute a Tier 2 gated command.",
  inputSchema: z.object({
    type: z.enum(["clarification", "permission"]).describe("The type of request: clarification or permission approval"),
    question: z.string().optional().describe("Clarification question for the user"),
    options: z.array(z.string()).optional().describe("Optional list of choices for clarification"),
    command: z.string().optional().describe("The Tier 2 command requiring confirmation"),
    risk: z.string().optional().describe("The associated risk description of running the command"),
    response: z.string().optional().describe("The user's response or approval ('approved' or 'rejected')"),
  }),
  tier: PermissionTier.TIER_0, // Tier 0: allowed so the agent can ask questions, and user can respond
};

export async function askUserHandler(args: {
  type: "clarification" | "permission";
  question?: string;
  options?: string[];
  command?: string;
  risk?: string;
  response?: string;
}): Promise<{
  success: boolean;
  response?: string;
  error?: string;
  reason?: string;
}> {
  const db = getDb();

  if (args.type === "permission") {
    if (!args.command) {
      return {
        success: false,
        error: "missing_command",
        reason: "Command parameter is required for permission approvals",
      };
    }

    // Find pending confirmation matching this command
    const query =
      "SELECT id, step_id, status FROM pending_confirmations WHERE command = ? AND status = ? ORDER BY created_at DESC LIMIT 1";
    const queryParams: any[] = [args.command, ConfirmationStatus.PENDING];

    let pending = db.prepare(query).get(...queryParams) as
      | { id: string; step_id: string | null; status: string }
      | undefined;

    if (!pending) {
      // If not already exists, insert a new pending confirmation
      const newId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO pending_confirmations (id, step_id, command, status)
        VALUES (?, ?, ?, ?)
      `).run(newId, config.activeStepId || null, args.command, ConfirmationStatus.PENDING);

      pending = {
        id: newId,
        step_id: config.activeStepId || null,
        status: ConfirmationStatus.PENDING,
      };
    }

    // If response is provided, resolve immediately (e.g. called from Dashboard/CLI)
    if (args.response) {
      if (
        args.response !== ConfirmationStatus.APPROVED &&
        args.response !== ConfirmationStatus.REJECTED
      ) {
        return {
          success: false,
          error: "invalid_response",
          reason: "Response must be either 'approved' or 'rejected'",
        };
      }

      db.prepare("UPDATE pending_confirmations SET status = ? WHERE id = ?").run(
        args.response,
        pending.id
      );

      if (pending.step_id) {
        const nextStepStatus =
          args.response === ConfirmationStatus.APPROVED
            ? StepStatus.RUNNING
            : StepStatus.FAILED;
        db.prepare("UPDATE workflow_steps SET status = ? WHERE id = ?").run(
          nextStepStatus,
          pending.step_id
        );
      }

      return {
        success: true,
        response: args.response,
      };
    }

    // If no response provided, poll the database waiting for the user to approve/reject
    console.error(`\n[ASK_USER] Gated command requires approval: ${args.command}`);
    if (args.risk) {
      console.error(`[RISK] ${args.risk}`);
    }
    console.error(`Please approve this request in the dashboard (http://localhost:3141) or database.`);

    const checkInterval = 1000; // 1s
    const timeout = 60000; // 60s timeout
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const current = db
        .prepare("SELECT status FROM pending_confirmations WHERE id = ?")
        .get(pending.id) as { status: string } | undefined;
      if (current && current.status !== ConfirmationStatus.PENDING) {
        return {
          success: true,
          response: current.status,
        };
      }
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    return {
      success: false,
      error: "timeout",
      reason: "User confirmation request timed out after 60 seconds",
    };
  }

  // Clarification flow
  return {
    success: true,
    response: args.response || "No response received",
  };
}
