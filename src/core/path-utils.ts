import * as path from "path";
import * as fs from "fs";

/**
 * Resolves a user-provided path against the workspace root.
 * Throws an error if the path attempts to traverse outside the workspace root (including via symlinks).
 */
export function resolveSafePath(workspaceRoot: string, userPath: string): string {
  // 1. Resolve textual path first
  const resolvedRoot = path.resolve(workspaceRoot);
  const resolvedTarget = path.resolve(resolvedRoot, userPath);

  // Textual check
  const textRelative = path.relative(resolvedRoot, resolvedTarget);
  if (textRelative.startsWith("..") || path.isAbsolute(textRelative)) {
    throw new Error(`path_traversal_detected: Path '${userPath}' escapes the workspace root`);
  }

  // 2. Resolve realpath of workspaceRoot to resolve any symlinks in the base directory
  const realRoot = fs.existsSync(resolvedRoot) ? fs.realpathSync(resolvedRoot) : resolvedRoot;

  // 3. Resolve realpath of the target path to verify symlink target containment
  let realTarget = resolvedTarget;
  if (fs.existsSync(resolvedTarget)) {
    realTarget = fs.realpathSync(resolvedTarget);
  } else {
    // If it doesn't exist yet, we check the realpath of its closest existing ancestor directory!
    let current = path.dirname(resolvedTarget);
    while (current !== path.dirname(current)) {
      if (fs.existsSync(current)) {
        const realCurrent = fs.realpathSync(current);
        // Ensure the existing ancestor is inside the real root
        const relativeAncestor = path.relative(realRoot, realCurrent);
        if (relativeAncestor.startsWith("..") || path.isAbsolute(relativeAncestor)) {
          throw new Error(`path_traversal_detected: Path '${userPath}' escapes the workspace root via ancestor`);
        }
        break;
      }
      current = path.dirname(current);
    }
  }

  // 4. Verify final real path containment
  const realRelative = path.relative(realRoot, realTarget);
  if (realRelative.startsWith("..") || path.isAbsolute(realRelative)) {
    throw new Error(`path_traversal_detected: Path '${userPath}' escapes the workspace root via symlink`);
  }

  return resolvedTarget;
}
