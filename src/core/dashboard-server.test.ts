import { describe, it, expect, afterEach, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { startDashboardServer, stopDashboardServer, escapeHtml } from "./dashboard-server.js";
import { config } from "./config.js";
import { closeDb, getDb } from "./db.js";
import { ConfirmationStatus } from "./constants.js";

const TEST_DIR = path.resolve(process.cwd(), "temp_dashboard_test");

describe("Local HTTP SSE Dashboard Server Authentication (Finding #13)", () => {
  beforeEach(() => {
    closeDb();
    config.workspaceRoot = TEST_DIR;
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_DIR, { recursive: true });
    getDb();
  });

  afterEach(() => {
    stopDashboardServer();
    closeDb();
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
    config.workspaceRoot = process.cwd();
  });

  it("should enforce token checks and serve HTML/SSE only when authenticated", async () => {
    const { server, token } = await startDashboardServer(0);
    expect(server).toBeDefined();
    expect(token).toBeDefined();
    expect((server as any).token).toBe(token);
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("expected TCP address");
    const port = addr.port;

    const indexResUnauth = await fetch(`http://localhost:${port}/`);
    expect(indexResUnauth.status).toBe(401);

    const indexResAuth = await fetch(`http://localhost:${port}/?token=${token}`);
    expect(indexResAuth.status).toBe(200);
    const htmlText = await indexResAuth.text();
    expect(htmlText).toContain("CCatHome");
    expect(htmlText).toContain("Approvals (HITL)");

    const setCookie = indexResAuth.headers.get("set-cookie");
    expect(setCookie).toContain("ccathome_token=");
    const cookieVal = setCookie!.split(";")[0];

    const eventsResCookie = await fetch(`http://localhost:${port}/api/events`, {
      headers: { Cookie: cookieVal },
    });
    expect(eventsResCookie.status).toBe(200);
    expect(eventsResCookie.headers.get("content-type")).toContain("text/event-stream");

    const eventsResUnauth = await fetch(`http://localhost:${port}/api/events`);
    expect(eventsResUnauth.status).toBe(401);
  });

  it("should approve pending confirmations via authenticated POST API", async () => {
    const { server, token } = await startDashboardServer(0);
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("expected TCP address");
    const port = addr.port;
    const id = crypto.randomUUID();
    getDb()
      .prepare(
        `INSERT INTO pending_confirmations (id, step_id, command, status) VALUES (?, NULL, ?, ?)`,
      )
      .run(id, "git push", ConfirmationStatus.PENDING);

    const denied = await fetch(`http://localhost:${port}/api/confirmations/${id}/approve`, {
      method: "POST",
    });
    expect(denied.status).toBe(401);

    const ok = await fetch(
      `http://localhost:${port}/api/confirmations/${id}/approve?token=${token}`,
      { method: "POST" },
    );
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as { success: boolean };
    expect(body.success).toBe(true);

    const row = getDb()
      .prepare("SELECT status FROM pending_confirmations WHERE id = ?")
      .get(id) as { status: string };
    expect(row.status).toBe(ConfirmationStatus.APPROVED);
  });

  it("escapeHtml encodes XSS-prone characters", () => {
    expect(escapeHtml(`<img onerror="alert(1)">`)).toBe("&lt;img onerror=&quot;alert(1)&quot;&gt;");
  });
});
