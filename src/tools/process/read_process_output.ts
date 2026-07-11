import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import { PermissionTier, CapabilityName } from "../../core/constants.js";
import { CapabilityDefinition } from "../../core/router.js";
import { getProcess } from "../../core/process-registry.js";
import { config } from "../../core/config.js";
import { resolveSafePath } from "../../core/path-utils.js";

export const readProcessOutputDefinition: CapabilityDefinition = {
  name: CapabilityName.READ_PROCESS_OUTPUT,
  description: "Reads new output lines from a background process's log file.",
  inputSchema: z.object({
    pid: z.number().int().describe("The process ID (pid) of the active background process"),
    fromLine: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe("Optional 1-indexed line offset to start reading from"),
  }),
  tier: PermissionTier.TIER_0, // Tier 0: Always allowed reads
};

export async function readProcessOutputHandler(args: { pid: number; fromLine?: number }): Promise<{
  success: boolean;
  lines?: string[];
  nextLineOffset?: number;
  exited?: boolean;
  error?: string;
  reason?: string;
}> {
  const activeProc = getProcess(args.pid);
  if (!activeProc) {
    return {
      success: false,
      error: "process_not_found",
      reason: `No active background process tracked with pid ${args.pid}`,
      exited: true,
    };
  }

  const logPath = activeProc.logPath;
  try {
    const rel = path.relative(config.workspaceRoot, logPath);
    resolveSafePath(config.workspaceRoot, rel);
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
      error: "log_file_not_found",
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

  const fromIdx = args.fromLine ? args.fromLine - 1 : 0;
  const slicedLines = lines.slice(fromIdx);

  // Check if process has exited
  let hasExited = false;
  try {
    // sending signal 0 checks if process is alive
    process.kill(activeProc.pid, 0);
  } catch (_e) {
    hasExited = true;
  }

  return {
    success: true,
    lines: slicedLines,
    nextLineOffset: lines.length + 1,
    exited: hasExited,
  };
}
