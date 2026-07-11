import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { config } from "../../core/config.js";
import { closeDb } from "../../core/db.js";
import { clearRegistry } from "../../core/router.js";
import { runCommandGated } from "../../core/process-runner.js";
import { initGitRepoForTests } from "../../test/init-git-repo.js";
import { checkpointHandler } from "./checkpoint.js";
import { restoreCheckpointHandler } from "./restore_checkpoint.js";

const TEST_DIR = path.resolve(config.workspaceRoot, "temp_checkpoint_test");

describe("Checkpoint & Rollback Subsystem Suite", () => {
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
    try {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    } catch (_e) {
      // ignore
    }

    // Initialize clean git repository
    await initGitRepoForTests({
      email: "test@ccathome.com",
      name: "Test CCatHome",
    });

    // Write initial source file
    fs.writeFileSync(path.join(TEST_DIR, "file1.txt"), "original content 1\n", "utf-8");
    fs.writeFileSync(path.join(TEST_DIR, "file2.txt"), "original content 2\n", "utf-8");
    await runCommandGated("git add file1.txt file2.txt");
    await runCommandGated('git commit -m "Initial commit"');

    // Handlers are engine-internal (ADR 0010) — call directly, do not register.
  });

  afterEach(async () => {
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
    const cpRes = await checkpointHandler({});
    expect(cpRes.success).toBe(true);
    const checkpointId = cpRes.checkpointId;
    expect(checkpointId).toBeDefined();

    // 3. Make additional post-checkpoint changes (corruptions)
    fs.writeFileSync(path.join(TEST_DIR, "file1.txt"), "corrupted content\n", "utf-8");
    fs.writeFileSync(path.join(TEST_DIR, "untracked.txt"), "corrupted untracked\n", "utf-8");
    fs.writeFileSync(path.join(TEST_DIR, "newfile.txt"), "extra file\n", "utf-8");

    // 4. Restore Checkpoint
    const restoreRes = await restoreCheckpointHandler({ checkpointId });
    expect(restoreRes.success).toBe(true);

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

  it("should checkpoint untracked directories and fail restore when backup missing", async () => {
    const dir = path.join(TEST_DIR, "untracked_dir");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "nested.txt"), "nested\n", "utf-8");

    const cpRes = await checkpointHandler({});
    expect(cpRes.success).toBe(true);
    const checkpointId = cpRes.checkpointId;

    // Corrupt backup metadata path to force missing backup
    const dbPath = path.join(TEST_DIR, ".ccathome", "ccathome.db");
    expect(fs.existsSync(dbPath)).toBe(true);
    const { getDb } = await import("../../core/db.js");
    const db = getDb();
    const row = db
      .prepare("SELECT backup_meta FROM checkpoints WHERE id = ?")
      .get(checkpointId) as { backup_meta: string };
    const meta = JSON.parse(row.backup_meta);
    if (meta[0]) {
      meta[0].backupPath = ".ccathome/backups/checkpoints/missing/nope.txt";
      db.prepare("UPDATE checkpoints SET backup_meta = ? WHERE id = ?").run(
        JSON.stringify(meta),
        checkpointId,
      );
    }

    const restoreRes = await restoreCheckpointHandler({ checkpointId });
    expect(restoreRes.success).toBe(false);
    expect(restoreRes.error).toBe("backup_missing");
  });

  describe("restore_checkpoint failure contracts (R7.2.5)", () => {
    it("returns checkpoint_not_found for unknown ids", async () => {
      const res = await restoreCheckpointHandler({
        checkpointId: "00000000-0000-0000-0000-000000000000",
      });
      expect(res.success).toBe(false);
      expect(res.error).toBe("checkpoint_not_found");
    });

    it("returns git_reset_failed when HEAD is not a valid git repo state", async () => {
      const cpRes = await checkpointHandler({});
      const checkpointId = cpRes.checkpointId!;
      // Destroy .git so reset cannot succeed
      fs.rmSync(path.join(TEST_DIR, ".git"), { recursive: true, force: true });
      const restoreRes = await restoreCheckpointHandler({ checkpointId });
      expect(restoreRes.success).toBe(false);
      expect(["git_reset_failed", "restore_failed"]).toContain(restoreRes.error);
    });
  });
});
