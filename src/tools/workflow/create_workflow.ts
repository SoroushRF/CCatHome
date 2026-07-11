import { z } from "zod";
import * as crypto from "crypto";
import { PermissionTier, CapabilityName } from "../../core/constants.js";
import { CapabilityDefinition } from "../../core/router.js";
import { saveWorkflow } from "../../core/workflow-engine.js";

export const createWorkflowDefinition: CapabilityDefinition = {
  name: CapabilityName.CREATE_WORKFLOW,
  description:
    "Creates a new multi-step DAG workflow. Validates dependencies and cycle constraints.",
  inputSchema: z.object({
    name: z.string().describe("The name of the workflow"),
    steps: z
      .array(
        z.object({
          id: z.string().describe("Unique identifier for this step"),
          title: z.string().describe("Title of this step"),
          depends_on: z.array(z.string()).optional().describe("Optional step ID dependencies"),
        }),
      )
      .describe("List of workflow steps"),
  }),
  tier: PermissionTier.TIER_1, // Tier 1: Workspace writes / edits
};

export async function createWorkflowHandler(args: {
  name: string;
  steps: { id: string; title: string; depends_on?: string[] }[];
}): Promise<{
  success: boolean;
  workflowId?: string;
  error?: string;
  reason?: string;
}> {
  const workflowId = crypto.randomBytes(8).toString("hex");

  try {
    saveWorkflow(workflowId, args.name, args.steps);
    return {
      success: true,
      workflowId,
    };
  } catch (err: any) {
    return {
      success: false,
      error: "invalid_workflow",
      reason: err.message,
    };
  }
}
