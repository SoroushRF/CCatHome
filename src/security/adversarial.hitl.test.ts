import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { config } from "../core/config.js";
import { closeDb, getDb } from "../core/db.js";
import { clearRegistry, registerCapability } from "../core/router.js";
import { invoke } from "../core/dispatcher.js";
import { askUserDefinition, askUserHandler } from "../tools/system/ask_user.js";
import { ConfirmationStatus } from "../core/constants.js";
import * as crypto from "crypto";

const TEST_DIR = path.resolve(process.cwd(), "temp_adv_hitl");

describe("adversarial HITL (R7.3.4)", () => {
  const PREV = process.env.CCATHOME_APPROVAL_TOKEN;

  beforeEach(() => {
    process.env.CCATHOME_APPROVAL_TOKEN = "adv-hitl-secret";
    clearRegistry();
    config.workspaceRoot = TEST_DIR;
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
    fs.mkdirSync(TEST_DIR, { recursive: true });
    registerCapability(askUserDefinition, askUserHandler);
    getDb();
  });

  afterEach(() => {
    if (PREV === undefined) delete process.env.CCATHOME_APPROVAL_TOKEN;
    else process.env.CCATHOME_APPROVAL_TOKEN = PREV;
    closeDb();
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
    config.workspaceRoot = process.cwd();
  });

  it("cannot self-approve Tier 2 without approvalToken", async () => {
    const id = crypto.randomUUID();
    getDb()
      .prepare(
        `INSERT INTO pending_confirmations (id, step_id, command, status) VALUES (?, NULL, ?, ?)`
      )
      .run(id, "git push", ConfirmationStatus.PENDING);

    const denied = await invoke("ask_user", {
      type: "permission",
      command: "git push",
      response: "approved",
    });
    expect(denied.result.success).toBe(false);
    expect(denied.result.error).toBe("approval_token_required");

    const row = getDb()
      .prepare("SELECT status FROM pending_confirmations WHERE id = ?")
      .get(id) as { status: string };
    expect(row.status).toBe(ConfirmationStatus.PENDING);
  });

  it("rejects forged tokens", async () => {
    const denied = await invoke("ask_user", {
      type: "permission",
      command: "git push",
      response: "approved",
      approvalToken: "forged",
    });
    expect(denied.result.error).toBe("approval_token_required");
  });
});
