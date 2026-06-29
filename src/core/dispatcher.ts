import { z } from "zod";
import { getCapability, getAllCapabilities } from "./router.js";
import { PermissionTier, CapabilityName } from "./constants.js";

// Helper to determine if a capability is a Tier A tool
export const TIER_A_TOOLS = new Set<string>([
  CapabilityName.INVOKE,
  CapabilityName.LIST_CAPABILITIES,
  CapabilityName.EXECUTE_STEP,
  CapabilityName.RUN_SCRIPT,
  CapabilityName.READ_FILE,
  CapabilityName.APPLY_PATCH,
  CapabilityName.RUN_COMMAND,
  CapabilityName.DETECT_WORKSPACE,
  CapabilityName.CREATE_WORKFLOW,
  CapabilityName.GET_WORKFLOW_STATE,
  CapabilityName.ASK_USER,
  CapabilityName.OPEN_PROJECT,
]);

export interface InvokeResult {
  success: boolean;
  result?: any;
  error?: string;
  tier?: PermissionTier;
}

export async function invoke(capabilityName: string, args: any): Promise<InvokeResult> {
  const capability = getCapability(capabilityName);
  if (!capability) {
    // Try to find closest match for user corrective suggestions
    const allNames = getAllCapabilities().map((c) => c.definition.name);
    const suggestion = findClosestMatch(capabilityName, allNames);
    return {
      success: false,
      error: `unknown_capability${suggestion ? `. Did you mean: ${suggestion}?` : ""}`,
    };
  }

  const { definition, handler } = capability;

  // 1. Validate Schema
  try {
    definition.inputSchema.parse(args);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return {
        success: false,
        error: `validation_failed: ${err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`,
      };
    }
    return { success: false, error: "validation_failed" };
  }

  // 2. Enforce Permission Gate
  if (definition.tier === PermissionTier.TIER_3) {
    return {
      success: false,
      error: "permission_denied: Tier 3 capabilities are blocked by default",
      tier: definition.tier,
    };
  }

  if (definition.tier === PermissionTier.TIER_2) {
    // In Phase 3, this will raise ask_user(type: "permission") confirmation.
    // For Phase 1, we return permission denied to represent needing confirmation.
    return {
      success: false,
      error: "requires_confirmation: Tier 2 capabilities require explicit user approval",
      tier: definition.tier,
    };
  }

  // 3. Execute Handler
  try {
    const result = await handler(args);
    return { success: true, result };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "execution_failed",
    };
  }
}

/**
 * Lists capabilities, matching the query against name and description.
 * Never includes Tier A tools in the output to avoid model tool selection confusion.
 */
export function listCapabilities(query?: string): Array<{ name: string; description: string; schema: any }> {
  const capabilities = getAllCapabilities();
  const filtered = capabilities.filter((c) => !TIER_A_TOOLS.has(c.definition.name));

  const matched = query
    ? filtered.filter((c) => {
        const q = query.toLowerCase();
        return (
          c.definition.name.toLowerCase().includes(q) ||
          c.definition.description.toLowerCase().includes(q)
        );
      })
    : filtered;

  return matched.map((c) => ({
    name: c.definition.name,
    description: c.definition.description,
    schema: c.definition.inputSchema,
  }));
}

// Simple Levenshtein distance helper for suggestions
function findClosestMatch(target: string, candidates: string[]): string | null {
  if (candidates.length === 0) return null;
  let minDistance = Infinity;
  let bestMatch = null;

  for (const candidate of candidates) {
    const distance = levenshtein(target, candidate);
    if (distance < minDistance && distance <= 3) {
      minDistance = distance;
      bestMatch = candidate;
    }
  }

  return bestMatch;
}

function levenshtein(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1,     // deletion
        );
      }
    }
  }
  return matrix[a.length][b.length];
}
