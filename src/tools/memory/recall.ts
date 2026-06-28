import { z } from "zod";
import { PermissionTier, CapabilityName } from "../../core/constants.js";
import { CapabilityDefinition } from "../../core/router.js";
import { getDb } from "../../core/db.js";

export const recallDefinition: CapabilityDefinition = {
  name: CapabilityName.RECALL,
  description: "Retrieves matches for a query from the persistent memory database using BM25 FTS5 ranking.",
  inputSchema: z.object({
    query: z.string().describe("The search term or query to match against memories"),
    limit: z.number().optional().default(5).describe("Maximum number of results to return"),
  }),
  tier: PermissionTier.TIER_0, // Tier 0: Always allowed reads
};

interface RecallRow {
  key: string;
  value: string;
  category: string;
  score: number;
}

/**
 * Sanitizes search terms for FTS5 syntax, removing special operators
 * to prevent query parser syntax errors.
 */
function sanitizeFtsQuery(query: string): string {
  return query
    .replace(/[":*+\-&|!()[\]{}^~?]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 0)
    .join(" ");
}

export async function recallHandler(args: {
  query: string;
  limit?: number;
}): Promise<{
  success: boolean;
  memories?: {
    id: string;
    content: string;
    tags: string[];
    score: number;
  }[];
  error?: string;
  reason?: string;
}> {
  const db = getDb();
  const limit = args.limit ?? 5;

  if (!args.query.trim()) {
    return {
      success: true,
      memories: [],
    };
  }

  const sanitizedQuery = sanitizeFtsQuery(args.query);
  if (!sanitizedQuery) {
    return {
      success: true,
      memories: [],
    };
  }

  try {
    // 1. Attempt FTS5 MATCH query with BM25 ranking
    const rows = db.prepare(`
      SELECT key, value, category, bm25(project_memory) AS score
      FROM project_memory
      WHERE project_memory MATCH ?
      ORDER BY score ASC
      LIMIT ?
    `).all(sanitizedQuery, limit) as RecallRow[];

    return {
      success: true,
      memories: rows.map((r) => ({
        id: r.key,
        content: r.value,
        tags: parseTags(r.category),
        score: r.score,
      })),
    };
  } catch (_err) {
    // 2. Fallback to standard LIKE queries if FTS5 MATCH fails
    try {
      const wildcard = `%${args.query}%`;
      const rows = db.prepare(`
        SELECT key, value, category, -1.0 AS score
        FROM project_memory
        WHERE value LIKE ? OR category LIKE ?
        LIMIT ?
      `).all(wildcard, wildcard, limit) as RecallRow[];

      return {
        success: true,
        memories: rows.map((r) => ({
          id: r.key,
          content: r.value,
          tags: parseTags(r.category),
          score: r.score,
        })),
      };
    } catch (fallbackErr: any) {
      return {
        success: false,
        error: "recall_failed",
        reason: fallbackErr.message,
      };
    }
  }
}

function parseTags(categoryStr: string): string[] {
  try {
    return JSON.parse(categoryStr);
  } catch (_e) {
    return [];
  }
}
