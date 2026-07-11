import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { config } from "../../core/config.js";
import { closeDb, getDb } from "../../core/db.js";
import { registerCapability, clearRegistry } from "../../core/router.js";
import { invoke } from "../../core/dispatcher.js";
import { runCommandGated } from "../../core/process-runner.js";
import { createWorkflowDefinition, createWorkflowHandler } from "../workflow/create_workflow.js";
import { executeStepDefinition, executeStepHandler } from "../workflow/execute_step.js";
import { checkpointDefinition, checkpointHandler } from "../checkpoint/checkpoint.js";
import { restoreCheckpointDefinition, restoreCheckpointHandler } from "../checkpoint/restore_checkpoint.js";
import { startDashboardServer, stopDashboardServer } from "../../core/dashboard-server.js";
import { approveCommandForTests } from "../../test/approve-command.js";
import { ConfirmationStatus } from "../../core/constants.js";

const TEST_DIR = path.resolve(process.cwd(), "temp_hitl_integration");

describe("HITL dashboard approve → resume execute_step", () => {
  beforeEach(async () => {
    clearRegistry();
    closeDb();
    config.workspaceRoot = TEST_DIR;
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_DIR, { recursive: true });

    await runCommandGated("git init");
    await runCommandGated("git config user.email \"hitl@ccathome.com\"");
    await runCommandGated("git config user.name \"HITL\"");
    await runCommandGated("git checkout -b main");
    fs.writeFileSync(path.join(TEST_DIR, "dummy.txt"), "hello\n", "utf-8");
    await runCommandGated("git add dummy.txt");
    await runCommandGated("git commit -m \"init\"");

    registerCapability(createWorkflowDefinition, createWorkflowHandler);
    registerCapability(executeStepDefinition, executeStepHandler);
    registerCapability(checkpointDefinition, checkpointHandler);
    registerCapability(restoreCheckpointDefinition, restoreCheckpointHandler);
  });

  afterEach(() => {
    stopDashboardServer();
    closeDb();
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
    config.workspaceRoot = process.cwd();
  });

  it("pauses on Tier 2, approves via dashboard API, resumes", async () => {
    const port = 3155;
    const { token } = await startDashboardServer(port);

    const wfRes = await invoke("create_workflow", {
      name: "HITL E2E",
      steps: [{ id: "stepA", title: "Push" }],
    });
    const workflowId = wfRes.result.workflowId;

    const paused = await invoke("execute_step", {
      workflowId,
      stepId: "stepA",
      executionCommand: "git push",
      validationCommand: "true",
      maxRetries: 0,
    });
    expect(paused.result.status).toBe("requires_confirmation");

    const pending = getDb()
      .prepare(
        "SELECT id, status FROM pending_confirmations WHERE step_id = ? AND status = ?"
      )
      .get("stepA", ConfirmationStatus.PENDING) as { id: string; status: string };
    expect(pending).toBeDefined();

    const approveRes = await fetch(
      `http://localhost:${port}/api/confirmations/${pending.id}/approve?token=${token}`,
      { method: "POST" }
    );
    expect(approveRes.status).toBe(200);

    const validationCommand = "node -e \"process.exit(0)\"";
    approveCommandForTests(validationCommand, "stepA");
    // Re-grant push approval (single-use consumed on first pause attempt already used? 
    // Pause threw before consume — approval via dashboard set approved; resume consumes it.
    const resume = await invoke("execute_step", {
      workflowId,
      stepId: "stepA",
      executionCommand: "git push",
      validationCommand,
      maxRetries: 0,
    });

    expect(resume.result.status).toBe("failed");
    expect(resume.result.success).toBe(false);
  });
});
