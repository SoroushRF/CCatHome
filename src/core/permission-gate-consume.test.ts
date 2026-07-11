import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { classifyAndGate } from "./permission-gate.js";
import { config } from "./config.js";
import { closeDb, getDb } from "./db.js";
import { approveCommandForTests } from "../test/approve-command.js";
import { ConfirmationStatus } from "./constants.js";

const TEST_DIR = path.resolve(process.cwd(), "temp_gate_consume_test");

describe("Permission Gate single-use approvals", () => {
  beforeEach(() => {
    closeDb();
    config.workspaceRoot = TEST_DIR;
    config.activeStepId = undefined;
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_DIR, { recursive: true });
    getDb();
  });

  afterEach(() => {
    closeDb();
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
    config.workspaceRoot = process.cwd();
    config.activeStepId = undefined;
  });

  it("consumes an approved confirmation so a second identical command is gated", () => {
    approveCommandForTests("git push", null, 1);

    expect(classifyAndGate("git push").allowed).toBe(true);
    expect(classifyAndGate("git push").allowed).toBe(false);

    const rows = getDb()
      .prepare(
        "SELECT status FROM pending_confirmations WHERE command = ? AND step_id IS NULL"
      )
      .all("git push") as { status: string }[];
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((r) => r.status === ConfirmationStatus.PENDING)).toBe(true);
  });
});
