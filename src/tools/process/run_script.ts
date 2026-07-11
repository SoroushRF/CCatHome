import { z } from "zod";
import * as vm from "vm";
import * as fs from "fs";
import { PermissionTier, CapabilityName } from "../../core/constants.js";
import { CapabilityDefinition } from "../../core/router.js";
import { runCommandGated } from "../../core/process-runner.js";
import { classifyAndGate } from "../../core/permission-gate.js";
import { config } from "../../core/config.js";
import { resolveSafePath } from "../../core/path-utils.js";
import { safeWriteFile } from "../../core/safe-write.js";

const DEFAULT_TIMEOUT_MS = 5000;
const MAX_TIMEOUT_MS = 60_000;

export const runScriptDefinition: CapabilityDefinition = {
  name: CapabilityName.RUN_SCRIPT,
  description: "Runs Javascript code inside a sandboxed Node VM context with gated resource access.",
  inputSchema: z.object({
    code: z.string().describe("The Javascript code to execute in the sandboxed VM context"),
    timeoutMs: z
      .number()
      .int()
      .positive()
      .max(MAX_TIMEOUT_MS)
      .optional()
      .describe(`Optional VM timeout in ms (default ${DEFAULT_TIMEOUT_MS}, max ${MAX_TIMEOUT_MS})`),
  }),
  tier: PermissionTier.TIER_1, // Tier 1: Workspace writes / edits
};

export async function runScriptHandler(args: {
  code: string;
  timeoutMs?: number;
}): Promise<{
  success: boolean;
  result?: any;
  log?: string[];
  error?: string;
  reason?: string;
}> {
  const log: string[] = [];
  const timeout = Math.min(args.timeoutMs ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS);

  const gated = {
    runCommand: async (command: string) => {
      const gateResult = classifyAndGate(command);
      if (!gateResult.allowed) {
        throw new Error(
          `Permission denied: Command '${command}' was rejected by the Permission Gate (Tier ${gateResult.tier})`
        );
      }
      return runCommandGated(command);
    },
    readFile: async (relativePath: string) => {
      const gateResult = classifyAndGate(`read_file ${relativePath}`);
      if (!gateResult.allowed) {
        throw new Error(
          `Permission denied: Read access to '${relativePath}' was rejected by the Permission Gate (Tier ${gateResult.tier})`
        );
      }
      const safePath = resolveSafePath(config.workspaceRoot, relativePath);
      return fs.readFileSync(safePath, "utf-8");
    },
    writeFile: async (relativePath: string, content: string) => {
      const gateResult = classifyAndGate(`write_file ${relativePath}`);
      if (!gateResult.allowed) {
        throw new Error(
          `Permission denied: Write access to '${relativePath}' was rejected by the Permission Gate (Tier ${gateResult.tier})`
        );
      }
      const safePath = resolveSafePath(config.workspaceRoot, relativePath);
      safeWriteFile(safePath, content);
    },
  };

  const sandbox: Record<string, unknown> = {
    gated,
    console: {
      log: (...logArgs: any[]) => {
        log.push(logArgs.map(String).join(" "));
      },
      error: (...logArgs: any[]) => {
        log.push(logArgs.map(String).join(" "));
      },
    },
  };

  Object.freeze(sandbox);
  Object.freeze((sandbox as any).console);
  Object.freeze((sandbox as any).gated);

  const context = vm.createContext(sandbox);
  const usesAwait = /\bawait\b/.test(args.code);

  try {
    if (!usesAwait) {
      // Sync path so vm `timeout` can interrupt tight loops (ADR 0008)
      const script = new vm.Script(`(() => {\n${args.code}\n})()`);
      const result = script.runInContext(context, { timeout });
      return { success: true, result, log };
    }

    const script = new vm.Script(`(async () => {\n${args.code}\n})()`);
    const promise = script.runInContext(context, { timeout });
    const result = await Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Script timed out after ${timeout}ms`)), timeout)
      ),
    ]);

    return {
      success: true,
      result,
      log,
    };
  } catch (err: any) {
    return {
      success: false,
      error: "script_execution_failed",
      reason: err.message,
      log,
    };
  }
}
