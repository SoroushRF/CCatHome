import { z } from "zod";
import { PermissionTier, CapabilityName } from "../../core/constants.js";
import { CapabilityDefinition } from "../../core/router.js";
import { config } from "../../core/config.js";
import { prepareWorkspaceRetarget } from "../../core/workspace-retarget.js";
import { detectWorkspaceHandler } from "./detect_workspace.js";

export const openProjectDefinition: CapabilityDefinition = {
  name: CapabilityName.OPEN_PROJECT,
  description:
    "Opens a project directory, dynamically switching the active workspace target root to the specified absolute path.",
  inputSchema: z.object({
    path: z.string().describe("The absolute path of the local project directory to open"),
  }),
  tier: PermissionTier.TIER_0, // Tier 0: allowed so the agent can switch workspaces dynamically
};

export async function openProjectHandler(args: { path: string }): Promise<{
  success: boolean;
  message?: string;
  projectInfo?: any;
  error?: string;
  reason?: string;
}> {
  const prepared = prepareWorkspaceRetarget(args.path);
  if (!prepared.ok) {
    return {
      success: false,
      error: prepared.error,
      reason: prepared.reason,
    };
  }

  config.workspaceRoot = prepared.absolutePath;

  const workspaceInfo = await detectWorkspaceHandler({});

  return {
    success: true,
    message: `Successfully opened project workspace at: ${prepared.absolutePath}`,
    projectInfo: workspaceInfo,
  };
}
