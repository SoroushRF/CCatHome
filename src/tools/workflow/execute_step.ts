import { z } from "zod";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import {
  PermissionTier,
  CapabilityName,
  StepStatus,
  WorkflowStatus,
} from "../../core/constants.js";
import { CapabilityDefinition } from "../../core/router.js";
import { runCommandGated } from "../../core/process-runner.js";
import { getDb } from "../../core/db.js";
import { checkpointHandler } from "../checkpoint/checkpoint.js";
import { restoreCheckpointHandler } from "../checkpoint/restore_checkpoint.js";
import { config } from "../../core/config.js";
import { RequiresConfirmationError } from "../../core/permission-gate.js";
import {
  areStepDependenciesMet,
  getRunnableSteps,
} from "../../core/workflow-engine.js";
import { ensureBranchIsolation, runGit } from "../../core/git-utils.js";

const SUMMARY_MAX_CHARS = 2000;

function buildSummary(fullLog: string): string {
  if (fullLog.length <= SUMMARY_MAX_CHARS) {
    return fullLog;
  }
  return `${fullLog.slice(0, SUMMARY_MAX_CHARS)}\n...[truncated]`;
}

function persistAttemptLog(fullLog: string): string {
  const logId = crypto.randomBytes(8).toString("hex");
  const logsDir = path.join(config.workspaceRoot, ".ccathome", "logs");
  fs.mkdirSync(logsDir, { recursive: true });
  fs.writeFileSync(path.join(logsDir, `cmd_${logId}.log`), fullLog, "utf-8");
  return logId;
}

export const executeStepDefinition: CapabilityDefinition = {
  name: CapabilityName.EXECUTE_STEP,
  description: "Executes a workflow step using an auto-fix micro-loop with checkpointing, validation, and recovery commands.",
  inputSchema: z.object({
    workflowId: z.string().describe("The ID of the workflow"),
    stepId: z.string().describe("The ID of the step to execute"),
    executionCommand: z.string().describe("The command to run to execute the step"),
    validationCommand: z.string().describe("The command to run to validate if the step succeeded"),
    maxRetries: z.number().default(3).describe("Max recovery attempts after the initial try (0 = single attempt, no recovery)"),
    recoveryCommand: z.string().optional().describe("Optional recovery command to run after restoring checkpoint and before retrying"),
  }),
  tier: PermissionTier.TIER_1, // Tier 1: Workspace writes / edits
};

interface StepRow {
  status: string;
  retry_count: number;
}

export async function executeStepHandler(args: {
  workflowId: string;
  stepId: string;
  executionCommand: string;
  validationCommand: string;
  maxRetries: number;
  recoveryCommand?: string;
}): Promise<{
  success: boolean;
  status?: string;
  stepId?: string;
  summary?: string;
  retryCount?: number;
  logId?: string;
  error?: string;
  reason?: string;
}> {
  const db = getDb();

  // 1. Verify step exists and is runnable (pending, running, failed, or requires_confirmation)
  const step = db.prepare(`
    SELECT status, retry_count FROM workflow_steps
    WHERE id = ? AND workflow_id = ?
  `).get(args.stepId, args.workflowId) as StepRow | undefined;

  if (!step) {
    return {
      success: false,
      error: "step_not_found",
      reason: `Step '${args.stepId}' not found in workflow '${args.workflowId}'`,
    };
  }

  if (step.status === StepStatus.COMPLETED) {
    return {
      success: true,
      status: StepStatus.COMPLETED,
      stepId: args.stepId,
      retryCount: step.retry_count,
      summary: "Step already completed",
    };
  }

  // DAG readiness: pending steps must be runnable; retries/resumes need deps completed.
  const pendingRunnable = getRunnableSteps(args.workflowId).includes(args.stepId);
  const retryOrResume =
    step.status === StepStatus.REQUIRES_CONFIRMATION ||
    step.status === StepStatus.FAILED ||
    step.status === StepStatus.RUNNING;

  if (step.status === StepStatus.PENDING && !pendingRunnable) {
    return {
      success: false,
      error: "dependencies_unmet",
      reason: `Step '${args.stepId}' is not runnable; unmet dependencies`,
    };
  }

  if (retryOrResume && !areStepDependenciesMet(args.workflowId, args.stepId)) {
    return {
      success: false,
      error: "dependencies_unmet",
      reason: `Step '${args.stepId}' dependencies are not completed`,
    };
  }

  if (
    step.status !== StepStatus.PENDING &&
    !retryOrResume
  ) {
    return {
      success: false,
      error: "dependencies_unmet",
      reason: `Step '${args.stepId}' status '${step.status}' is not executable`,
    };
  }

  // Set active step ID and workflow ID context
  config.activeStepId = args.stepId;
  config.activeWorkflowId = args.workflowId;

  // Isolate work onto ccathome/<workflowId> before mutating the workspace
  try {
    await ensureBranchIsolation(args.workflowId);
  } catch (err: any) {
    config.activeStepId = undefined;
    config.activeWorkflowId = undefined;
    return {
      success: false,
      error: "branch_isolation_failed",
      reason: err.message,
    };
  }

  // Set step status to running
  db.prepare(`
    UPDATE workflow_steps SET status = ? WHERE id = ?
  `).run(StepStatus.RUNNING, args.stepId);

  let attemptLogs = "";
  let success = false;
  let attempt = 0;

  try {
    while (attempt <= args.maxRetries) {
      attempt++;
      attemptLogs += `=== Attempt ${attempt} ===\n`;

      // A. Pre-execution Checkpoint
      const cpRes = await checkpointHandler({ workflowStepId: args.stepId });
      if (!cpRes.success) {
        attemptLogs += `Checkpoint failed: ${cpRes.reason}\n`;
        break;
      }
      const checkpointId = cpRes.checkpointId!;

      // B. Run Execution Command
      attemptLogs += `Running execution: ${args.executionCommand}\n`;
      const execRes = await runCommandGated(args.executionCommand);
      attemptLogs += `Execution Exit Code: ${execRes.exitCode}\n`;
      attemptLogs += `Execution Stdout:\n${execRes.stdout}\n`;
      attemptLogs += `Execution Stderr:\n${execRes.stderr}\n\n`;

      // C. Run Validation Command only after a successful execution exit
      if (execRes.exitCode !== 0) {
        attemptLogs += `Execution failed with exit code ${execRes.exitCode}.\n`;
      } else {
        attemptLogs += `Running validation: ${args.validationCommand}\n`;
        const valRes = await runCommandGated(args.validationCommand);
        attemptLogs += `Validation Exit Code: ${valRes.exitCode}\n`;
        attemptLogs += `Validation Stdout:\n${valRes.stdout}\n`;
        attemptLogs += `Validation Stderr:\n${valRes.stderr}\n\n`;

        if (valRes.exitCode === 0) {
          success = true;
          break;
        }
      }

      // D. Execution or validation failed: Rollback state to checkpoint
      if (attempt <= args.maxRetries) {
        attemptLogs += `Attempt failed. Restoring checkpoint ${checkpointId}...\n`;
        const restoreRes = await restoreCheckpointHandler({ checkpointId });
        if (!restoreRes.success) {
          attemptLogs += `Restore checkpoint failed: ${restoreRes.reason}\n`;
          break;
        }

        // E. Run recovery command if provided
        if (args.recoveryCommand) {
          attemptLogs += `Running recovery command: ${args.recoveryCommand}\n`;
          const recRes = await runCommandGated(args.recoveryCommand);
          attemptLogs += `Recovery Exit Code: ${recRes.exitCode}\n`;
          attemptLogs += `Recovery Stdout:\n${recRes.stdout}\n`;
          attemptLogs += `Recovery Stderr:\n${recRes.stderr}\n\n`;
          if (recRes.exitCode !== 0) {
            attemptLogs += "Recovery command failed; aborting retry loop.\n";
            break;
          }
        }
      } else {
        attemptLogs += `Attempt failed and max retries (${args.maxRetries}) reached.\n`;
      }
    }
  } catch (err: any) {
    if (err instanceof RequiresConfirmationError) {
      attemptLogs += `Step paused: requires user confirmation for command: '${err.command}'\n`;
      const retryCount = Math.max(0, attempt - 1);

      db.prepare(`
        UPDATE workflow_steps
        SET status = ?, retry_count = ?, full_log = ?, summary = ?
        WHERE id = ?
      `).run(
        StepStatus.REQUIRES_CONFIRMATION,
        retryCount,
        attemptLogs,
        buildSummary(attemptLogs),
        args.stepId
      );

      db.prepare(`
        UPDATE workflows SET status = ? WHERE id = ?
      `).run(WorkflowStatus.REQUIRES_CONFIRMATION, args.workflowId);

      config.activeStepId = undefined;
      config.activeWorkflowId = undefined;

      const summary = buildSummary(attemptLogs);
      const logId = persistAttemptLog(attemptLogs);

      return {
        success: false,
        status: StepStatus.REQUIRES_CONFIRMATION,
        stepId: args.stepId,
        summary,
        retryCount,
        logId,
        error: StepStatus.REQUIRES_CONFIRMATION,
        reason: `Command requires confirmation: '${err.command}'`,
      };
    }

    config.activeStepId = undefined;
    config.activeWorkflowId = undefined;
    throw err;
  }

  // Auto-commit successful workspace mutations on the isolated branch
  if (success) {
    try {
      const statusRes = await runGit(["status", "--porcelain"]);
      if (statusRes.stdout.trim()) {
        attemptLogs += "Auto-committing workspace changes...\n";
        const addRes = await runGit(["add", "-A"], "git add -A");
        if (addRes.exitCode !== 0) {
          success = false;
          attemptLogs += `Auto-commit staging failed: ${addRes.stderr}\n`;
        } else {
          const message = `[ccathome-auto] step ${args.stepId} completed`;
          const commitRes = await runGit(["commit", "-m", message]);
          if (commitRes.exitCode !== 0) {
            success = false;
            attemptLogs += `Auto-commit failed: ${commitRes.stderr || commitRes.stdout}\n`;
          } else {
            attemptLogs += `Auto-commit created: ${message}\n`;
          }
        }
      } else {
        attemptLogs += "Auto-commit skipped: no workspace changes\n";
      }
    } catch (err: any) {
      success = false;
      attemptLogs += `Auto-commit failed: ${err.message}\n`;
    }
  }

  config.activeStepId = undefined;
  config.activeWorkflowId = undefined;

  const finalStatus = success ? StepStatus.COMPLETED : StepStatus.FAILED;
  const retryCount = attempt - 1;

  // Update DB state
  const summary = buildSummary(attemptLogs);
  db.prepare(`
    UPDATE workflow_steps
    SET status = ?, retry_count = ?, full_log = ?, summary = ?
    WHERE id = ?
  `).run(finalStatus, retryCount, attemptLogs, summary, args.stepId);

  // If the entire workflow has finished or failed, we can update workflow status.
  // We'll query if any steps are still failed or running.
  const allSteps = db.prepare(`
    SELECT status FROM workflow_steps WHERE workflow_id = ?
  `).all(args.workflowId) as { status: string }[];

  let wfStatus: WorkflowStatus = WorkflowStatus.RUNNING;
  if (allSteps.every((s) => s.status === StepStatus.COMPLETED)) {
    wfStatus = WorkflowStatus.COMPLETED;
  } else if (allSteps.some((s) => s.status === StepStatus.FAILED)) {
    wfStatus = WorkflowStatus.FAILED;
  }

  db.prepare(`
    UPDATE workflows SET status = ? WHERE id = ?
  `).run(wfStatus, args.workflowId);

  const logId = persistAttemptLog(attemptLogs);

  return {
    success,
    status: finalStatus,
    stepId: args.stepId,
    summary,
    retryCount,
    logId,
  };
}
