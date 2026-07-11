import { runCommandUngated } from "../core/process-runner.js";

/**
 * Initialize a disposable git repo for tests without going through the
 * permission gate. Production agents must still use gated git helpers;
 * test harnesses need identity + a default branch without HITL.
 */
export async function initGitRepoForTests(opts?: {
  email?: string;
  name?: string;
  branch?: string;
}): Promise<void> {
  const email = opts?.email ?? "test@ccathome.com";
  const name = opts?.name ?? "Test CCatHome";
  const branch = opts?.branch ?? "main";
  await runCommandUngated("git init");
  await runCommandUngated(`git config user.email "${email}"`);
  await runCommandUngated(`git config user.name "${name}"`);
  await runCommandUngated(`git checkout -b ${branch}`);
}
