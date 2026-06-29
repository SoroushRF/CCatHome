import { z } from "zod";
import { PermissionTier, CapabilityName } from "../../core/constants.js";
import { CapabilityDefinition } from "../../core/router.js";
import { listCapabilities } from "../../core/dispatcher.js";

export const listCapabilitiesDefinition: CapabilityDefinition = {
  name: CapabilityName.LIST_CAPABILITIES,
  description: "Lists all available Tier B capabilities in the system, matching optional query filters. Never returns Tier A tools.",
  inputSchema: z.object({
    query: z.string().optional().describe("Optional query string to search capability names and descriptions"),
  }),
  tier: PermissionTier.TIER_0, // Tier 0: read-only discovery
};

export async function listCapabilitiesHandler(args: {
  query?: string;
}): Promise<{
  success: boolean;
  matches: Array<{ name: string; description: string; schema: any }>;
}> {
  const matches = listCapabilities(args.query);
  return {
    success: true,
    matches,
  };
}
