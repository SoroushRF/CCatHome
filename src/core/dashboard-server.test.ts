import { describe, it, expect, afterEach } from "vitest";
import { startDashboardServer, stopDashboardServer } from "./dashboard-server.js";

describe("Local HTTP SSE Dashboard Server (Step 3.4)", () => {
  afterEach(() => {
    stopDashboardServer();
  });

  it("should serve HTML page and SSE streams on localhost port 3142", async () => {
    const port = 3142;
    const server = await startDashboardServer(port);
    expect(server).toBeDefined();

    // 1. Fetch index home page
    const indexRes = await fetch(`http://localhost:${port}/`);
    expect(indexRes.status).toBe(200);
    const htmlText = await indexRes.text();
    expect(htmlText).toContain("CCatHome Agent Dashboard");
    expect(htmlText).toContain("evSource = new EventSource");

    // 2. Fetch API Events stream
    const eventsRes = await fetch(`http://localhost:${port}/api/events`);
    expect(eventsRes.status).toBe(200);
    expect(eventsRes.headers.get("content-type")).toContain("text/event-stream");

    // Clean up
    stopDashboardServer();
  });
});
