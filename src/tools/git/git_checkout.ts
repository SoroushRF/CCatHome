import { z } from "zod";
import { PermissionTier, CapabilityName } from "../../core/constants.js";
import { CapabilityDefinition } from "../../core/router.js";
import { runCommandGated } from "../../core/process-runner.js";

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
  const cmd = args.create ? `git checkout -b ${args.branch}` : `git checkout ${args.branch}`;
  try {
    const res = await runCommandGated(cmd);
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
