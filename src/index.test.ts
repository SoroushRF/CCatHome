import { describe, it, expect, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllCapabilities } from "./core/bootstrap.js";
import { getAllCapabilities } from "./core/router.js";
import { TIER_A_TOOLS, TIER_A_BUDGET } from "./core/dispatcher.js";

describe("Stdio MCP Server Configuration & Binding Suite (Step 3.5 E2E)", () => {
  let server: McpServer;

  beforeEach(() => {
    // 1. Bootstrap
    registerAllCapabilities();

    // 2. Initialize McpServer
    server = new McpServer({
      name: "ccathome-test-server",
      version: "2.1.0",
    });

    // 3. Register Tier A capabilities
    const capabilities = getAllCapabilities();
    for (const cap of capabilities) {
      if (TIER_A_TOOLS.has(cap.definition.name)) {
        server.registerTool(
          cap.definition.name,
          {
            description: cap.definition.description,
            inputSchema: cap.definition.inputSchema,
          },
          async (_args) => {
            // Mock invoke
            return {
              content: [{ type: "text", text: `Mock executed ${cap.definition.name}` }],
            };
          },
        );
      }
    }
  });

  it("should register all 12 Tier A capabilities as MCP tools directly", () => {
    // Access private _registeredTools map from McpServer
    const registered = (server as any)._registeredTools;
    expect(registered).toBeDefined();

    // Total Tier A tools — single source of truth (ADR 0004)
    const expectedTierA = Array.from(TIER_A_TOOLS);
    expect(TIER_A_TOOLS.size).toBe(TIER_A_BUDGET);
    expect(expectedTierA.length).toBe(TIER_A_BUDGET);
    expect(TIER_A_TOOLS.size).toBeLessThanOrEqual(TIER_A_BUDGET);

    for (const toolName of expectedTierA) {
      expect(registered[toolName]).toBeDefined();
      expect(registered[toolName].description).toBeDefined();
      expect(registered[toolName].inputSchema).toBeDefined();
    }
  });

  it("should never register Tier B capabilities directly as MCP tools", () => {
    const registered = (server as any)._registeredTools;

    // Verify Tier B tools are NOT directly on the server
    expect(registered["remember"]).toBeUndefined();
    expect(registered["recall"]).toBeUndefined();
    expect(registered["checkpoint"]).toBeUndefined();
    expect(registered["restore_checkpoint"]).toBeUndefined();
    expect(registered["search_files"]).toBeUndefined();
  });
});
