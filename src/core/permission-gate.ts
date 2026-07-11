import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { fileURLToPath } from "url";
import { PermissionTier, ConfirmationStatus } from "./constants.js";
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

/** Test-only: clear cached rules so the next classify reloads from disk. */
export function resetRulesCache(): void {
  cachedConfig = null;
}

function loadRulesConfig(): RulesConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  // ADR 0007: never load permission-rules.json from the target workspace.
  // Only trust the server package / install path (and cwd as last-resort package root).
  const pathsToTry: string[] = [];

  try {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    pathsToTry.push(path.resolve(currentDir, "../../permission-rules.json"));
  } catch (_e) {
    // Ignore in non-ESM/test contexts
  }

  pathsToTry.push(path.resolve(process.cwd(), "permission-rules.json"));

  for (const rootPath of pathsToTry) {
    try {
      if (fs.existsSync(rootPath)) {
        const data = fs.readFileSync(rootPath, "utf-8");
        cachedConfig = JSON.parse(data) as RulesConfig;
        return cachedConfig;
      }
    } catch (err: any) {
      console.error(`ERROR loading path ${rootPath}:`, err.message);
    }
  }

  // Log a loud warning if fallback is reached
  console.error(
    "WARNING: permission-rules.json config file not found. Falling back to strict default ruleset.",
  );

  // Fallback default rules if loading fails
  return {
    rules: [
      {
        tier: 3,
        patterns: ["rm\\s+-rf\\s+/", "sudo", "\\.\\./\\.\\./"],
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
 *
 * Shell chaining: if a Tier 0/1 match is only via an anchored safe prefix but the
 * command contains shell metacharacters (; & | ` $() newlines), escalate by
 * re-classifying each segment and taking the max (at least Tier 2).
 */
export function classifyCommand(command: string): PermissionTier {
  const trimmed = command.trim();
  const baseTier = classifyCommandRaw(trimmed);

  if (baseTier <= PermissionTier.TIER_1 && hasShellMetacharacters(trimmed)) {
    const segments = trimmed
      .split(/(?:&&|\|\||[;&\n])/)
      .map((s) => s.trim().replace(/^\|+\s*/, ""))
      .filter(Boolean);

    let maxTier = PermissionTier.TIER_2;
    for (const seg of segments) {
      maxTier = Math.max(maxTier, classifyCommandRaw(seg)) as PermissionTier;
    }
    // Also classify full string against Tier 3-only in raw path already handled per segment
    return maxTier;
  }

  return baseTier;
}

const SHELL_META_RE = /[;&|`\n]|\$\(/;

function hasShellMetacharacters(command: string): boolean {
  return SHELL_META_RE.test(command);
}

function classifyCommandRaw(command: string): PermissionTier {
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
      let allowed = false;

      // Wrap checks and insertions inside a single transaction to prevent SELECT-then-INSERT races
      db.transaction(() => {
        // Check if this command has been approved for the active step
        let query = "SELECT id, status FROM pending_confirmations WHERE command = ?";
        const queryParams: any[] = [command];

        if (config.activeStepId) {
          query += " AND step_id = ?";
          queryParams.push(config.activeStepId);
        } else {
          query += " AND step_id IS NULL";
        }

        query += " ORDER BY created_at DESC LIMIT 1";

        const existing = db.prepare(query).get(...queryParams) as
          { id: string; status: string } | undefined;

        if (existing && existing.status === ConfirmationStatus.APPROVED) {
          // Single-use: consume approval so a second identical command needs a new grant
          db.prepare("DELETE FROM pending_confirmations WHERE id = ?").run(existing.id);
          allowed = true;
          return;
        }

        // If not approved and not already pending, insert a pending confirmation record
        if (!existing || existing.status === ConfirmationStatus.REJECTED) {
          const id = crypto.randomUUID();
          db.prepare(
            `
            INSERT INTO pending_confirmations (id, step_id, command, status)
            VALUES (?, ?, ?, ?)
          `,
          ).run(id, config.activeStepId || null, command, ConfirmationStatus.PENDING);
        }
      })();

      if (allowed) {
        return { allowed: true, tier };
      }
      return { allowed: false, tier };
    } catch (_err) {
      // Fallback if DB is not initialized or in a non-db context (like early tests)
      return { allowed: false, tier };
    }
  }

  return { allowed: true, tier };
}
