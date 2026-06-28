import { z } from "zod";
import * as vm from "vm";
import * as fs from "fs";
import * as path from "path";
import { PermissionTier, CapabilityName } from "../../core/constants.js";
import { CapabilityDefinition } from "../../core/router.js";
import { runCommandGated } from "../../core/process-runner.js";
import { classifyAndGate } from "../../core/permission-gate.js";
import { config } from "../../core/config.js";
import { resolveSafePath } from "../../core/path-utils.js";

export const runScriptDefinition: CapabilityDefinition = {
  name: CapabilityName.RUN_SCRIPT,
  description: "Runs Javascript code inside a secure sandboxed Node VM context with gated resource access.",
  inputSchema: z.object({
    code: z.string().describe("The Javascript code to execute in the sandboxed VM context"),
  }),
  tier: PermissionTier.TIER_1, // Tier 1: Workspace writes / edits
};

export async function runScriptHandler(args: {
  code: string;
}): Promise<{
  success: boolean;
  result?: any;
  error?: string;
  reason?: string;
}> {
  // Create gated callback functions
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
      // Resolving path inside workspace root for safety
      const safePath = resolveSafePath(config.workspaceRoot, relativePath);
      return fs.readFileSync(safePath, "utf-8");
    },
    writeFile: async (relativePath: string, content: string) => {
      // Resolving path inside workspace root for safety
      const safePath = resolveSafePath(config.workspaceRoot, relativePath);
      fs.mkdirSync(path.dirname(safePath), { recursive: true });
      fs.writeFileSync(safePath, content, "utf-8");
    },
  };

  const sandbox = {
    gated,
    console: {
      log: (...logArgs: any[]) => console.log(...logArgs),
      error: (...logArgs: any[]) => console.error(...logArgs),
    },
  };

  const context = vm.createContext(sandbox);

  try {
    // Wrap the code in an async IIFE to support top-level await in sandboxed code
    const scriptCode = `(async () => {\n${args.code}\n})()`;
    const script = new vm.Script(scriptCode);
    const promise = script.runInContext(context);
    const result = await promise;

    return {
      success: true,
      result,
    };
  } catch (err: any) {
    return {
      success: false,
      error: "script_execution_failed",
      reason: err.message,
    };
  }
}
