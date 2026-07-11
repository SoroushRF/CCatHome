import { z } from "zod";
import { PermissionTier, CapabilityName, CommandStatus } from "../../core/constants.js";
import { CapabilityDefinition } from "../../core/router.js";
import { getProcess, removeProcess } from "../../core/process-registry.js";
import { getDb } from "../../core/db.js";

export const killProcessDefinition: CapabilityDefinition = {
  name: CapabilityName.KILL_PROCESS,
  description: "Terminates an active background process by pid.",
  inputSchema: z.object({
    pid: z.number().int().describe("The process ID (pid) of the background process to terminate"),
  }),
  tier: PermissionTier.TIER_1, // Tier 1: Workspace writes / edits
};

export async function killProcessHandler(args: {
  pid: number;
}): Promise<{
  success: boolean;
  error?: string;
  reason?: string;
}> {
  const activeProc = getProcess(args.pid);
  if (!activeProc) {
    return {
      success: false,
      error: "process_not_found",
      reason: `No active background process tracked with pid ${args.pid}`,
    };
  }

  try {
    activeProc.process.kill("SIGKILL");
    removeProcess(args.pid);
    try {
      getDb()
        .prepare(`UPDATE command_log SET status = ? WHERE pid = ?`)
        .run(CommandStatus.KILLED, args.pid);
    } catch {
      // ignore missing table / row
    }
    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: "kill_failed",
      reason: err.message,
    };
  }
}
