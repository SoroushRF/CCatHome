import { runCommandGated } from "./process-runner.js";

/**
 * Checks the current active git branch name.
 */
export async function getCurrentBranch(): Promise<string> {
  const res = await runCommandGated("git branch --show-current");
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
  const current = await getCurrentBranch();
  if (current.startsWith("ccathome/")) {
    return current;
  }

  const targetBranch = `ccathome/${workflowId}`;
  
  // Check if branch already exists
  const checkRes = await runCommandGated(`git branch --list ${targetBranch}`);
  if (checkRes.stdout.trim()) {
    // Branch exists, switch to it
    const switchRes = await runCommandGated(`git checkout ${targetBranch}`);
    if (switchRes.exitCode !== 0) {
      throw new Error(`Failed to checkout existing branch: ${switchRes.stderr}`);
    }
  } else {
    // Create and switch
    const createRes = await runCommandGated(`git checkout -b ${targetBranch}`);
    if (createRes.exitCode !== 0) {
      throw new Error(`Failed to create isolated branch: ${createRes.stderr}`);
    }
  }

  return targetBranch;
}
