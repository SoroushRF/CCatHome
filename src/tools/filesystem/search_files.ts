import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import { PermissionTier, CapabilityName } from "../../core/constants.js";
import { CapabilityDefinition } from "../../core/router.js";
import { config } from "../../core/config.js";
import { resolveSafePath } from "../../core/path-utils.js";

export const searchFilesDefinition: CapabilityDefinition = {
  name: CapabilityName.SEARCH_FILES,
  description: "Searches for a text query inside all files recursively in the workspace (ignores git and node_modules).",
  inputSchema: z.object({
    query: z.string().describe("The text query or term to search for"),
    extension: z.string().optional().describe("Optional file extension filter (e.g. '.ts', '.md')"),
  }),
  tier: PermissionTier.TIER_0, // Tier 0: Always allowed reads
};

interface SearchMatch {
  path: string;
  line: number;
  content: string;
}

export async function searchFilesHandler(args: {
  query: string;
  extension?: string;
}): Promise<{
  success: boolean;
  matches?: SearchMatch[];
  error?: string;
  reason?: string;
}> {
  const matches: SearchMatch[] = [];
  const root = resolveSafePath(config.workspaceRoot, ".");
  const lowercaseQuery = args.query.toLowerCase();

  // Ignores list
  const ignoredDirs = new Set([
    ".git",
    "node_modules",
    ".ccathome",
    ".agent",
    ".agents",
    "dist",
  ]);

  function walk(dir: string) {
    let files: string[];
    try {
      files = fs.readdirSync(dir);
    } catch (_err) {
      return;
    }

    for (const file of files) {
      const fullPath = path.join(dir, file);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(fullPath);
      } catch (_err) {
        continue;
      }

      if (stat.isDirectory()) {
        if (!ignoredDirs.has(file)) {
          walk(fullPath);
        }
      } else if (stat.isFile()) {
        // Apply extension filter if present
        if (args.extension && !file.endsWith(args.extension)) {
          continue;
        }

        // Skip binary or lock files
        if (file === "package-lock.json" || file.endsWith(".bak") || file.endsWith(".tmp")) {
          continue;
        }

        try {
          const content = fs.readFileSync(fullPath, "utf-8");
          if (content.toLowerCase().includes(lowercaseQuery)) {
            const lines = content.split(/\r?\n/);
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].toLowerCase().includes(lowercaseQuery)) {
                const relativePath = path.relative(root, fullPath);
                matches.push({
                  path: relativePath,
                  line: i + 1,
                  content: lines[i].trim(),
                });
                // Cap results to prevent huge token payloads
                if (matches.length >= 100) {
                  return;
                }
              }
            }
          }
        } catch (_err) {
          // Skip unreadable files
        }
      }
    }
  }

  try {
    walk(root);
  } catch (err: any) {
    return {
      success: false,
      error: "search_failed",
      reason: err.message,
    };
  }

  return {
    success: true,
    matches,
  };
}
