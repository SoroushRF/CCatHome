import { approveCommandForTests } from "../test/approve-command.js";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { registerCapability, clearRegistry } from "../core/router.js";
import { invoke } from "../core/dispatcher.js";
import { config } from "../core/config.js";
import { runCommandGated } from "../core/process-runner.js";
import { initGitRepoForTests } from "../test/init-git-repo.js";
import { ensureBranchIsolation } from "../core/git-utils.js";
import { applyPatchDefinition, applyPatchHandler } from "./filesystem/apply_patch.js";
import { runCommandDefinition, runCommandHandler } from "./process/run_command.js";
import { gitCommitDefinition, gitCommitHandler } from "./git/git_commit.js";
import { gitDiffDefinition, gitDiffHandler } from "./git/git_diff.js";
import { checkpointDefinition, checkpointHandler } from "./checkpoint/checkpoint.js";
import {
  restoreCheckpointDefinition,
  restoreCheckpointHandler,
} from "./checkpoint/restore_checkpoint.js";
import { createWorkflowDefinition, createWorkflowHandler } from "./workflow/create_workflow.js";
import {
  getWorkflowStateDefinition,
  getWorkflowStateHandler,
} from "./workflow/get_workflow_state.js";
import { executeStepDefinition, executeStepHandler } from "./workflow/execute_step.js";
import { rememberDefinition, rememberHandler } from "./memory/remember.js";
import { recallDefinition, recallHandler } from "./memory/recall.js";
import { runScriptDefinition, runScriptHandler } from "./process/run_script.js";
import { closeDb, getDb } from "../core/db.js";

const TEST_DIR = path.resolve(config.workspaceRoot, "temp_integration_gate");

describe("Phase 1 Integration Gate (End-to-End)", () => {
  beforeEach(async () => {
    clearRegistry();
    config.workspaceRoot = TEST_DIR;

    if (fs.existsSync(TEST_DIR)) {
      try {
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
      } catch (_err) {
        // Ignore Windows transient EPERM
      }
    }
    try {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    } catch (_err) {
      // Ignore if exists
    }

    // Initialize clean git repository in integration directory
    await initGitRepoForTests({
      email: "gate@ccathome.com",
      name: "Gate CCatHome",
    });

    // Write initial source file
    const srcDir = path.join(TEST_DIR, "src");
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, "calculator.mjs"),
      `export function add(a, b) {
  return a - b; // Logical bug: subtraction instead of addition
}`,
      "utf-8",
    );

    // Initial commit
    await runCommandGated("git add src/calculator.mjs");
    await runCommandGated('git commit -m "Initial calculator commit"');

    // Register capabilities
    registerCapability(applyPatchDefinition, applyPatchHandler);
    registerCapability(runCommandDefinition, runCommandHandler);
    registerCapability(gitCommitDefinition, gitCommitHandler);
    registerCapability(gitDiffDefinition, gitDiffHandler);
  });

  afterEach(async () => {
    closeDb();
    if (fs.existsSync(TEST_DIR)) {
      try {
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
      } catch (_err) {
        // Ignore Windows transient EPERM
      }
    }
    config.workspaceRoot = process.cwd();
  });

  it("should execute: branch isolation -> patch -> verify/run command -> commit", async () => {
    // 1. Ensure isolated branch is active (ensureBranchIsolation)
    const activeBranch = await ensureBranchIsolation("wf-gate-e2e");
    expect(activeBranch).toBe("ccathome/wf-gate-e2e");

    // Verify current branch in git
    const showBranch = await runCommandGated("git branch --show-current");
    expect(showBranch.stdout.trim()).toBe("ccathome/wf-gate-e2e");

    // 2. Apply patch to fix the bug (apply_patch)
    const patch = `
@@ -1,3 +1,3 @@
 export function add(a, b) {
-  return a - b; // Logical bug: subtraction instead of addition
+  return a + b; // Fixed: subtraction replaced with addition
 }
`;
    const patchRes = await invoke("apply_patch", {
      path: "src/calculator.mjs",
      patch,
    });
    expect(patchRes.success).toBe(true);
    expect(patchRes.result.success).toBe(true);

    // 3. Verify changes with a command (run_command)
    // Run an inline Node command to test calculator output
    const runCmd = `node -e "import('./src/calculator.mjs').then(m => { console.log('RESULT=' + m.add(5, 7)); })"`;
    approveCommandForTests(runCmd);
    const runRes = await invoke("run_command", {
      command: runCmd,
    });
    expect(runRes.success).toBe(true);
    expect(runRes.result.status).toBe("exited");
    expect(runRes.result.exitCode).toBe(0);
    expect(runRes.result.stdout).toContain("RESULT=12"); // 5 + 7 = 12

    // 4. Commit successful changes (git_commit)
    await runCommandGated("git add src/calculator.mjs");
    const commitRes = await invoke("git_commit", {
      message: "feat: fix addition logical bug in calculator",
    });
    expect(commitRes.success).toBe(true);
    expect(commitRes.result.success).toBe(true);
    expect(commitRes.result.sha).toBeDefined();

    // Verify main branch remains at the initial commit state (isolation holds)
    approveCommandForTests("git checkout main");
    await runCommandGated("git checkout main");
    const mainContent = fs.readFileSync(path.join(TEST_DIR, "src", "calculator.mjs"), "utf-8");
    expect(mainContent).toContain("return a - b;"); // Still has the bug in main!
  });
});

describe("Phase 2 Integration Gate (End-to-End)", () => {
  beforeEach(async () => {
    closeDb();
    clearRegistry();
    config.workspaceRoot = TEST_DIR;

    if (fs.existsSync(TEST_DIR)) {
      try {
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
      } catch (_err) {
        // Ignore Windows transient EPERM
      }
    }
    try {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    } catch (_err) {
      // ignore
    }

    // Initialize clean git repository in integration directory
    await initGitRepoForTests({
      email: "gate2@ccathome.com",
      name: "Gate2 CCatHome",
    });

    // Write initial source file
    const srcDir = path.join(TEST_DIR, "src");
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, "calculator.mjs"),
      `export function add(a, b) {
  return a - b; // bug
}`,
      "utf-8",
    );

    // Initial commit
    await runCommandGated("git add src/calculator.mjs");
    await runCommandGated('git commit -m "Initial calculator commit"');

    // Register all Phase 2 capabilities
    registerCapability(applyPatchDefinition, applyPatchHandler);
    registerCapability(runCommandDefinition, runCommandHandler);
    registerCapability(gitCommitDefinition, gitCommitHandler);
    registerCapability(gitDiffDefinition, gitDiffHandler);
    registerCapability(checkpointDefinition, checkpointHandler);
    registerCapability(restoreCheckpointDefinition, restoreCheckpointHandler);
    registerCapability(createWorkflowDefinition, createWorkflowHandler);
    registerCapability(getWorkflowStateDefinition, getWorkflowStateHandler);
    registerCapability(executeStepDefinition, executeStepHandler);
    registerCapability(rememberDefinition, rememberHandler);
    registerCapability(recallDefinition, recallHandler);
    registerCapability(runScriptDefinition, runScriptHandler);
  });

  afterEach(async () => {
    closeDb();
    if (fs.existsSync(TEST_DIR)) {
      try {
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
      } catch (_err) {
        // Ignore Windows transient EPERM
      }
    }
    config.workspaceRoot = process.cwd();
  });

  it("should run the full E2E pipeline: create workflow -> execute step with failure recovery -> remember and recall logs", async () => {
    // 1. Create a memory rule
    const rememberRes = await invoke("remember", {
      content:
        "Auto-fix loops must perform at least one validation check after recovery scripts execute.",
      tags: ["pipeline", "validation"],
    });
    expect(rememberRes.success).toBe(true);

    // 2. Create the multi-step workflow in SQLite
    const steps = [
      { id: "stepA", title: "Compile code and checks" },
      { id: "stepB", title: "Apply patch and run auto-fix validations", depends_on: ["stepA"] },
    ];
    const wfRes = await invoke("create_workflow", {
      name: "E2E Compiler fixes",
      steps,
    });
    expect(wfRes.success).toBe(true);
    expect(wfRes.result.success).toBe(true);
    const workflowId = wfRes.result.workflowId;
    expect(workflowId).toBeDefined();

    // 3. Blocked dependent step must fail with dependencies_unmet before Step A completes
    const blockedRes = await invoke("execute_step", {
      workflowId,
      stepId: "stepB",
      executionCommand: "node -e \"console.log('should not run')\"",
      validationCommand: 'node -e "process.exit(0)"',
      maxRetries: 0,
    });
    expect(blockedRes.success).toBe(true);
    expect(blockedRes.result.success).toBe(false);
    expect(blockedRes.result.error).toBe("dependencies_unmet");

    // Complete Step A to unlock Step B (setup for recovery path below)
    const db = getDb();
    db.prepare("UPDATE workflow_steps SET status = 'completed' WHERE id = 'stepA'").run();

    // 4. Set up files for Step B validation failure recovery
    // Validation script check.js checks for presence of fixed file content
    fs.writeFileSync(
      path.join(TEST_DIR, "check.js"),
      `
      import fs from 'fs';
      const code = fs.readFileSync('src/calculator.mjs', 'utf-8');
      if (code.includes('a + b')) {
        process.exit(0);
      } else {
        process.exit(1);
      }
    `,
      "utf-8",
    );

    // Recovery script recover.js applies a patch to fix the file
    fs.writeFileSync(
      path.join(TEST_DIR, "recover.js"),
      `
      import fs from 'fs';
      const patch = 'export function add(a, b) {\\n  return a + b; // fixed\\n}';
      fs.writeFileSync('src/calculator.mjs', patch, 'utf-8');
    `,
      "utf-8",
    );

    // 5. Execute Step B using execute_step (auto-fix micro-loop)
    // Execution command just runs print, validation checks calculator content, recovery fixes it.
    const execCmd = "node -e \"console.log('running checks')\"";
    approveCommandForTests(execCmd, "stepB");
    approveCommandForTests("node check.js", "stepB");
    approveCommandForTests("node recover.js", "stepB");
    const execStepRes = await invoke("execute_step", {
      workflowId,
      stepId: "stepB",
      executionCommand: execCmd,
      validationCommand: "node check.js",
      maxRetries: 2,
      recoveryCommand: "node recover.js",
    });

    expect(execStepRes.success).toBe(true);
    expect(execStepRes.result.success).toBe(true);
    expect(execStepRes.result.status).toBe("completed");
    expect(execStepRes.result.retryCount).toBe(1); // validation failed on attempt 1, succeeded on attempt 2 after recovery!
    expect(execStepRes.result.summary).toBeDefined();
    expect(execStepRes.result.logId).toMatch(/^[a-f0-9]+$/);

    const branch = await runCommandGated("git branch --show-current");
    expect(branch.stdout.trim()).toBe(`ccathome/${workflowId}`);
    const autoMsg = await runCommandGated("git log -n 1 --pretty=format:%s");
    expect(autoMsg.stdout.trim()).toBe("[ccathome-auto] step stepB completed");

    // Verify DB states: workflow completed
    const stepRow = db
      .prepare("SELECT status, retry_count, full_log FROM workflow_steps WHERE id = 'stepB'")
      .get() as any;
    expect(stepRow.status).toBe("completed");
    expect(stepRow.retry_count).toBe(1);
    expect(stepRow.full_log).toContain("Validation Exit Code: 1");
    expect(stepRow.full_log).toContain("Running recovery command: node recover.js");
    expect(stepRow.full_log).toContain("Validation Exit Code: 0");

    const wfRow = db.prepare("SELECT status FROM workflows WHERE id = ?").get(workflowId) as any;
    expect(wfRow.status).toBe("completed");

    // 6. Recall memory from search index to verify FTS5 works E2E
    const recallRes = await invoke("recall", { query: "validation check auto-fix" });
    expect(recallRes.success).toBe(true);
    expect(recallRes.result.memories.length).toBeGreaterThanOrEqual(1);
    expect(recallRes.result.memories[0].content).toContain("Auto-fix loops");
  });
});
