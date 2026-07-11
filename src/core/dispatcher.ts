import { z } from "zod";
import * as crypto from "crypto";
import { getCapability, getAllCapabilities } from "./router.js";
import { PermissionTier, CapabilityName, ConfirmationStatus } from "./constants.js";
import { getDb } from "./db.js";
import { config } from "./config.js";

/** Max Tier A MCP tools (ADR 0004). CI asserts TIER_A_TOOLS.size === this. */
export const TIER_A_BUDGET = 12;

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
  suggestion?: string;
  tier?: PermissionTier;
  confirmationId?: string;
}

export async function invoke(capabilityName: string, args: any): Promise<InvokeResult> {
  const capability = getCapability(capabilityName);
  if (!capability) {
    // Try to find closest match for user corrective suggestions
    const allNames = getAllCapabilities().map((c) => c.definition.name);
    const suggestion = findClosestMatch(capabilityName, allNames);
    return {
      success: false,
      error: "unknown_capability",
      suggestion: suggestion || undefined,
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
    let confirmationId: string | undefined;
    try {
      const db = getDb();
      confirmationId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO pending_confirmations (id, step_id, command, status)
        VALUES (?, ?, ?, ?)
      `).run(
        confirmationId,
        config.activeStepId || null,
        `capability:${capabilityName}`,
        ConfirmationStatus.PENDING
      );
    } catch {
      confirmationId = undefined;
    }
    return {
      success: false,
      error: "requires_confirmation",
      tier: definition.tier,
      confirmationId,
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
 * Returns at most 5 matches (PRD §5.3), preferring name-prefix hits.
 */
export function listCapabilities(query?: string): Array<{ name: string; description: string; schema: any }> {
  const capabilities = getAllCapabilities();
  const filtered = capabilities.filter((c) => !TIER_A_TOOLS.has(c.definition.name));

  const matched = query
    ? filtered
        .map((c) => {
          const q = query.toLowerCase();
          const name = c.definition.name.toLowerCase();
          const desc = c.definition.description.toLowerCase();
          const prefix = name.startsWith(q) ? 0 : name.includes(q) ? 1 : desc.includes(q) ? 2 : -1;
          return { c, prefix };
        })
        .filter((x) => x.prefix >= 0)
        .sort((a, b) => a.prefix - b.prefix || a.c.definition.name.localeCompare(b.c.definition.name))
        .map((x) => x.c)
    : filtered;

  return matched.slice(0, 5).map((c) => ({
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
