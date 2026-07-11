import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import { PermissionTier, CapabilityName } from "../../core/constants.js";
import { CapabilityDefinition } from "../../core/router.js";
import { config } from "../../core/config.js";
import { resolveSafePath } from "../../core/path-utils.js";

export const expandLogDefinition: CapabilityDefinition = {
  name: CapabilityName.EXPAND_LOG,
  description: "Expands the full execution log for a command or task run by logId.",
  inputSchema: z.object({
    logId: z.string().describe("The log identifier (logId) returned by run_command"),
    fromLine: z.number().int().min(1).optional().describe("Optional 1-indexed start line to read"),
    toLine: z.number().int().min(1).optional().describe("Optional 1-indexed end line to read"),
  }),
  tier: PermissionTier.TIER_0, // Tier 0: Always allowed reads
};

const HEX_LOG_ID = /^[a-f0-9]+$/i;

export async function expandLogHandler(args: {
  logId: string;
  fromLine?: number;
  toLine?: number;
}): Promise<{
  success: boolean;
  lines?: string[];
  totalLines?: number;
  error?: string;
  reason?: string;
}> {
  if (!HEX_LOG_ID.test(args.logId)) {
    return {
      success: false,
      error: "invalid_log_id",
      reason: "logId must be a hexadecimal string",
    };
  }

  let logPath: string;
  try {
    logPath = resolveSafePath(
      config.workspaceRoot,
      path.join(".ccathome", "logs", `cmd_${args.logId}.log`),
    );
  } catch (err: any) {
    return {
      success: false,
      error: "invalid_path",
      reason: err.message,
    };
  }

  if (!fs.existsSync(logPath)) {
    return {
      success: false,
      error: "log_not_found",
      reason: `Log file at ${logPath} does not exist`,
    };
  }

  let content = "";
  try {
    content = fs.readFileSync(logPath, "utf-8");
  } catch (err: any) {
    return {
      success: false,
      error: "read_failed",
      reason: err.message,
    };
  }

  const lines = content.split(/\r?\n/);
  // Remove last empty element if it was a trailing newline split
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  const startIdx = args.fromLine ? args.fromLine - 1 : 0;
  const endIdx = args.toLine ? Math.min(args.toLine, lines.length) : lines.length;

  if (startIdx >= lines.length || startIdx > endIdx) {
    return {
      success: false,
      error: "invalid_range",
      reason: `Requested start line ${args.fromLine || 1} exceeds total log lines ${lines.length}`,
    };
  }

  const selectedLines = lines.slice(startIdx, endIdx);

  return {
    success: true,
    lines: selectedLines,
    totalLines: lines.length,
  };
}
