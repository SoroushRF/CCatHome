import * as path from "path";

/**
 * Throws if absPath targets sensitive workspace files that must not be
 * overwritten via apply_patch / move_file / run_script writeFile.
 */
export function assertNotSensitiveWorkspacePath(absPath: string): void {
  const normalized = path.normalize(absPath);

  if (normalized.endsWith(`${path.sep}.env`) || path.basename(normalized) === ".env") {
    throw new Error("sensitive_path_blocked: writing .env is not allowed");
  }
  if (path.basename(normalized) === "permission-rules.json") {
    throw new Error("sensitive_path_blocked: writing permission-rules.json is not allowed");
  }
  if (normalized.includes(`${path.sep}.git${path.sep}hooks${path.sep}`) || normalized.includes(`${path.sep}.git/hooks${path.sep}`)) {
    throw new Error("sensitive_path_blocked: writing .git/hooks is not allowed");
  }
  // Also catch forward-slash form on all platforms
  const asPosix = normalized.split(path.sep).join("/");
  if (asPosix.includes("/.git/hooks/")) {
    throw new Error("sensitive_path_blocked: writing .git/hooks is not allowed");
  }
  if (/\.sqlite$/i.test(path.basename(normalized)) || /ccathome\.db$/i.test(path.basename(normalized))) {
    throw new Error("sensitive_path_blocked: writing sqlite database files is not allowed");
  }
}
