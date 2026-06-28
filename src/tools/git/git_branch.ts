import { z } from "zod";
import { PermissionTier, CapabilityName } from "../../core/constants.js";
import { CapabilityDefinition } from "../../core/router.js";
import { runCommandGated } from "../../core/process-runner.js";

export const gitBranchDefinition: CapabilityDefinition = {
  name: CapabilityName.GIT_BRANCH,
  description: "Lists existing git branches or creates a new one.",
  inputSchema: z.object({
    name: z.string().optional().describe("Optional name of a branch to create"),
    list: z.boolean().optional().describe("If true, returns a list of branches"),
  }),
  tier: PermissionTier.TIER_0, // Tier 0: Always allowed reads
};

export async function gitBranchHandler(args: {
  name?: string;
  list?: boolean;
}): Promise<{
  success: boolean;
  branches?: string[];
  current?: string;
  error?: string;
  reason?: string;
}> {
  try {
    if (args.name) {
      const res = await runCommandGated(`git branch ${args.name}`);
      if (res.exitCode !== 0) {
        return {
          success: false,
          error: "git_branch_failed",
          reason: res.stderr,
        };
      }
      return { success: true };
    }

    // Default to listing
    const res = await runCommandGated("git branch");
    if (res.exitCode !== 0) {
      return {
        success: false,
        error: "git_branch_failed",
        reason: res.stderr,
      };
    }

    const branches = res.stdout.split(/\r?\n/).map((b) => b.replace(/^\*\s+/, "").trim());
    const current = res.stdout.split(/\r?\n/).find((b) => b.startsWith("*"))?.replace(/^\*\s+/, "").trim();

    return {
      success: true,
      branches,
      current,
    };
  } catch (err: any) {
    return {
      success: false,
      error: "execution_failed",
      reason: err.message,
    };
  }
}
