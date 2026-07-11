import { z } from "zod";
import { PermissionTier, CapabilityName } from "../../core/constants.js";
import { CapabilityDefinition } from "../../core/router.js";
import { assertSafeGitRef, runGit } from "../../core/git-utils.js";

export const gitCheckoutDefinition: CapabilityDefinition = {
  name: CapabilityName.GIT_CHECKOUT,
  description: "Switches to an existing branch or checkouts a new one.",
  inputSchema: z.object({
    branch: z.string().describe("The name of the branch to checkout"),
    create: z.boolean().optional().describe("If true, creates the branch first (git checkout -b)"),
  }),
  tier: PermissionTier.TIER_1, // Tier 1: Workspace writes / modifications
};

export async function gitCheckoutHandler(args: {
  branch: string;
  create?: boolean;
}): Promise<{
  success: boolean;
  error?: string;
  reason?: string;
}> {
  try {
    assertSafeGitRef(args.branch, "branch");
    const argv = args.create ? ["checkout", "-b", args.branch] : ["checkout", args.branch];
    const res = await runGit(argv);
    if (res.exitCode !== 0) {
      return {
        success: false,
        error: "git_checkout_failed",
        reason: res.stderr || res.stdout,
      };
    }
    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: "execution_failed",
      reason: err.message,
    };
  }
}
