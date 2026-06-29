import * as child_process from "child_process";
import { classifyAndGate, RequiresConfirmationError } from "./permission-gate.js";
import { config } from "./config.js";
import { PermissionTier } from "./constants.js";

export interface GatedRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Executes a shell command after running it through the central Permission Gate.
 * Throws a permission error if the command is blocked or requires confirmation.
 */
export async function runCommandGated(command: string): Promise<GatedRunResult> {
  const gateResult = classifyAndGate(command);
  if (!gateResult.allowed) {
    if (gateResult.tier === PermissionTier.TIER_2) {
      throw new RequiresConfirmationError(command, gateResult.tier);
    }
    throw new Error(
      `Permission denied: Command '${command}' was rejected by the Permission Gate (Tier ${gateResult.tier})`,
    );
  }

  return new Promise((resolve) => {
    child_process.exec(
      command,
      {
        cwd: config.workspaceRoot,
        env: { ...process.env, PAGER: "cat" },
      },
      (error, stdout, stderr) => {
        if (error) {
          resolve({
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exitCode: error.code ?? 1,
          });
        } else {
          resolve({
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exitCode: 0,
          });
        }
      },
    );
  });
}
