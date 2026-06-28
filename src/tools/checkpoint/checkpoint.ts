import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { z } from "zod";
import { PermissionTier, CapabilityName } from "../../core/constants.js";
import { CapabilityDefinition } from "../../core/router.js";
import { runCommandGated } from "../../core/process-runner.js";
import { getDb } from "../../core/db.js";
import { config } from "../../core/config.js";
import { resolveSafePath } from "../../core/path-utils.js";

export const checkpointDefinition: CapabilityDefinition = {
  name: CapabilityName.CHECKPOINT,
  description: "Creates a restorable snapshot of git state and uncommitted/untracked files.",
  inputSchema: z.object({
    workflowStepId: z.string().optional().describe("Optional workflow step ID to associate with this checkpoint"),
  }),
  tier: PermissionTier.TIER_1, // Tier 1: Workspace writes / edits
};

export async function checkpointHandler(args: {
  workflowStepId?: string;
}): Promise<{
  success: boolean;
  checkpointId?: string;
  gitSha?: string;
  error?: string;
  reason?: string;
}> {
  const db = getDb();
  const checkpointId = crypto.randomBytes(8).toString("hex");

  try {
    // 1. Get current git SHA
    const shaRes = await runCommandGated("git rev-parse HEAD");
    if (shaRes.exitCode !== 0) {
      return {
        success: false,
        error: "git_failed",
        reason: `Could not retrieve git HEAD SHA: ${shaRes.stderr}`,
      };
    }
    const gitSha = shaRes.stdout.trim();

    // 2. Scan for uncommitted (modified, deleted, staged, untracked) files
    const statusRes = await runCommandGated("git status --porcelain");
    if (statusRes.exitCode !== 0) {
      return {
        success: false,
        error: "git_failed",
        reason: `Could not retrieve git status: ${statusRes.stderr}`,
      };
    }

    const backupMeta: {
      originalPath: string;
      backupPath: string;
      isUntracked: boolean;
      isDeleted: boolean;
    }[] = [];

    const lines = statusRes.stdout.split(/\r?\n/).filter(line => line.trim().length > 0);
    const checkpointBackupsDir = path.join(config.workspaceRoot, ".ccathome", "backups", "checkpoints", checkpointId);

    for (const line of lines) {
      const code = line.slice(0, 2);
      const relativePath = line.slice(2).trim().replace(/^"|"$/g, ""); // strip git quotes if present
      
      const isUntracked = code.includes("??");
      const isDeleted = code.includes("D");

      // Skip system/metadata/dependencies directories
      if (
        relativePath.startsWith(".ccathome/") ||
        relativePath.startsWith(".git/") ||
        relativePath.startsWith(".agents/") ||
        relativePath.startsWith(".agent/") ||
        relativePath.startsWith("node_modules/") ||
        relativePath === ".ccathome" ||
        relativePath === ".git" ||
        relativePath === ".agents" ||
        relativePath === ".agent" ||
        relativePath === "node_modules"
      ) {
        continue;
      }

      // Resolve safe path
      let absolutePath: string;
      try {
        absolutePath = resolveSafePath(config.workspaceRoot, relativePath);
      } catch (_err) {
        // Skip paths escaping workspace root
        continue;
      }

      if (isDeleted) {
        backupMeta.push({
          originalPath: relativePath,
          backupPath: "",
          isUntracked: false,
          isDeleted: true,
        });
      } else {
        // Copy file to backup folder
        const backupFilePath = path.join(checkpointBackupsDir, relativePath);
        fs.mkdirSync(path.dirname(backupFilePath), { recursive: true });
        
        if (fs.existsSync(absolutePath)) {
          fs.copyFileSync(absolutePath, backupFilePath);
          backupMeta.push({
            originalPath: relativePath,
            backupPath: path.relative(config.workspaceRoot, backupFilePath),
            isUntracked,
            isDeleted: false,
          });
        }
      }
    }

    // 3. Save to database
    db.prepare(`
      INSERT INTO checkpoints (id, workflow_step_id, git_sha, backup_meta)
      VALUES (?, ?, ?, ?)
    `).run(checkpointId, args.workflowStepId || null, gitSha, JSON.stringify(backupMeta));

    return {
      success: true,
      checkpointId,
      gitSha,
    };
  } catch (err: any) {
    return {
      success: false,
      error: "checkpoint_failed",
      reason: err.message,
    };
  }
}
