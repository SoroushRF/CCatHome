import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { registerCapability, clearRegistry } from "../core/router.js";
import { invoke } from "../core/dispatcher.js";
import { config } from "../core/config.js";
import { runCommandGated } from "../core/process-runner.js";
import { ensureBranchIsolation } from "../core/git-utils.js";
import { applyPatchDefinition, applyPatchHandler } from "./filesystem/apply_patch.js";
import { runCommandDefinition, runCommandHandler } from "./process/run_command.js";
import { gitCommitDefinition, gitCommitHandler } from "./git/git_commit.js";
import { gitDiffDefinition, gitDiffHandler } from "./git/git_diff.js";

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
    } catch (_err) {}

    // Initialize clean git repository in integration directory
    await runCommandGated("git init");
    await runCommandGated("git config user.email \"gate@ccathome.com\"");
    await runCommandGated("git config user.name \"Gate CCatHome\"");
    await runCommandGated("git checkout -b main");

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
    await runCommandGated("git commit -m \"Initial calculator commit\"");

    // Register capabilities
    registerCapability(applyPatchDefinition, applyPatchHandler);
    registerCapability(runCommandDefinition, runCommandHandler);
    registerCapability(gitCommitDefinition, gitCommitHandler);
    registerCapability(gitDiffDefinition, gitDiffHandler);
  });

  afterEach(async () => {
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
    const runRes = await invoke("run_command", {
      command: `node -e "import('./src/calculator.mjs').then(m => { console.log('RESULT=' + m.add(5, 7)); })"`,
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
    await runCommandGated("git checkout main");
    const mainContent = fs.readFileSync(path.join(TEST_DIR, "src", "calculator.mjs"), "utf-8");
    expect(mainContent).toContain("return a - b;"); // Still has the bug in main!
  });
});
