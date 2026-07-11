export const config: {
  workspaceRoot: string;
  /** Captured once at process start; retarget policy is relative to this. */
  initialWorkspaceRoot: string;
  activeStepId?: string;
  activeWorkflowId?: string;
} = {
  workspaceRoot: process.cwd(),
  initialWorkspaceRoot: process.cwd(),
};
