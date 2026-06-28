import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import { PermissionTier, CapabilityName } from "../../core/constants.js";
import { CapabilityDefinition } from "../../core/router.js";
import { resolveSafePath } from "../../core/path-utils.js";
import { config } from "../../core/config.js";

export const listDirectoryDefinition: CapabilityDefinition = {
  name: CapabilityName.LIST_DIRECTORY,
  description: "Lists the contents of a directory in the workspace.",
  inputSchema: z.object({
    path: z.string().optional().describe("Path to the directory to list (resolved relative to workspace root)"),
  }),
  tier: PermissionTier.TIER_0, // Tier 0: Always allowed reads
};

interface DirectoryItem {
  name: string;
  type: "file" | "directory" | "other";
  size?: number;
}

export async function listDirectoryHandler(args: {
  path?: string;
}): Promise<{
  success: boolean;
  items?: DirectoryItem[];
  error?: string;
  reason?: string;
}> {
  let targetPath: string;
  try {
    targetPath = resolveSafePath(config.workspaceRoot, args.path || "");
  } catch (err: any) {
    return {
      success: false,
      error: "invalid_path",
      reason: err.message,
    };
  }

  if (!fs.existsSync(targetPath)) {
    return {
      success: false,
      error: "directory_not_found",
      reason: `Directory at '${args.path || ""}' does not exist`,
    };
  }

  let files: string[];
  try {
    files = fs.readdirSync(targetPath);
  } catch (err: any) {
    return {
      success: false,
      error: "read_failed",
      reason: err.message,
    };
  }

  const items: DirectoryItem[] = [];
  for (const file of files) {
    const fullPath = path.join(targetPath, file);
    try {
      const stat = fs.statSync(fullPath);
      let type: "file" | "directory" | "other" = "other";
      if (stat.isFile()) {
        type = "file";
      } else if (stat.isDirectory()) {
        type = "directory";
      }

      items.push({
        name: file,
        type,
        size: stat.isFile() ? stat.size : undefined,
      });
    } catch (_err) {
      items.push({ name: file, type: "other" });
    }
  }

  return {
    success: true,
    items,
  };
}
