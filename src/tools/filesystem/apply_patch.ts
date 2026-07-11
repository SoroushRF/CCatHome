import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { z } from "zod";
import { PermissionTier, CapabilityName } from "../../core/constants.js";
import { CapabilityDefinition } from "../../core/router.js";
import { resolveSafePath } from "../../core/path-utils.js";
import { assertNotSensitiveWorkspacePath } from "../../core/sensitive-paths.js";
import { config } from "../../core/config.js";
import { parsePatch, applyPatchToContent } from "../../core/patch.js";

export const applyPatchDefinition: CapabilityDefinition = {
  name: CapabilityName.APPLY_PATCH,
  description: "Applies a unified diff patch to a file. Backs up the original before writing.",
  inputSchema: z.object({
    path: z.string().describe("Path to the file to patch (resolved relative to workspace root)"),
    patch: z.string().describe("The unified diff patch content to apply"),
    expectedSha: z
      .string()
      .optional()
      .describe("Expected SHA-256 hash of the target file before patching"),
  }),
  tier: PermissionTier.TIER_1, // Tier 1: Workspace writes
};

function getSha256(content: string): string {
  return crypto.createHash("sha256").update(content, "utf-8").digest("hex");
}

export async function applyPatchHandler(args: {
  path: string;
  patch: string;
  expectedSha?: string;
}): Promise<{
  success: boolean;
  appliedHunks?: number;
  newSha?: string;
  error?: string;
  currentSha?: string;
  reason?: string;
}> {
  let targetPath: string;
  try {
    targetPath = resolveSafePath(config.workspaceRoot, args.path);
    assertNotSensitiveWorkspacePath(targetPath);
  } catch (err: any) {
    const msg = err.message || String(err);
    if (msg.startsWith("sensitive_path_blocked")) {
      return {
        success: false,
        error: "sensitive_path_blocked",
        reason: msg,
      };
    }
    return {
      success: false,
      error: "invalid_path",
      reason: msg,
    };
  }

  // 1. Read existing content
  let originalContent = "";
  let exists = false;
  try {
    if (fs.existsSync(targetPath)) {
      originalContent = fs.readFileSync(targetPath, "utf-8");
      exists = true;
    }
  } catch (err: any) {
    return {
      success: false,
      error: "read_failed",
      reason: err.message,
    };
  }

  const currentSha = getSha256(originalContent);

  // 2. Verify expectedSha if provided
  if (args.expectedSha && currentSha !== args.expectedSha) {
    return {
      success: false,
      error: "sha_mismatch",
      currentSha,
      reason: `Expected file SHA-256 was ${args.expectedSha} but current is ${currentSha}`,
    };
  }

  // 3. Parse Patch
  let hunks;
  try {
    hunks = parsePatch(args.patch);
    if (hunks.length === 0) {
      throw new Error("No valid unified diff hunks found in patch");
    }
  } catch (err: any) {
    return {
      success: false,
      error: "patch_failed",
      currentSha,
      reason: `Parse error: ${err.message}`,
    };
  }

  // 4. Create Backup if file exists
  const ccathomeDir = path.join(config.workspaceRoot, ".ccathome");
  const backupsDir = path.join(ccathomeDir, "backups");
  const tempDir = path.join(ccathomeDir, "temp");

  try {
    fs.mkdirSync(backupsDir, { recursive: true });
    fs.mkdirSync(tempDir, { recursive: true });

    if (exists) {
      const backupPath = path.join(backupsDir, `${currentSha}.bak`);
      fs.writeFileSync(backupPath, originalContent, "utf-8");
    }
  } catch (err: any) {
    return {
      success: false,
      error: "backup_failed",
      currentSha,
      reason: `Failed to create backup: ${err.message}`,
    };
  }

  // 5. Apply Patch to a temporary file
  let patchedContent: string;
  try {
    patchedContent = applyPatchToContent(originalContent, hunks);
  } catch (err: any) {
    return {
      success: false,
      error: "patch_failed",
      currentSha,
      reason: err.message,
    };
  }

  const tempFilePath = path.join(tempDir, `temp_${crypto.randomBytes(8).toString("hex")}.tmp`);
  try {
    fs.writeFileSync(tempFilePath, patchedContent, "utf-8");
  } catch (err: any) {
    // Clean up temp file just in case
    try {
      fs.unlinkSync(tempFilePath);
    } catch (_e) {
      // ignore unlink error
    }
    return {
      success: false,
      error: "write_failed",
      currentSha,
      reason: `Failed to write temp file: ${err.message}`,
    };
  }

  // 6. Atomic rename temp file to target
  // Re-resolve immediately before rename to reduce symlink TOCTOU window (residual race remains).
  try {
    targetPath = resolveSafePath(config.workspaceRoot, args.path);
    assertNotSensitiveWorkspacePath(targetPath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.renameSync(tempFilePath, targetPath);
  } catch (err: any) {
    try {
      fs.unlinkSync(tempFilePath);
    } catch (_e) {
      // ignore unlink error
    }
    return {
      success: false,
      error: "write_failed",
      currentSha,
      reason: `Atomic rename failed: ${err.message}`,
    };
  }

  return {
    success: true,
    appliedHunks: hunks.length,
    newSha: getSha256(patchedContent),
  };
}
