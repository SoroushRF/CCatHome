import { z } from "zod";
import { PermissionTier, CapabilityName } from "../../core/constants.js";
import { CapabilityDefinition } from "../../core/router.js";
import { getDb } from "../../core/db.js";

export const getWorkflowStateDefinition: CapabilityDefinition = {
  name: CapabilityName.GET_WORKFLOW_STATE,
  description: "Retrieves the current state of a workflow or a specific workflow step.",
  inputSchema: z.object({
    workflowId: z.string().optional().describe("Optional workflow ID to retrieve"),
    stepId: z.string().optional().describe("Optional step ID to retrieve details for"),
    includeFullLog: z
      .boolean()
      .optional()
      .describe("When true and stepId is set, include full_log (default false; returns summary)"),
  }),
  tier: PermissionTier.TIER_0, // Tier 0: Always allowed reads
};

interface WorkflowDbRow {
  id: string;
  name: string;
  status: string;
}

interface StepDbRow {
  id: string;
  workflow_id: string;
  title: string;
  depends_on: string;
  status: string;
  retry_count: number;
  full_log: string | null;
  summary: string | null;
}

export async function getWorkflowStateHandler(args: {
  workflowId?: string;
  stepId?: string;
  includeFullLog?: boolean;
}): Promise<{
  success: boolean;
  workflow?: {
    id: string;
    name: string;
    status: string;
    steps: {
      id: string;
      title: string;
      depends_on: string[];
      status: string;
      retry_count: number;
      hasLog: boolean;
    }[];
  };
  step?: {
    id: string;
    workflowId: string;
    title: string;
    depends_on: string[];
    status: string;
    retry_count: number;
    summary?: string | null;
    fullLog?: string | null;
  };
  workflows?: { id: string; name: string; status: string }[];
  error?: string;
  reason?: string;
}> {
  const db = getDb();

  try {
    if (args.stepId) {
      const stepRow = db
        .prepare(
          `
        SELECT id, workflow_id, title, depends_on, status, retry_count, full_log, summary
        FROM workflow_steps
        WHERE id = ?
      `,
        )
        .get(args.stepId) as StepDbRow | undefined;

      if (!stepRow) {
        return {
          success: false,
          error: "step_not_found",
          reason: `No step found with ID ${args.stepId}`,
        };
      }

      return {
        success: true,
        step: {
          id: stepRow.id,
          workflowId: stepRow.workflow_id,
          title: stepRow.title,
          depends_on: JSON.parse(stepRow.depends_on),
          status: stepRow.status,
          retry_count: stepRow.retry_count,
          summary: stepRow.summary ?? (stepRow.full_log ? stepRow.full_log.slice(0, 500) : null),
          fullLog: args.includeFullLog ? stepRow.full_log : undefined,
        },
      };
    }

    if (args.workflowId) {
      const workflowRow = db
        .prepare(
          `
        SELECT id, name, status FROM workflows WHERE id = ?
      `,
        )
        .get(args.workflowId) as WorkflowDbRow | undefined;

      if (!workflowRow) {
        return {
          success: false,
          error: "workflow_not_found",
          reason: `No workflow found with ID ${args.workflowId}`,
        };
      }

      const stepRows = db
        .prepare(
          `
        SELECT id, title, depends_on, status, retry_count, full_log
        FROM workflow_steps
        WHERE workflow_id = ?
      `,
        )
        .all(args.workflowId) as StepDbRow[];

      return {
        success: true,
        workflow: {
          id: workflowRow.id,
          name: workflowRow.name,
          status: workflowRow.status,
          steps: stepRows.map((s) => ({
            id: s.id,
            title: s.title,
            depends_on: JSON.parse(s.depends_on),
            status: s.status,
            retry_count: s.retry_count,
            hasLog: s.full_log !== null,
          })),
        },
      };
    }

    // List all workflows if no ID is specified
    const allWorkflows = db
      .prepare("SELECT id, name, status FROM workflows")
      .all() as WorkflowDbRow[];
    return {
      success: true,
      workflows: allWorkflows,
    };
  } catch (err: any) {
    return {
      success: false,
      error: "query_failed",
      reason: err.message,
    };
  }
}
