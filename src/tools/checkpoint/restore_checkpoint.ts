import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import { PermissionTier, CapabilityName } from "../../core/constants.js";
import { CapabilityDefinition } from "../../core/router.js";
import { runArgvUngated } from "../../core/process-runner.js";
import { getDb } from "../../core/db.js";
import { config } from "../../core/config.js";
import { resolveSafePath } from "../../core/path-utils.js";
import { assertSafeGitRef } from "../../core/git-utils.js";

/**
 * Engine-internal restore. Not registered for agent invoke (ADR 0010).
 * Definition retained for documentation / direct-handler tests only.
 */
export const restoreCheckpointDefinition: CapabilityDefinition = {
  name: CapabilityName.RESTORE_CHECKPOINT,
  description:
    "Internal: restores workspace git and file state to a checkpoint. Not agent-callable.",
  inputSchema: z.object({
    checkpointId: z.string().describe("The ID of the checkpoint to restore"),
  }),
  tier: PermissionTier.TIER_1,
};

interface CheckpointDbRow {
  id: string;
  workflow_step_id: string | null;
  git_sha: string;
  backup_meta: string;
}

export async function restoreCheckpointHandler(args: { checkpointId: string }): Promise<{
  success: boolean;
  error?: string;
  reason?: string;
}> {
  const db = getDb();

  try {
    const row = db
      .prepare(
        `
      SELECT id, workflow_step_id, git_sha, backup_meta
      FROM checkpoints
      WHERE id = ?
    `,
      )
      .get(args.checkpointId) as CheckpointDbRow | undefined;

    if (!row) {
      return {
        success: false,
        error: "checkpoint_not_found",
        reason: `No checkpoint found with ID ${args.checkpointId}`,
      };
    }

    const gitSha = row.git_sha;
    try {
      assertSafeGitRef(gitSha, "sha");
    } catch (err: any) {
      return {
        success: false,
        error: "invalid_git_sha",
        reason: err.message,
      };
    }

    const backupMeta = JSON.parse(row.backup_meta) as {
      originalPath: string;
      backupPath: string;
      isUntracked: boolean;
      isDeleted: boolean;
    }[];

    // Argv-only ungated reset/clean — no shell interpolation (ADR 0010)
    const resetRes = await runArgvUngated("git", ["reset", "--hard", gitSha]);
    if (resetRes.exitCode !== 0) {
      return {
        success: false,
        error: "git_reset_failed",
        reason: `Failed to hard reset to SHA ${gitSha}: ${resetRes.stderr}`,
      };
    }

    const cleanRes = await runArgvUngated("git", [
      "clean",
      "-fd",
      "-e",
      ".ccathome",
      "-e",
      ".agents",
      "-e",
      ".agent",
    ]);
    if (cleanRes.exitCode !== 0) {
      return {
        success: false,
        error: "git_clean_failed",
        reason: `Failed to clean untracked files: ${cleanRes.stderr}`,
      };
    }

    for (const item of backupMeta) {
      let targetPath: string;
      try {
        targetPath = resolveSafePath(config.workspaceRoot, item.originalPath);
      } catch (_err) {
        continue;
      }

      if (item.isDeleted) {
        if (fs.existsSync(targetPath)) {
          fs.rmSync(targetPath, { force: true });
        }
      } else {
        let backupFullPath: string;
        try {
          backupFullPath = resolveSafePath(config.workspaceRoot, item.backupPath);
        } catch (_err) {
          return {
            success: false,
            error: "backup_path_escape",
            reason: `Backup path escapes workspace: '${item.backupPath}'`,
          };
        }
        if (!fs.existsSync(backupFullPath)) {
          return {
            success: false,
            error: "backup_missing",
            reason: `Missing backup for '${item.originalPath}' at '${item.backupPath}'`,
          };
        }
        const stat = fs.statSync(backupFullPath);
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        if (stat.isDirectory()) {
          fs.cpSync(backupFullPath, targetPath, { recursive: true });
        } else {
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
