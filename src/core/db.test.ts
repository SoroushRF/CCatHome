import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { config } from "./config.js";
import { getDb, closeDb } from "./db.js";

const TEST_DIR = path.resolve(config.workspaceRoot, "temp_db_test");

describe("Database & Migrations Suite", () => {
  beforeEach(() => {
    config.workspaceRoot = TEST_DIR;
    if (fs.existsSync(TEST_DIR)) {
      try {
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
      } catch (_e) {
        // ignore
      }
    }
    fs.mkdirSync(TEST_DIR, { recursive: true });
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

  it("should initialize database and apply production migrations", () => {
    // 1. Open db and trigger migrations
    const db = getDb();
    
    // Verify workflows table was created
    const stmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='workflows'");
    const table = stmt.get() as { name: string } | undefined;
    expect(table).toBeDefined();
    expect(table?.name).toBe("workflows");

    // Verify migrations log table recorded the run of the initial migration
    const logStmt = db.prepare("SELECT name FROM migrations WHERE name = ?");
    const migrationLog = logStmt.get("0001-init.sql");
    expect(migrationLog).toBeDefined();

    // 2. Test insert and query on workflows table
    db.prepare("INSERT INTO workflows (id, name, status) VALUES (?, ?, 'pending')").run("wf1", "Test Workflow");
    const wf = db.prepare("SELECT name FROM workflows WHERE id = ?").get("wf1") as { name: string } | undefined;
    expect(wf?.name).toBe("Test Workflow");
  });
});
