import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let dbInstance: Database.Database | null = null;

/**
 * Gets the current active SQLite Database instance. Initializes it on the first call.
 */
export function getDb(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  const ccathomeDir = path.join(config.workspaceRoot, ".ccathome");
  if (!fs.existsSync(ccathomeDir)) {
    fs.mkdirSync(ccathomeDir, { recursive: true });
  }

  const dbPath = path.join(ccathomeDir, "ccathome.db");
  const db = new Database(dbPath);

  // Enable foreign keys
  db.pragma("foreign_keys = ON");

  // Initialize migrations log table
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      name TEXT PRIMARY KEY,
      run_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  dbInstance = db;
  runMigrations(db);

  return dbInstance;
}

/**
 * Closes the active database connection.
 */
export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Runs all pending migrations under db/migrations/ in alphabetical order.
 */
function runMigrations(db: Database.Database): void {
  const migrationsDir = path.resolve(__dirname, "..", "..", "db", "migrations");
  if (!fs.existsSync(migrationsDir)) {
    return;
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const migrationName = file;
    const stmt = db.prepare("SELECT 1 FROM migrations WHERE name = ?");
    const row = stmt.get(migrationName);

    if (!row) {
      const sqlPath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(sqlPath, "utf-8");

      // Execute migration in transaction
      const runTx = db.transaction(() => {
        db.exec(sqlContent);
        db.prepare("INSERT INTO migrations (name) VALUES (?)").run(migrationName);
      });

      try {
        runTx();
      } catch (err: any) {
        throw new Error(`Failed to apply database migration '${migrationName}': ${err.message}`);
      }
    }
  }
}
