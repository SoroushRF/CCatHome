import * as fs from "fs";
import * as path from "path";
import { PermissionTier } from "./constants.js";
import { getDb } from "./db.js";
import { config } from "./config.js";

// Custom error for confirmation requests
export class RequiresConfirmationError extends Error {
  public command: string;
  public tier: PermissionTier;

  constructor(command: string, tier: PermissionTier) {
    super(`Command '${command}' requires explicit user confirmation (Tier ${tier})`);
    this.name = "RequiresConfirmationError";
    this.command = command;
    this.tier = tier;
  }
}

interface Rule {
  tier: number;
  description?: string;
  patterns: string[];
}

interface RulesConfig {
  rules: Rule[];
  defaultTier: number;
}

let cachedConfig: RulesConfig | null = null;

function loadRulesConfig(): RulesConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  // Try locating permission-rules.json in working directory
  const rootPath = path.resolve(process.cwd(), "permission-rules.json");
  try {
    if (fs.existsSync(rootPath)) {
      const data = fs.readFileSync(rootPath, "utf-8");
      cachedConfig = JSON.parse(data) as RulesConfig;
      return cachedConfig;
    }
  } catch (_err) {
    // Fall through to fallback
  }

  // Fallback default rules if loading fails
  return {
    rules: [
      {
        tier: 3,
        patterns: ["^rm -rf /", "sudo", "\\.\\./\\.\\./"],
      },
    ],
    defaultTier: 2,
  };
}

/**
 * Classifies a command into its corresponding security PermissionTier.
 * Rules are checked from highest tier (Tier 3 - blocked) to lowest (Tier 0 - always allowed).
 * If a command matches a pattern in a tier, that tier is returned.
 * If no rules match, the defaultTier (Tier 2) is returned.
 */
export function classifyCommand(command: string): PermissionTier {
  const configObj = loadRulesConfig();
  const trimmed = command.trim();

  // Sort tiers descending to check Tier 3 (highest restriction) first
  const sortedRules = [...configObj.rules].sort((a, b) => b.tier - a.tier);

  for (const rule of sortedRules) {
    for (const pattern of rule.patterns) {
      try {
        const regex = new RegExp(pattern, "i");
        if (regex.test(trimmed)) {
          return rule.tier as PermissionTier;
        }
      } catch (_err) {
        // Ignore invalid regex patterns in config
      }
    }
  }

  return configObj.defaultTier as PermissionTier;
}

/**
 * Centrally gates and determines if a command can run.
 * Returns true if allowed automatically (Tiers 0 and 1),
 * throws or triggers HitL confirmation for Tier 2,
 * and rejects immediately for Tier 3.
 */
export function classifyAndGate(command: string): { allowed: boolean; tier: PermissionTier } {
  const tier = classifyCommand(command);

  if (tier === PermissionTier.TIER_3) {
    return { allowed: false, tier };
  }

  if (tier === PermissionTier.TIER_2) {
    try {
      const db = getDb();
      
      // Check if this command has been approved for the active step
      let query = "SELECT status FROM pending_confirmations WHERE command = ?";
      const queryParams: any[] = [command];

      if (config.activeStepId) {
        query += " AND step_id = ?";
        queryParams.push(config.activeStepId);
      } else {
        query += " AND step_id IS NULL";
      }

      query += " ORDER BY created_at DESC LIMIT 1";

      const existing = db.prepare(query).get(...queryParams) as { status: string } | undefined;

      if (existing && existing.status === "approved") {
        return { allowed: true, tier };
      }

      // If not approved and not already pending, insert a pending confirmation record
      if (!existing || existing.status === "rejected") {
        const id = Math.random().toString(36).substring(2, 15);
        db.prepare(`
          INSERT INTO pending_confirmations (id, step_id, command, status)
          VALUES (?, ?, ?, 'pending')
        `).run(id, config.activeStepId || null, command);
      }

      return { allowed: false, tier };
    } catch (_err) {
      // Fallback if DB is not initialized or in a non-db context (like early tests)
      return { allowed: false, tier };
    }
  }

  return { allowed: true, tier };
}
