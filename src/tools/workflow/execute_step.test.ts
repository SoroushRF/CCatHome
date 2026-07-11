import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { config } from "../../core/config.js";
import { getDb, closeDb } from "../../core/db.js";
import { registerCapability, clearRegistry } from "../../core/router.js";
import { invoke } from "../../core/dispatcher.js";
import { runCommandGated } from "../../core/process-runner.js";
import { saveWorkflow } from "../../core/workflow-engine.js";
import { executeStepDefinition, executeStepHandler } from "./execute_step.js";
import { checkpointDefinition, checkpointHandler } from "../checkpoint/checkpoint.js";
import { restoreCheckpointDefinition, restoreCheckpointHandler } from "../checkpoint/restore_checkpoint.js";
import { approveCommandForTests } from "../../test/approve-command.js";

const TEST_DIR = path.resolve(config.workspaceRoot, "temp_execute_step_test");

describe("Execute Step Compound Loop Suite", () => {
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

    // Write a dummy file to commit
    fs.writeFileSync(path.join(TEST_DIR, "dummy.txt"), "dummy\n", "utf-8");
    await runCommandGated("git add dummy.txt");
    await runCommandGated("git commit -m \"Initial commit\"");

    // Register capabilities
    registerCapability(executeStepDefinition, executeStepHandler);
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

  it("should run successful step on first attempt", async () => {
    // 1. Create a dummy workflow in database
    const steps = [{ id: "step1", title: "Verify compiler version" }];
    saveWorkflow("wf1", "Compiler Check", steps);

    // 2. Write execution and validation scripts
    fs.writeFileSync(path.join(TEST_DIR, "exec.js"), "console.log('compiling...');", "utf-8");
    fs.writeFileSync(path.join(TEST_DIR, "check.js"), "process.exit(0);", "utf-8");

    // 3. Execute step
    approveCommandForTests("node exec.js", "step1");
    approveCommandForTests("node check.js", "step1");
    const res = await invoke("execute_step", {
      workflowId: "wf1",
      stepId: "step1",
      executionCommand: "node exec.js",
      validationCommand: "node check.js",
      maxRetries: 3,
    });

    expect(res.success).toBe(true);
    expect(res.result.success).toBe(true);
    expect(res.result.status).toBe("completed");
    expect(res.result.retryCount).toBe(0);

    // Verify DB states
    const db = getDb();
    const stepRow = db.prepare("SELECT status, retry_count, full_log FROM workflow_steps WHERE id = 'step1'").get() as any;
    expect(stepRow.status).toBe("completed");
    expect(stepRow.retry_count).toBe(0);
    expect(stepRow.full_log).toContain("=== Attempt 1 ===");
    expect(stepRow.full_log).toContain("Execution Exit Code: 0");
    expect(stepRow.full_log).toContain("Validation Exit Code: 0");

    const branch = await runCommandGated("git branch --show-current");
    expect(branch.stdout.trim()).toBe("ccathome/wf1");
  });

  it("should auto-commit workspace changes with [ccathome-auto] on success", async () => {
    saveWorkflow("wf-auto", "Auto Commit", [{ id: "stepAuto", title: "Write file" }]);

    fs.writeFileSync(
      path.join(TEST_DIR, "exec.js"),
      `import fs from 'fs'; fs.writeFileSync('out.txt', 'done', 'utf-8');`,
      "utf-8"
    );
    fs.writeFileSync(path.join(TEST_DIR, "check.js"), "process.exit(0);", "utf-8");

    approveCommandForTests("node exec.js", "stepAuto");
    approveCommandForTests("node check.js", "stepAuto");
    const res = await invoke("execute_step", {
      workflowId: "wf-auto",
      stepId: "stepAuto",
      executionCommand: "node exec.js",
      validationCommand: "node check.js",
      maxRetries: 0,
    });

    expect(res.result.success).toBe(true);
    const logRes = await runCommandGated("git log -n 1 --pretty=format:%s");
    expect(logRes.stdout.trim()).toBe("[ccathome-auto] step stepAuto completed");
  });

  it("should perform recovery and succeed on attempt 2 (auto-fix micro-loop)", async () => {
    const steps = [{ id: "step2", title: "Format project files" }];
    saveWorkflow("wf2", "Formatter Workflow", steps);

    // execution script
    fs.writeFileSync(path.join(TEST_DIR, "exec.js"), "console.log('running build');", "utf-8");

    // validation script checks for existence of 'fixed.txt'
    fs.writeFileSync(path.join(TEST_DIR, "check.js"), `
      import fs from 'fs';
      if (fs.existsSync('fixed.txt')) {
        process.exit(0);
      } else {
        process.exit(1);
      }
    `, "utf-8");

    // recovery script creates 'fixed.txt'
    fs.writeFileSync(path.join(TEST_DIR, "recover.js"), `
      import fs from 'fs';
      fs.writeFileSync('fixed.txt', 'recovered', 'utf-8');
    `, "utf-8");

    // Execute step
    approveCommandForTests("node exec.js", "step2");
    approveCommandForTests("node check.js", "step2");
    approveCommandForTests("node recover.js", "step2");
    const res = await invoke("execute_step", {
      workflowId: "wf2",
      stepId: "step2",
      executionCommand: "node exec.js",
      validationCommand: "node check.js",
      maxRetries: 2,
      recoveryCommand: "node recover.js",
    });

    expect(res.success).toBe(true);
    expect(res.result.success).toBe(true);
    expect(res.result.status).toBe("completed");
    expect(res.result.retryCount).toBe(1);

    // Verify database log content
    const db = getDb();
    const stepRow = db.prepare("SELECT status, retry_count, full_log FROM workflow_steps WHERE id = 'step2'").get() as any;
    expect(stepRow.status).toBe("completed");
    expect(stepRow.retry_count).toBe(1);
    expect(stepRow.full_log).toContain("=== Attempt 1 ===");
    expect(stepRow.full_log).toContain("Validation Exit Code: 1");
    expect(stepRow.full_log).toContain("Running recovery command: node recover.js");
    expect(stepRow.full_log).toContain("=== Attempt 2 ===");
    expect(stepRow.full_log).toContain("Validation Exit Code: 0");
  });

  it("should refuse steps whose DAG dependencies are unmet", async () => {
    saveWorkflow("wf-dag", "DAG Guard", [
      { id: "root", title: "Root" },
      { id: "child", title: "Child", depends_on: ["root"] },
    ]);

    fs.writeFileSync(path.join(TEST_DIR, "exec.js"), "console.log('noop');", "utf-8");
    fs.writeFileSync(path.join(TEST_DIR, "check.js"), "process.exit(0);", "utf-8");

    approveCommandForTests("node exec.js", "child");
    approveCommandForTests("node check.js", "child");
    const res = await invoke("execute_step", {
      workflowId: "wf-dag",
      stepId: "child",
      executionCommand: "node exec.js",
      validationCommand: "node check.js",
      maxRetries: 0,
    });

    expect(res.success).toBe(true);
    expect(res.result.success).toBe(false);
    expect(res.result.error).toBe("dependencies_unmet");

    const db = getDb();
    const stepRow = db
      .prepare("SELECT status FROM workflow_steps WHERE id = 'child'")
      .get() as { status: string };
    expect(stepRow.status).toBe("pending");
  });

  it("should not auto-commit when the step fails validation", async () => {
    saveWorkflow("wf-fail-nc", "No Commit Fail", [{ id: "stepFail", title: "Fail" }]);
    fs.writeFileSync(
      path.join(TEST_DIR, "exec.js"),
      `import fs from 'fs'; fs.writeFileSync('fail-out.txt', 'x', 'utf-8');`,
      "utf-8"
    );
    fs.writeFileSync(path.join(TEST_DIR, "check.js"), "process.exit(1);", "utf-8");

    approveCommandForTests("node exec.js", "stepFail");
    approveCommandForTests("node check.js", "stepFail");
    const before = await runCommandGated("git rev-parse HEAD");
    const res = await invoke("execute_step", {
      workflowId: "wf-fail-nc",
      stepId: "stepFail",
      executionCommand: "node exec.js",
      validationCommand: "node check.js",
      maxRetries: 0,
    });

    expect(res.result.success).toBe(false);
    expect(res.result.status).toBe("failed");
    const after = await runCommandGated("git rev-parse HEAD");
    expect(after.stdout.trim()).toBe(before.stdout.trim());
    const log = await runCommandGated("git log -n 1 --pretty=format:%s");
    expect(log.stdout.trim()).not.toContain("[ccathome-auto]");
  });

  it("should not auto-commit when paused for confirmation", async () => {
    saveWorkflow("wf-pause-nc", "No Commit Pause", [{ id: "stepPause", title: "Push" }]);
    const before = await runCommandGated("git rev-parse HEAD");
    const res = await invoke("execute_step", {
      workflowId: "wf-pause-nc",
      stepId: "stepPause",
      executionCommand: "git push",
      validationCommand: "node -e \"process.exit(0)\"",
      maxRetries: 0,
    });

    expect(res.result.status).toBe("requires_confirmation");
    const after = await runCommandGated("git rev-parse HEAD");
    expect(after.stdout.trim()).toBe(before.stdout.trim());
  });

  it("should fail step and record log when max retries exceeded", async () => {
    const steps = [{ id: "step3", title: "Deploy application" }];
    saveWorkflow("wf3", "Deploy Workflow", steps);

    fs.writeFileSync(path.join(TEST_DIR, "exec.js"), "console.log('deploying');", "utf-8");
    fs.writeFileSync(path.join(TEST_DIR, "check.js"), "process.exit(1);", "utf-8"); // always fails

    approveCommandForTests("node exec.js", "step3");
    approveCommandForTests("node check.js", "step3");
    const res = await invoke("execute_step", {
      workflowId: "wf3",
      stepId: "step3",
      executionCommand: "node exec.js",
      validationCommand: "node check.js",
      maxRetries: 2,
    });

    expect(res.success).toBe(true);
    expect(res.result.success).toBe(false);
    expect(res.result.status).toBe("failed");
    expect(res.result.retryCount).toBe(2);

    const db = getDb();
    const stepRow = db.prepare("SELECT status, retry_count, full_log FROM workflow_steps WHERE id = 'step3'").get() as any;
    expect(stepRow.status).toBe("failed");
    expect(stepRow.retry_count).toBe(2);
    expect(stepRow.full_log).toContain("=== Attempt 3 ===");
    expect(stepRow.full_log).toContain("Validation failed and max retries (2) reached.");
  });
});
