import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import { PermissionTier, CapabilityName } from "../../core/constants.js";
import { CapabilityDefinition } from "../../core/router.js";
import { resolveSafePath } from "../../core/path-utils.js";
import { assertNotSensitiveWorkspacePath } from "../../core/sensitive-paths.js";
import { config } from "../../core/config.js";

export const moveFileDefinition: CapabilityDefinition = {
  name: CapabilityName.MOVE_FILE,
  description: "Renames or moves a file or directory within the workspace.",
  inputSchema: z.object({
    source: z.string().describe("Relative path of the source file/directory"),
    destination: z.string().describe("Relative path of the target destination"),
  }),
  tier: PermissionTier.TIER_1, // Tier 1: Workspace writes
};

export async function moveFileHandler(args: { source: string; destination: string }): Promise<{
  success: boolean;
  error?: string;
  reason?: string;
}> {
  let sourcePath: string;
  let destPath: string;

  try {
    sourcePath = resolveSafePath(config.workspaceRoot, args.source);
    destPath = resolveSafePath(config.workspaceRoot, args.destination);
    assertNotSensitiveWorkspacePath(destPath);
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

  if (!fs.existsSync(sourcePath)) {
    return {
      success: false,
      error: "source_not_found",
      reason: `Source file or directory at '${args.source}' does not exist`,
    };
  }

  try {
    // Create destination parent directories if they don't exist
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.renameSync(sourcePath, destPath);
  } catch (err: any) {
    return {
      success: false,
      error: "move_failed",
      reason: err.message,
    };
  }

  return {
    success: true,
  };
}
