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
  // Only trust the server package / install path. Do not fall back to
  // process.cwd() when it equals workspaceRoot (workspace-planted rules).
  const pathsToTry: string[] = [];

  try {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    pathsToTry.push(path.resolve(currentDir, "../../permission-rules.json"));
  } catch (_e) {
    // Ignore in non-ESM/test contexts
  }

  const cwdRules = path.resolve(process.cwd(), "permission-rules.json");
  const workspaceRules = path.resolve(config.workspaceRoot, "permission-rules.json");
  if (cwdRules !== workspaceRules) {
    pathsToTry.push(cwdRules);
  }

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
 * Shell chaining / redirection / expansion: if a Tier 0/1 match is only via an
 * anchored safe prefix but the command contains shell metacharacters
 * (; & | ` $() ${} $VAR newlines, or > < redirects), escalate by re-classifying
 * each segment and taking the max (at least Tier 2). Bare redirection / env
 * expansion without a second command segment still escalates to Tier 2 so
 * workspace-escape writes cannot ride on Tier 0 prefixes.
 */
export function classifyCommand(command: string): PermissionTier {
  const trimmed = command.trim();
  const baseTier = classifyCommandRaw(trimmed);

  if (baseTier <= PermissionTier.TIER_1 && hasShellMetacharacters(trimmed)) {
    // Redirection or env expansion alone is enough to leave Tier 0/1 —
    // there may be no second "segment" to reclassify.
    if (hasShellRedirection(trimmed) || hasEnvExpansion(trimmed)) {
      const segments = splitShellSegments(trimmed);
      let maxTier = PermissionTier.TIER_2;
      for (const seg of segments) {
        // Strip redirect/env tokens so remaining argv can still hit Tier 3 rules
        const stripped = seg
          .replace(/(?:>>?|<<?)\s*[^\s;|&]+/g, " ")
          .replace(/\$\{[^}]*\}|\$[A-Za-z_][A-Za-z0-9_]*/g, " ")
          .trim();
        if (stripped) {
          maxTier = Math.max(maxTier, classifyCommandRaw(stripped)) as PermissionTier;
        }
      }
      return Math.max(maxTier, classifyCommandRaw(trimmed)) as PermissionTier;
    }

    const segments = splitShellSegments(trimmed);
    let maxTier = PermissionTier.TIER_2;
    for (const seg of segments) {
      maxTier = Math.max(maxTier, classifyCommandRaw(seg)) as PermissionTier;
    }
    return maxTier;
  }

  return baseTier;
}

/** Classic chain / substitution metacharacters. */
const SHELL_CHAIN_META_RE = /[;&|`\n]|\$\(/;
/** File redirection operators (not comparison in isolation — used with shell:true). */
const SHELL_REDIRECT_RE = /(?:^|[^>])>{1,2}(?:[^>]|$)|(?:^|[^<])<{1,2}(?:[^<]|$)/;
/** Env / parameter expansion that can inject paths outside the workspace. */
const SHELL_ENV_EXPAND_RE = /\$\{[A-Za-z_][A-Za-z0-9_]*\}|\$[A-Za-z_][A-Za-z0-9_]*/;

function hasShellRedirection(command: string): boolean {
  return SHELL_REDIRECT_RE.test(command);
}

function hasEnvExpansion(command: string): boolean {
  return SHELL_ENV_EXPAND_RE.test(command);
}

function hasShellMetacharacters(command: string): boolean {
  return (
    SHELL_CHAIN_META_RE.test(command) || hasShellRedirection(command) || hasEnvExpansion(command)
  );
}

function splitShellSegments(command: string): string[] {
  return command
    .split(/(?:&&|\|\||[;&\n])/)
    .map((s) => s.trim().replace(/^\|+\s*/, ""))
    .filter(Boolean);
}

/** Exported for adversarial / unit tests. */
export function commandHasShellMetacharacters(command: string): boolean {
  return hasShellMetacharacters(command);
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
