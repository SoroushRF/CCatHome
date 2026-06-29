import { z } from "zod";
import { PermissionTier, CapabilityName } from "../../core/constants.js";
import { CapabilityDefinition } from "../../core/router.js";
import { getDb } from "../../core/db.js";
import { config } from "../../core/config.js";

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
  if (args.type === "permission") {
    if (!args.command) {
      return {
        success: false,
        error: "missing_command",
        reason: "Command parameter is required for permission approvals",
      };
    }

    if (!args.response || (args.response !== "approved" && args.response !== "rejected")) {
      return {
        success: false,
        error: "invalid_response",
        reason: "Response must be either 'approved' or 'rejected'",
      };
    }

    const db = getDb();
    
    // Find pending confirmation matching this command
    let query = "SELECT id, step_id FROM pending_confirmations WHERE command = ? AND status = 'pending'";
    let queryParams: any[] = [args.command];

    if (config.activeStepId) {
      query += " AND step_id = ?";
      queryParams.push(config.activeStepId);
    }

    // Sort by creation to update the latest one
    query += " ORDER BY created_at DESC LIMIT 1";

    const pending = db.prepare(query).get(...queryParams) as { id: string; step_id: string } | undefined;

    if (!pending) {
      return {
        success: false,
        error: "no_pending_confirmation",
        reason: `No pending confirmation request found for command: '${args.command}'`,
      };
    }

    // Update status
    db.prepare("UPDATE pending_confirmations SET status = ? WHERE id = ?").run(args.response, pending.id);

    // If approved/rejected and we have a step ID, update the step status back to 'running' or 'failed'
    if (pending.step_id) {
      const nextStepStatus = args.response === "approved" ? "running" : "failed";
      db.prepare("UPDATE workflow_steps SET status = ? WHERE id = ?").run(nextStepStatus, pending.step_id);
    }

    return {
      success: true,
      response: args.response,
    };
  }

  // Clarification flow
  return {
    success: true,
    response: args.response || "No response received",
  };
}
