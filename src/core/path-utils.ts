import * as path from "path";

/**
 * Resolves a user-provided path against the workspace root.
 * Throws an error if the path attempts to traverse outside the workspace root.
 */
export function resolveSafePath(workspaceRoot: string, userPath: string): string {
  const resolvedRoot = path.resolve(workspaceRoot);
  const resolvedTarget = path.resolve(resolvedRoot, userPath);

  const relative = path.relative(resolvedRoot, resolvedTarget);

  // If the relative path starts with ".." or is absolute (which means it's outside the root), throw.
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`path_traversal_detected: Path '${userPath}' escapes the workspace root`);
  }

  return resolvedTarget;
}
