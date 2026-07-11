import { describe, it, expect, afterEach, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  startDashboardServer,
  stopDashboardServer,
  escapeHtml,
} from "../core/dashboard-server.js";
import { config } from "../core/config.js";
import { closeDb, getDb } from "../core/db.js";
import { ConfirmationStatus } from "../core/constants.js";
import * as crypto from "crypto";

const TEST_DIR = path.resolve(process.cwd(), "temp_adv_dash");

describe("adversarial dashboard XSS (R7.3.5)", () => {
  beforeEach(() => {
    closeDb();
    config.workspaceRoot = TEST_DIR;
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
    fs.mkdirSync(TEST_DIR, { recursive: true });
    getDb();
  });

  afterEach(() => {
    stopDashboardServer();
    closeDb();
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
    config.workspaceRoot = process.cwd();
  });

  it("escapeHtml encodes script payloads", () => {
    const payload = `<img src=x onerror="alert('xss')">`;
    const escaped = escapeHtml(payload);
    expect(escaped).not.toContain("<img");
    expect(escaped).toContain("&lt;img");
    expect(escaped).toContain("&quot;");
  });

  it("serves static dashboard shell that uses textContent not innerHTML for HITL", async () => {
    const { server, token } = await startDashboardServer(0);
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("expected TCP address");
    const port = addr.port;

    const id = crypto.randomUUID();
    const evil = `<script>alert(1)</script>`;
    getDb()
      .prepare(
        `INSERT INTO pending_confirmations (id, step_id, command, status) VALUES (?, NULL, ?, ?)`
      )
      .run(id, evil, ConfirmationStatus.PENDING);

    const res = await fetch(`http://localhost:${port}/?token=${token}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    // Page must not embed unescaped confirmation command into HTML template
    expect(html).not.toContain(evil);
    // Client render path must use textContent (R4 XSS fix)
    expect(html).toContain(".textContent");
    expect(html).not.toMatch(/hitlList\.innerHTML\s*=/);
  });
});
