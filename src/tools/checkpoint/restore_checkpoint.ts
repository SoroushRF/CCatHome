import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import { PermissionTier, CapabilityName } from "../../core/constants.js";
import { CapabilityDefinition } from "../../core/router.js";
import { runCommandUngated } from "../../core/process-runner.js";
import { getDb } from "../../core/db.js";
import { config } from "../../core/config.js";
import { resolveSafePath } from "../../core/path-utils.js";

export const restoreCheckpointDefinition: CapabilityDefinition = {
  name: CapabilityName.RESTORE_CHECKPOINT,
  description: "Restores the workspace git and file state to a previously saved checkpoint.",
  inputSchema: z.object({
    checkpointId: z.string().describe("The ID of the checkpoint to restore"),
  }),
  tier: PermissionTier.TIER_1, // Tier 1: Workspace writes / edits
};

interface CheckpointDbRow {
  id: string;
  workflow_step_id: string | null;
  git_sha: string;
  backup_meta: string;
}

export async function restoreCheckpointHandler(args: {
  checkpointId: string;
}): Promise<{
  success: boolean;
  error?: string;
  reason?: string;
}> {
  const db = getDb();

  try {
    // 1. Retrieve checkpoint metadata
    const row = db.prepare(`
      SELECT id, workflow_step_id, git_sha, backup_meta
      FROM checkpoints
      WHERE id = ?
    `).get(args.checkpointId) as CheckpointDbRow | undefined;

    if (!row) {
      return {
        success: false,
        error: "checkpoint_not_found",
        reason: `No checkpoint found with ID ${args.checkpointId}`,
      };
    }

    const gitSha = row.git_sha;
    const backupMeta = JSON.parse(row.backup_meta) as {
      originalPath: string;
      backupPath: string;
      isUntracked: boolean;
      isDeleted: boolean;
    }[];

    // 2. Hard reset git to the saved SHA
    const resetRes = await runCommandUngated(`git reset --hard ${gitSha}`);
    if (resetRes.exitCode !== 0) {
      return {
        success: false,
        error: "git_reset_failed",
        reason: `Failed to hard reset to SHA ${gitSha}: ${resetRes.stderr}`,
      };
    }

    // 3. Clean untracked files, excluding system metadata and skills folders
    const cleanRes = await runCommandUngated("git clean -fd -e .ccathome -e .agents -e .agent");
    if (cleanRes.exitCode !== 0) {
      return {
        success: false,
        error: "git_clean_failed",
        reason: `Failed to clean untracked files: ${cleanRes.stderr}`,
      };
    }

    // 4. Restore files recorded in backup metadata
    for (const item of backupMeta) {
      let targetPath: string;
      try {
        targetPath = resolveSafePath(config.workspaceRoot, item.originalPath);
      } catch (_err) {
        // Skip paths escaping workspace root
        continue;
      }

      if (item.isDeleted) {
        if (fs.existsSync(targetPath)) {
          fs.rmSync(targetPath, { force: true });
        }
      } else {
        const backupFullPath = path.join(config.workspaceRoot, item.backupPath);
        if (fs.existsSync(backupFullPath)) {
          fs.mkdirSync(path.dirname(targetPath), { recursive: true });
          fs.copyFileSync(backupFullPath, targetPath);
        }
      }
    }

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: "restore_failed",
      reason: err.message,
    };
  }
}
