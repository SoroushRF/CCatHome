import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { config } from "../../core/config.js";
import { closeDb } from "../../core/db.js";
import { registerCapability, clearRegistry } from "../../core/router.js";
import { invoke } from "../../core/dispatcher.js";
import { rememberDefinition, rememberHandler } from "./remember.js";
import { recallDefinition, recallHandler } from "./recall.js";

const TEST_DIR = path.resolve(config.workspaceRoot, "temp_memory_test");

describe("Memory Subsystem Suite", () => {
  beforeEach(() => {
    clearRegistry();
    config.workspaceRoot = TEST_DIR;
    if (fs.existsSync(TEST_DIR)) {
      try {
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
      } catch (_e) {
        // ignore
      }
    }
    fs.mkdirSync(TEST_DIR, { recursive: true });

    registerCapability(rememberDefinition, rememberHandler);
    registerCapability(recallDefinition, recallHandler);
  });

  afterEach(() => {
    closeDb();
    if (fs.existsSync(TEST_DIR)) {
      try {
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
      } catch (_e) {
        // ignore
      }
    }
    config.workspaceRoot = process.cwd();
  });

  it("should insert memories and rank results using FTS5 BM25 search", async () => {
    // 1. Insert multiple project memory rules
    const m1 = await invoke("remember", {
      content: "Ensure all source code files have proper license headers at the top of the file.",
      tags: ["license", "headers", "compliance"],
    });
    expect(m1.success).toBe(true);
    expect(m1.result.memoryId).toBeDefined();

    const m2 = await invoke("remember", {
      content: "Database queries must always utilize parameterized queries to prevent SQL injections.",
      tags: ["database", "sqlite", "security"],
    });
    expect(m2.success).toBe(true);

    const m3 = await invoke("remember", {
      content: "Always run npm run lint before pushing commits to verify codebase hygiene.",
      tags: ["lint", "commits", "hygiene"],
    });
    expect(m3.success).toBe(true);

    // 2. Recall matching compliance rule
    const res1 = await invoke("recall", { query: "license headers" });
    expect(res1.success).toBe(true);
    expect(res1.result.memories).toHaveLength(1);
    expect(res1.result.memories[0].content).toContain("license headers");
    expect(res1.result.memories[0].tags).toContain("compliance");

    // 3. Recall matching security rule
    const res2 = await invoke("recall", { query: "SQL injections parameterized" });
    expect(res2.success).toBe(true);
    expect(res2.result.memories).toHaveLength(1);
    expect(res2.result.memories[0].content).toContain("SQL injections");

    // 4. Recall using tags/categories matching
    const res3 = await invoke("recall", { query: "hygiene" });
    expect(res3.success).toBe(true);
    expect(res3.result.memories[0].content).toContain("npm run lint");
  });

  it("should fallback gracefully on FTS5 syntax errors using LIKE queries", async () => {
    await invoke("remember", {
      content: "Special syntax fallback test memory details",
      tags: ["fallback"],
    });

    // FTS5 MATCH operators like ":" might trigger syntax errors. Check if it resolves it.
    const res = await invoke("recall", { query: "syntax:details" });
    expect(res.success).toBe(true);
    expect(res.result.memories.length).toBeGreaterThanOrEqual(1);
    expect(res.result.memories[0].content).toContain("Special syntax fallback");
  });

  it("should rank a varied corpus for qualitative queries", async () => {
    const corpus = [
      ["Use parameterized SQL queries always", ["sql", "security"]],
      ["License headers required on every source file", ["license"]],
      ["Prefer vitest for unit tests", ["testing"]],
      ["Dashboard token must be printed at startup", ["dashboard", "security"]],
      ["Never load permission-rules from workspace", ["security", "gate"]],
      ["Auto-commit successful steps with ccathome-auto", ["git", "workflow"]],
      ["Escape LIKE wildcards in recall fallback", ["memory"]],
      ["Context manager truncates command output", ["context"]],
      ["Tier 2 commands require human approval", ["hitl"]],
      ["Branch isolation uses ccathome prefix", ["git"]],
      ["npm install is Tier 2 due to lifecycle scripts", ["npm", "security"]],
      ["expand_log only accepts hex logId", ["logs"]],
      ["Checkpoint copies untracked directories", ["checkpoint"]],
      ["list_capabilities returns at most five matches", ["discovery"]],
      ["Clarification waits for dashboard response", ["hitl"]],
      ["run_script freezes the sandbox object", ["sandbox"]],
      ["Sensitive paths block .env writes", ["security"]],
      ["Recovery abort stops retry loops", ["workflow"]],
      ["SSE streams pending confirmations", ["dashboard"]],
      ["Patch parser ignores no-newline markers", ["patch"]],
    ] as const;

    for (const [content, tags] of corpus) {
      await invoke("remember", { content, tags: [...tags] });
    }

    const q1 = await invoke("recall", { query: "permission-rules workspace" });
    expect(q1.result.memories[0].content).toContain("permission-rules");

    const q2 = await invoke("recall", { query: "ccathome-auto" });
    expect(q2.result.memories[0].content).toContain("Auto-commit");

    const q3 = await invoke("recall", { query: "LIKE wildcards" });
    expect(q3.result.memories[0].content).toContain("LIKE wildcards");
  });
});
