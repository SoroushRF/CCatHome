import * as fs from "fs";
import { z } from "zod";
import { PermissionTier, CapabilityName } from "../../core/constants.js";
import { CapabilityDefinition } from "../../core/router.js";
import { resolveSafePath } from "../../core/path-utils.js";
import { config } from "../../core/config.js";

export const readFileSectionDefinition: CapabilityDefinition = {
  name: CapabilityName.READ_FILE_SECTION,
  description: "Reads a specific range of lines from a file (1-indexed, inclusive).",
  inputSchema: z.object({
    path: z.string().describe("Path to the file (resolved relative to workspace root)"),
    start: z.number().int().min(1).describe("Start line number (1-indexed, inclusive)"),
    end: z.number().int().min(1).describe("End line number (1-indexed, inclusive)"),
  }),
  tier: PermissionTier.TIER_0, // Tier 0: Always allowed reads
};

export async function readFileSectionHandler(args: {
  path: string;
  start: number;
  end: number;
}): Promise<{
  success: boolean;
  lines?: string[];
  totalLines?: number;
  error?: string;
  reason?: string;
}> {
  let targetPath: string;
  try {
    targetPath = resolveSafePath(config.workspaceRoot, args.path);
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
      error: "file_not_found",
      reason: `File at '${args.path}' does not exist`,
    };
  }

  let content: string;
  try {
    content = fs.readFileSync(targetPath, "utf-8");
  } catch (err: any) {
    return {
      success: false,
      error: "read_failed",
      reason: err.message,
    };
  }

  const fileLines = content.split(/\r?\n/);
  const startIdx = args.start - 1;
  const endIdx = Math.min(args.end, fileLines.length);

  if (startIdx >= fileLines.length || startIdx > endIdx) {
    return {
      success: false,
      error: "invalid_range",
      reason: `Requested start line ${args.start} exceeds total file lines ${fileLines.length}`,
    };
  }

  const selectedLines = fileLines.slice(startIdx, endIdx);

  return {
    success: true,
    lines: selectedLines,
    totalLines: fileLines.length,
  };
}
