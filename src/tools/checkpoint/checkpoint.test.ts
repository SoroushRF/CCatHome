import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { config } from "../../core/config.js";
import { getDb, closeDb } from "../../core/db.js";
import { registerCapability, clearRegistry } from "../../core/router.js";
import { invoke } from "../../core/dispatcher.js";
import { runCommandGated } from "../../core/process-runner.js";
import { checkpointDefinition, checkpointHandler } from "./checkpoint.js";
import { restoreCheckpointDefinition, restoreCheckpointHandler } from "./restore_checkpoint.js";

const TEST_DIR = path.resolve(config.workspaceRoot, "temp_checkpoint_test");

describe("Checkpoint & Rollback Subsystem Suite", () => {
  beforeEach(async () => {
    clearRegistry();
    config.workspaceRoot = TEST_DIR;
    if (fs.existsSync(TEST_DIR)) {
      try {
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
      } catch (_e) {}
    }
    try {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    } catch (_e) {}

    // Initialize clean git repository
    await runCommandGated("git init");
    await runCommandGated("git config user.email \"test@ccathome.com\"");
    await runCommandGated("git config user.name \"Test CCatHome\"");
    await runCommandGated("git checkout -b main");

    // Write initial source file
    fs.writeFileSync(path.join(TEST_DIR, "file1.txt"), "original content 1\n", "utf-8");
    fs.writeFileSync(path.join(TEST_DIR, "file2.txt"), "original content 2\n", "utf-8");
    await runCommandGated("git add file1.txt file2.txt");
    await runCommandGated("git commit -m \"Initial commit\"");

    // Register checkpoint capabilities
    registerCapability(checkpointDefinition, checkpointHandler);
    registerCapability(restoreCheckpointDefinition, restoreCheckpointHandler);
  });

  afterEach(async () => {
    closeDb();
    if (fs.existsSync(TEST_DIR)) {
      try {
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
      } catch (_e) {}
    }
    config.workspaceRoot = process.cwd();
  });

  it("should snapshot uncommitted changes and restore them exactly", async () => {
    // 1. Make modifications (modified tracked, untracked, deleted)
    fs.writeFileSync(path.join(TEST_DIR, "file1.txt"), "modified content 1\n", "utf-8"); // modified
    fs.writeFileSync(path.join(TEST_DIR, "untracked.txt"), "new untracked file\n", "utf-8"); // untracked
    fs.rmSync(path.join(TEST_DIR, "file2.txt")); // deleted

    // Verify git status shows dirty working directory
    const gitStatusBefore = await runCommandGated("git status --porcelain");
    expect(gitStatusBefore.stdout).toContain("M file1.txt");
    expect(gitStatusBefore.stdout).toContain("?? untracked.txt");
    expect(gitStatusBefore.stdout).toContain("D file2.txt");

    // 2. Take Checkpoint
    const cpRes = await invoke("checkpoint", {});
    expect(cpRes.success).toBe(true);
    const checkpointId = cpRes.result.checkpointId;
    expect(checkpointId).toBeDefined();

    // 3. Make additional post-checkpoint changes (corruptions)
    fs.writeFileSync(path.join(TEST_DIR, "file1.txt"), "corrupted content\n", "utf-8");
    fs.writeFileSync(path.join(TEST_DIR, "untracked.txt"), "corrupted untracked\n", "utf-8");
    fs.writeFileSync(path.join(TEST_DIR, "newfile.txt"), "extra file\n", "utf-8");

    // 4. Restore Checkpoint
    const restoreRes = await invoke("restore_checkpoint", { checkpointId });
    expect(restoreRes.success).toBe(true);
    expect(restoreRes.result.success).toBe(true);

    // 5. Assertions: check byte-for-byte pre-checkpoint state has been restored
    const content1 = fs.readFileSync(path.join(TEST_DIR, "file1.txt"), "utf-8");
    expect(content1).toBe("modified content 1\n");

    const contentUntracked = fs.readFileSync(path.join(TEST_DIR, "untracked.txt"), "utf-8");
    expect(contentUntracked).toBe("new untracked file\n");

    // file2.txt should remain deleted (because it was deleted before the checkpoint)
    expect(fs.existsSync(path.join(TEST_DIR, "file2.txt"))).toBe(false);

    // newfile.txt should be completely gone (cleaned by git clean -fd)
    expect(fs.existsSync(path.join(TEST_DIR, "newfile.txt"))).toBe(false);

    // Verify git status is back to pre-checkpoint porcelain state
    const gitStatusAfter = await runCommandGated("git status --porcelain");
    expect(gitStatusAfter.stdout).toContain("M file1.txt");
    expect(gitStatusAfter.stdout).toContain("?? untracked.txt");
    expect(gitStatusAfter.stdout).toContain("D file2.txt");
  });
});
