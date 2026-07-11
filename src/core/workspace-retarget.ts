import * as fs from "fs";
import * as path from "path";
import { config } from "./config.js";
import { classifyAndGate } from "./permission-gate.js";
import { PermissionTier, StepStatus } from "./constants.js";

export type RetargetResult =
  { ok: true; absolutePath: string } | { ok: false; error: string; reason: string };

/**
 * Validates and optionally gates a workspace retarget.
 * Default: only allow subdirectories of initialWorkspaceRoot (or the root itself).
 * If CCATHOME_WORKSPACE_ALLOWLIST is set (colon-separated prefixes), target must
 * be under one of those prefixes instead.
 * Leaving the allowed tree requires Tier 2 confirmation via synthetic command.
 */
export function prepareWorkspaceRetarget(userPath: string): RetargetResult {
  const absolutePath = path.resolve(userPath);
  if (!fs.existsSync(absolutePath)) {
    return {
      ok: false,
      error: "directory_not_found",
      reason: `The directory '${userPath}' does not exist`,
    };
  }
  const stat = fs.statSync(absolutePath);
  if (!stat.isDirectory()) {
    return {
      ok: false,
      error: "not_a_directory",
      reason: `'${userPath}' is a file, not a directory`,
    };
  }

  let realTarget: string;
  try {
    realTarget = fs.realpathSync(absolutePath);
  } catch (err: any) {
    return {
      ok: false,
      error: "realpath_failed",
      reason: err.message,
    };
  }

  const allowlistEnv = process.env.CCATHOME_WORKSPACE_ALLOWLIST;
  const allowedPrefixes = allowlistEnv
    ? allowlistEnv
        .split(":")
        .map((p) => path.resolve(p))
        .filter(Boolean)
    : [path.resolve(config.initialWorkspaceRoot)];

  const insideAllowed = allowedPrefixes.some((prefix) => {
    const rel = path.relative(prefix, realTarget);
    return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
  });

  if (!insideAllowed) {
    const gateCmd = `open_project ${realTarget}`;
    const gate = classifyAndGate(gateCmd);
    if (!gate.allowed) {
      if (gate.tier === PermissionTier.TIER_3) {
        return {
          ok: false,
          error: "permission_denied",
          reason: "Workspace retarget blocked by Permission Gate",
        };
      }
      return {
        ok: false,
        error: StepStatus.REQUIRES_CONFIRMATION,
        reason: `Retargeting outside allowed workspace tree requires confirmation: ${realTarget}`,
      };
    }
  }

  return { ok: true, absolutePath: realTarget };
}
