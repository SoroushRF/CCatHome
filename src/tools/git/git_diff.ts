import { z } from "zod";
import { PermissionTier, CapabilityName } from "../../core/constants.js";
import { CapabilityDefinition } from "../../core/router.js";
import { runCommandGated } from "../../core/process-runner.js";

export const gitDiffDefinition: CapabilityDefinition = {
  name: CapabilityName.GIT_DIFF,
  description: "Returns the current uncommitted git changes (diff).",
  inputSchema: z.object({
    staged: z.boolean().optional().describe("If true, returns diff of staged changes"),
  }),
  tier: PermissionTier.TIER_0, // Tier 0: Always allowed reads/inspects
};

export async function gitDiffHandler(args: {
  staged?: boolean;
}): Promise<{
  success: boolean;
  diff?: string;
  error?: string;
  reason?: string;
}> {
  const cmd = args.staged ? "git diff --staged" : "git diff";
  try {
    const res = await runCommandGated(cmd);
    if (res.exitCode !== 0) {
      return {
        success: false,
        error: "git_diff_failed",
        reason: res.stderr,
      };
    }
    return {
      success: true,
      diff: res.stdout,
    };
  } catch (err: any) {
    return {
      success: false,
      error: "execution_failed",
      reason: err.message,
    };
  }
}
