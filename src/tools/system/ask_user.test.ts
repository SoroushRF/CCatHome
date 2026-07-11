import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { config } from "../../core/config.js";
import { getDb, closeDb } from "../../core/db.js";
import { registerCapability, clearRegistry } from "../../core/router.js";
import { invoke } from "../../core/dispatcher.js";
import { runCommandGated } from "../../core/process-runner.js";
import { createWorkflowDefinition, createWorkflowHandler } from "../workflow/create_workflow.js";
import { executeStepDefinition, executeStepHandler } from "../workflow/execute_step.js";
import { askUserDefinition, askUserHandler } from "./ask_user.js";
import { checkpointDefinition, checkpointHandler } from "../checkpoint/checkpoint.js";
import { restoreCheckpointDefinition, restoreCheckpointHandler } from "../checkpoint/restore_checkpoint.js";
import { approveCommandForTests } from "../../test/approve-command.js";

const TEST_DIR = path.resolve(process.cwd(), "temp_ask_user_test");

describe("Human-in-the-Loop Confirmation Suite (Step 3.2)", () => {
  beforeEach(async () => {
    clearRegistry();
    config.workspaceRoot = TEST_DIR;

    if (fs.existsSync(TEST_DIR)) {
      try {
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
      } catch (_e) {
        // ignore
      }
    }
    fs.mkdirSync(TEST_DIR, { recursive: true });

    // Initialize git
    await runCommandGated("git init");
    await runCommandGated("git config user.email \"test@ccathome.com\"");
    await runCommandGated("git config user.name \"Test CCatHome\"");
    await runCommandGated("git checkout -b main");
    
    // Create first commit to have a valid git HEAD
    fs.writeFileSync(path.join(TEST_DIR, "dummy.txt"), "hello\n", "utf-8");
    await runCommandGated("git add dummy.txt");
    await runCommandGated("git commit -m \"Initial commit\"");

    // Register capabilities
    registerCapability(createWorkflowDefinition, createWorkflowHandler);
    registerCapability(executeStepDefinition, executeStepHandler);
    registerCapability(askUserDefinition, askUserHandler);
    registerCapability(checkpointDefinition, checkpointHandler);
    registerCapability(restoreCheckpointDefinition, restoreCheckpointHandler);
  });

  afterEach(() => {
    closeDb();
    if (fs.existsSync(TEST_DIR)) {
      try {
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
      } catch (_e) {
        // ignore
      }
    }
    config.workspaceRoot = process.cwd();
  });

  it("should pause workflow execution when encountering a Tier 2 command, and resume on approval", async () => {
    // 1. Create a workflow
    const wfRes = await invoke("create_workflow", {
      name: "Gated workflow test",
      steps: [
        { id: "stepA", title: "Push production branch" }
      ]
    });
    expect(wfRes.success).toBe(true);
    const workflowId = wfRes.result.workflowId;

    // 2. Run execute_step targeting "git push", which is classified as Tier 2 in permission-rules.json
    // Validation is a simple echo. Since git push is Tier 2, the loop should pause.
    const execRes = await invoke("execute_step", {
      workflowId,
      stepId: "stepA",
      executionCommand: "git push",
      validationCommand: "node -e \"process.exit(0)\"",
      maxRetries: 1
    });

    expect(execRes.success).toBe(true);
    expect(execRes.result.success).toBe(false);
    expect(execRes.result.status).toBe("requires_confirmation");
    expect(execRes.result.error).toBe("requires_confirmation");

    // 3. Verify Database Status is updated
    const db = getDb();
    const stepRow = db.prepare("SELECT status FROM workflow_steps WHERE id = 'stepA'").get() as any;
    expect(stepRow.status).toBe("requires_confirmation");

    const wfRow = db.prepare("SELECT status FROM workflows WHERE id = ?").get(workflowId) as any;
    expect(wfRow.status).toBe("requires_confirmation");

    // 4. Verify a pending confirmation record exists
    const confirmation = db.prepare("SELECT command, status FROM pending_confirmations WHERE step_id = 'stepA'").get() as any;
    expect(confirmation).toBeDefined();
    expect(confirmation.command).toBe("git push");
    expect(confirmation.status).toBe("pending");

    // 5. Approve the command via ask_user
    const approvalRes = await invoke("ask_user", {
      type: "permission",
      command: "git push",
      response: "approved"
    });
    expect(approvalRes.success).toBe(true);
    expect(approvalRes.result.success).toBe(true);

    // Verify confirmation updated in database
    const approvedConfirmation = db.prepare("SELECT status FROM pending_confirmations WHERE step_id = 'stepA'").get() as any;
    expect(approvedConfirmation.status).toBe("approved");

    // Verify step status was updated back to 'running'
    const stepRowApproved = db.prepare("SELECT status FROM workflow_steps WHERE id = 'stepA'").get() as any;
    expect(stepRowApproved.status).toBe("running");

    // 6. Resume execute_step
    const validationCommand = "node -e \"process.exit(0)\"";
    approveCommandForTests(validationCommand, "stepA");
    const resumeRes = await invoke("execute_step", {
      workflowId,
      stepId: "stepA",
      executionCommand: "git push", // should execute now since it is approved
      validationCommand,
      maxRetries: 1
    });

    expect(resumeRes.success).toBe(true);
    // Since "git push" runs now, it will fail with exit code 128 (No configured destination),
    // and since validation checks return exit code 0, the step will still be completed successfully!
    expect(resumeRes.result.success).toBe(true);
    expect(resumeRes.result.status).toBe("completed");
  });
});
