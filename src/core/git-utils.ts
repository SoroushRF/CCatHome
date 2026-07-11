import { runArgvGated, runCommandGated } from "./process-runner.js";

const SAFE_REF = /^[a-zA-Z0-9._/-]+$/;

export function assertSafeGitRef(ref: string, label = "ref"): void {
  if (!SAFE_REF.test(ref)) {
    throw new Error(`invalid_git_${label}: '${ref}' contains unsafe characters`);
  }
}

/**
 * Run git with argv (no shell), gated via a display command string.
 */
export async function runGit(args: string[], displayCommand?: string) {
  const display = displayCommand ?? `git ${args.join(" ")}`;
  return runArgvGated(display, "git", args);
}

/**
 * Checks the current active git branch name.
 */
export async function getCurrentBranch(): Promise<string> {
  const res = await runGit(["branch", "--show-current"]);
  if (res.exitCode !== 0) {
    throw new Error(`Failed to get current branch: ${res.stderr}`);
  }
  return res.stdout.trim();
}

/**
 * Ensures the agent is working on an isolated branch prefixed with "ccathome/".
 * If the current branch is not isolated, creates and checkouts a new branch.
 */
export async function ensureBranchIsolation(workflowId: string): Promise<string> {
  assertSafeGitRef(workflowId, "workflowId");
  const current = await getCurrentBranch();
  if (current.startsWith("ccathome/")) {
    return current;
  }

  const targetBranch = `ccathome/${workflowId}`;
  assertSafeGitRef(targetBranch, "branch");

  // Check if branch already exists
  const checkRes = await runGit(["branch", "--list", targetBranch]);
  if (checkRes.stdout.trim()) {
    const switchRes = await runGit(["checkout", targetBranch]);
    if (switchRes.exitCode !== 0) {
      throw new Error(`Failed to checkout existing branch: ${switchRes.stderr}`);
    }
  } else {
    const createRes = await runGit(["checkout", "-b", targetBranch]);
    if (createRes.exitCode !== 0) {
      throw new Error(`Failed to create isolated branch: ${createRes.stderr}`);
    }
  }

  return targetBranch;
}

/** @deprecated Prefer runGit — kept for call sites still on shell strings during migration */
export { runCommandGated };
