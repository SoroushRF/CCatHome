import { z } from "zod";
import { PermissionTier, CapabilityName } from "../../core/constants.js";
import { CapabilityDefinition } from "../../core/router.js";
import { runCommandGated } from "../../core/process-runner.js";

export const gitCommitDefinition: CapabilityDefinition = {
  name: CapabilityName.GIT_COMMIT,
  description: "Commits staged files with a commit message. Rejects amending auto-commits.",
  inputSchema: z.object({
    message: z.string().describe("The commit message"),
    amend: z.boolean().optional().describe("If true, amends the last commit"),
  }),
  tier: PermissionTier.TIER_1, // Tier 1: Workspace writes / commits
};

export async function gitCommitHandler(args: {
  message: string;
  amend?: boolean;
}): Promise<{
  success: boolean;
  sha?: string;
  error?: string;
  reason?: string;
}> {
  try {
    // Check auto-commit amend conflict
    if (args.amend) {
      const logRes = await runCommandGated("git log -n 1 --pretty=format:%s");
      if (logRes.exitCode === 0) {
        const lastMsg = logRes.stdout.trim();
        // If last commit was an auto-commit, reject
        if (lastMsg.startsWith("[ccathome-auto]") || lastMsg.startsWith("[auto-commit]")) {
          return {
            success: false,
            error: "amend_conflicts_with_autocommit",
            reason: "Amending a commit created automatically by the workflow engine is not allowed.",
          };
        }
      }
    }

    // Escape double quotes in commit message
    const escapedMsg = args.message.replace(/"/g, '\\"');
    const cmd = args.amend
      ? `git commit --amend -m "${escapedMsg}"`
      : `git commit -m "${escapedMsg}"`;

    const res = await runCommandGated(cmd);
    if (res.exitCode !== 0) {
      return {
        success: false,
        error: "git_commit_failed",
        reason: res.stderr || res.stdout,
      };
    }

    const shaRes = await runCommandGated("git rev-parse HEAD");
    return {
      success: true,
      sha: shaRes.stdout.trim(),
    };
  } catch (err: any) {
    return {
      success: false,
      error: "execution_failed",
      reason: err.message,
    };
  }
}
