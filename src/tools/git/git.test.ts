import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { registerCapability, clearRegistry } from "../../core/router.js";
import { invoke } from "../../core/dispatcher.js";
import { config } from "../../core/config.js";
import { runCommandGated } from "../../core/process-runner.js";
import { ensureBranchIsolation } from "../../core/git-utils.js";
import { closeDb } from "../../core/db.js";
import { gitDiffDefinition, gitDiffHandler } from "./git_diff.js";
import { gitCommitDefinition, gitCommitHandler } from "./git_commit.js";
import { gitBranchDefinition, gitBranchHandler } from "./git_branch.js";
import { gitCheckoutDefinition, gitCheckoutHandler } from "./git_checkout.js";

const TEST_DIR = path.resolve(config.workspaceRoot, "temp_git_test");

describe("Git Capabilities Suite", () => {
  beforeEach(async () => {
    closeDb();
    clearRegistry();
    config.workspaceRoot = TEST_DIR;

    if (fs.existsSync(TEST_DIR)) {
      try {
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
      } catch (_err) {
        // Ignore EPERM
      }
    }
    try {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    } catch (_err) {
      // Ignore if exists
    }

    // Initialize temporary git repo in the test directory
    await initGitRepoForTests({
      email: "test@ccathome.com",
      name: "Test CCatHome",
    });

    // Create a commit so HEAD exists (otherwise many git tools fail)
    fs.writeFileSync(path.join(TEST_DIR, "init.txt"), "hello", "utf-8");
    await runCommandGated("git add init.txt");
    await runCommandGated('git commit -m "Initial commit"');

    // Register capabilities
    registerCapability(gitDiffDefinition, gitDiffHandler);
    registerCapability(gitCommitDefinition, gitCommitHandler);
    registerCapability(gitBranchDefinition, gitBranchHandler);
    registerCapability(gitCheckoutDefinition, gitCheckoutHandler);
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

  it("should ensure branch-isolation correctly", async () => {
    // Current branch is main
    const branchBefore = await runCommandGated("git branch --show-current");
    expect(branchBefore.stdout.trim()).toBe("main");

    // Trigger branch isolation
    const isolatedBranch = await ensureBranchIsolation("wf123");
    expect(isolatedBranch).toBe("ccathome/wf123");

    // Current branch should now be the isolated branch
    const branchAfter = await runCommandGated("git branch --show-current");
    expect(branchAfter.stdout.trim()).toBe("ccathome/wf123");
  });

  it("should show diffs and make commits", async () => {
    // Make changes
    fs.writeFileSync(path.join(TEST_DIR, "init.txt"), "modified hello", "utf-8");

    // Check git_diff
    const diffRes = await invoke("git_diff", {});
    expect(diffRes.success).toBe(true);
    expect(diffRes.result.diff).toContain("-hello");
    expect(diffRes.result.diff).toContain("+modified hello");

    // Stage changes
    await runCommandGated("git add init.txt");

    // Commit changes
    const commitRes = await invoke("git_commit", { message: "docs: update init.txt" });
    expect(commitRes.success).toBe(true);
    expect(commitRes.result.sha).toBeDefined();

    // Verify commit log
    const logRes = await runCommandGated("git log -n 1 --pretty=format:%s");
    expect(logRes.stdout.trim()).toBe("docs: update init.txt");
  });

  it("should block amending auto-commits", async () => {
    // Create an auto-commit
    fs.writeFileSync(path.join(TEST_DIR, "init.txt"), "auto modification", "utf-8");
    await runCommandGated("git add init.txt");
    await runCommandGated('git commit -m "[ccathome-auto] step completed"');

    // Attempt to amend via git_commit capability
    const res = await invoke("git_commit", {
      message: "attempted amend",
      amend: true,
    });

    expect(res.result.success).toBe(false);
    expect(res.result.error).toBe("amend_conflicts_with_autocommit");
  });

  it("should branch and checkout successfully", async () => {
    // Create branch
    const branchRes = await invoke("git_branch", { name: "feature-test" });
    expect(branchRes.success).toBe(true);

    // List branches
    const listRes = await invoke("git_branch", { list: true });
    expect(listRes.success).toBe(true);
    expect(listRes.result.branches).toContain("feature-test");

    // Checkout branch
    const checkoutRes = await invoke("git_checkout", { branch: "feature-test" });
    expect(checkoutRes.success).toBe(true);

    const showRes = await runCommandGated("git branch --show-current");
    expect(showRes.stdout.trim()).toBe("feature-test");
  });
});
