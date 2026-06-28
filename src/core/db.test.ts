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
      } catch (_e) {}
    }
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    closeDb();
    if (fs.existsSync(TEST_DIR)) {
      try {
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
      } catch (_e) {}
    }
    config.workspaceRoot = process.cwd();
  });

  it("should initialize database and apply migrations", () => {
    // 1. Create a mock migration
    const migrationsDir = path.join(TEST_DIR, "db", "migrations");
    fs.mkdirSync(migrationsDir, { recursive: true });
    
    fs.writeFileSync(
      path.join(migrationsDir, "0001-init.sql"),
      `CREATE TABLE test_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL
      );`,
      "utf-8"
    );

    // 2. Open db and trigger migrations
    const db = getDb();
    
    // Verify test_users table was created
    const stmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='test_users'");
    const table = stmt.get();
    expect(table).toBeDefined();
    expect(table.name).toBe("test_users");

    // Verify migrations log table recorded the run
    const logStmt = db.prepare("SELECT name FROM migrations WHERE name = ?");
    const migrationLog = logStmt.get("0001-init.sql");
    expect(migrationLog).toBeDefined();

    // 3. Test insert and query
    db.prepare("INSERT INTO test_users (username) VALUES (?)").run("alice");
    const user = db.prepare("SELECT username FROM test_users WHERE username = ?").get("alice");
    expect(user.username).toBe("alice");
  });
});
