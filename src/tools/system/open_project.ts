import { z } from "zod";
import * as path from "path";
import * as fs from "fs";
import { PermissionTier, CapabilityName } from "../../core/constants.js";
import { CapabilityDefinition } from "../../core/router.js";
import { config } from "../../core/config.js";
import { detectWorkspaceHandler } from "./detect_workspace.js";

export const openProjectDefinition: CapabilityDefinition = {
  name: CapabilityName.OPEN_PROJECT,
  description: "Opens a project directory, dynamically switching the active workspace target root to the specified absolute path.",
  inputSchema: z.object({
    path: z.string().describe("The absolute path of the local project directory to open"),
  }),
  tier: PermissionTier.TIER_0, // Tier 0: allowed so the agent can switch workspaces dynamically
};

export async function openProjectHandler(args: {
  path: string;
}): Promise<{
  success: boolean;
  message?: string;
  projectInfo?: any;
  error?: string;
  reason?: string;
}> {
  const absolutePath = path.resolve(args.path);
  if (!fs.existsSync(absolutePath)) {
    return {
      success: false,
      error: "directory_not_found",
      reason: `The directory '${args.path}' does not exist`,
    };
  }

  const stat = fs.statSync(absolutePath);
  if (!stat.isDirectory()) {
    return {
      success: false,
      error: "not_a_directory",
      reason: `'${args.path}' is a file, not a directory`,
    };
  }

  // Switch workspaceRoot dynamically
  config.workspaceRoot = absolutePath;

  // Run detect_workspace logic to return info about the new project
  const workspaceInfo = await detectWorkspaceHandler({ path: absolutePath });

  return {
    success: true,
    message: `Successfully opened project workspace at: ${absolutePath}`,
    projectInfo: workspaceInfo,
  };
}
