import * as fs from "fs";
import * as crypto from "crypto";
import { z } from "zod";
import { PermissionTier, CapabilityName } from "../../core/constants.js";
import { CapabilityDefinition } from "../../core/router.js";
import { resolveSafePath } from "../../core/path-utils.js";
import { config } from "../../core/config.js";

export const readFileDefinition: CapabilityDefinition = {
  name: CapabilityName.READ_FILE,
  description: "Reads the content of a file. For files larger than 300 lines, returns a structure outline to manage context window pressure.",
  inputSchema: z.object({
    path: z.string().describe("Path to the file to read (resolved relative to workspace root)"),
  }),
  tier: PermissionTier.TIER_0, // Tier 0: Always allowed reads
};

export async function readFileHandler(args: {
  path: string;
}): Promise<{
  success: boolean;
  content?: string;
  outline?: string;
  totalLines?: number;
  fileId?: string;
  truncated?: boolean;
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

  const lines = content.split(/\r?\n/);
  if (lines.length <= 300) {
    return {
      success: true,
      content,
      truncated: false,
    };
  }

  // Generate Outline for large files
  const outlineLines: string[] = [];
  const declarationRegex = /^(import|export|class|function|interface|const\s+\w+|let\s+\w+|type\s+\w+|enum\s+\w+)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (declarationRegex.test(line)) {
      outlineLines.push(`Line ${i + 1}: ${lines[i]}`);
    }
  }

  const fileId = crypto.createHash("md5").update(content).digest("hex");

  return {
    success: true,
    truncated: true,
    fileId,
    totalLines: lines.length,
    outline: outlineLines.join("\n"),
  };
}
