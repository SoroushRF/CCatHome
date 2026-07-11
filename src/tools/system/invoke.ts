import { z } from "zod";
import { PermissionTier, CapabilityName } from "../../core/constants.js";
import { CapabilityDefinition } from "../../core/router.js";
import { invoke } from "../../core/dispatcher.js";

export const invokeDefinition: CapabilityDefinition = {
  name: CapabilityName.INVOKE,
  description: "Invokes and executes a dispatcher-routed Tier B capability by name.",
  inputSchema: z.object({
    capability: z.string().describe("The name of the Tier B capability to execute"),
    args: z.record(z.any()).describe("Arguments to pass to the capability handler"),
  }),
  tier: PermissionTier.TIER_1, // Tier 1: Workspace writes / edits (default level for invocation)
};

export async function invokeHandler(args: {
  capability: string;
  args: Record<string, any>;
}): Promise<{
  success: boolean;
  result?: any;
  error?: string;
  suggestion?: string;
  confirmationId?: string;
  tier?: number;
}> {
  const result = await invoke(args.capability, args.args);
  if (!result.success) {
    return {
      success: false,
      error: result.error,
      suggestion: result.suggestion,
      confirmationId: result.confirmationId,
      tier: result.tier,
    };
  }
  return {
    success: true,
    result: result.result,
  };
}
