import { z } from "zod";
import * as crypto from "crypto";
import { PermissionTier, CapabilityName } from "../../core/constants.js";
import { CapabilityDefinition } from "../../core/router.js";
import { getDb } from "../../core/db.js";

export const rememberDefinition: CapabilityDefinition = {
  name: CapabilityName.REMEMBER,
  description: "Saves a textual project memory or rule to the persistent search index.",
  inputSchema: z.object({
    content: z.string().describe("The text content of the memory to save"),
    tags: z.array(z.string()).optional().describe("Optional tags to associate with this memory"),
  }),
  tier: PermissionTier.TIER_1, // Tier 1: Workspace writes / edits
};

export async function rememberHandler(args: {
  content: string;
  tags?: string[];
}): Promise<{
  success: boolean;
  memoryId?: string;
  error?: string;
  reason?: string;
}> {
  const db = getDb();
  const memoryId = crypto.randomBytes(8).toString("hex");

  try {
    const tagsJson = JSON.stringify(args.tags || []);
    db.prepare(`
      INSERT INTO project_memory (key, value, category)
      VALUES (?, ?, ?)
    `).run(memoryId, args.content, tagsJson);

    return {
      success: true,
      memoryId,
    };
  } catch (err: any) {
    return {
      success: false,
      error: "save_failed",
      reason: err.message,
    };
  }
}
