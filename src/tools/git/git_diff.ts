import { z } from "zod";
import { PermissionTier, CapabilityName } from "../../core/constants.js";
import { CapabilityDefinition } from "../../core/router.js";
import { runGit } from "../../core/git-utils.js";

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
  // Keep --no-pager in argv (defense in depth); classify with a Tier-0 display
  // string because `git --no-pager diff` does not match `^git diff\b`.
  const argv = args.staged
    ? ["--no-pager", "diff", "--staged"]
    : ["--no-pager", "diff"];
  const display = args.staged ? "git diff --staged" : "git diff";
  try {
    const res = await runGit(argv, display);
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
