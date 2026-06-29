import { describe, it, expect, afterEach } from "vitest";
import { startDashboardServer, stopDashboardServer } from "./dashboard-server.js";

describe("Local HTTP SSE Dashboard Server Authentication (Finding #13)", () => {
  afterEach(() => {
    stopDashboardServer();
  });

  it("should enforce token checks and serve HTML/SSE only when authenticated", async () => {
    const port = 3143;
    const server = await startDashboardServer(port);
    expect(server).toBeDefined();
    const token = (server as any).token;
    expect(token).toBeDefined();

    // 1. Fetch index home page WITHOUT token (should reject with 401)
    const indexResUnauth = await fetch(`http://localhost:${port}/`);
    expect(indexResUnauth.status).toBe(401);
    const textUnauth = await indexResUnauth.text();
    expect(textUnauth).toContain("Unauthorized");

    // 2. Fetch index home page WITH token (should pass with 200 and return Set-Cookie)
    const indexResAuth = await fetch(`http://localhost:${port}/?token=${token}`);
    expect(indexResAuth.status).toBe(200);
    const htmlText = await indexResAuth.text();
    expect(htmlText).toContain("CCatHome Agent Dashboard");
    
    const setCookie = indexResAuth.headers.get("set-cookie");
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain("ccathome_token=");

    // Extract cookie value
    const cookieVal = setCookie!.split(";")[0];

    // 3. Fetch API Events stream using the cookie (should pass with 200)
    const eventsResCookie = await fetch(`http://localhost:${port}/api/events`, {
      headers: {
        Cookie: cookieVal
      }
    });
    expect(eventsResCookie.status).toBe(200);
    expect(eventsResCookie.headers.get("content-type")).toContain("text/event-stream");

    // 4. Fetch API Events stream WITHOUT cookie or token (should reject with 401)
    const eventsResUnauth = await fetch(`http://localhost:${port}/api/events`);
    expect(eventsResUnauth.status).toBe(401);

    // Clean up
    stopDashboardServer();
  });
});
