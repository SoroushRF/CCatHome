import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { fileURLToPath } from "url";
import { registerAllCapabilities } from "./core/bootstrap.js";
import { getAllCapabilities } from "./core/router.js";
import { invoke } from "./core/dispatcher.js";
import { TIER_A_TOOLS } from "./core/dispatcher.js";
import { startDashboardServer } from "./core/dashboard-server.js";

export async function main() {
  // 1. Bootstrap all tools
  registerAllCapabilities();

  // 2. Initialize McpServer
  const server = new McpServer({
    name: "ccathome-server",
    version: "1.0.0",
  });

  // 3. Register Tier A capabilities as MCP tools
  const capabilities = getAllCapabilities();
  for (const cap of capabilities) {
    if (TIER_A_TOOLS.has(cap.definition.name)) {
      server.registerTool(
        cap.definition.name,
        {
          description: cap.definition.description,
          inputSchema: cap.definition.inputSchema,
        },
        async (args) => {
          const res = await invoke(cap.definition.name, args);
          if (!res.success) {
            return {
              content: [{ type: "text", text: `Error: ${res.error}` }],
              isError: true,
            };
          }
          return {
            content: [
              {
                type: "text",
                text: typeof res.result === "string" ? res.result : JSON.stringify(res.result, null, 2),
              },
            ],
            structuredContent: typeof res.result === "object" && res.result !== null ? res.result : undefined,
          };
        }
      );
    }
  }

  // 4. Start Dashboard Server concurrently on port 3141
  try {
    await startDashboardServer(3141);
    console.error("Dashboard server listening on http://localhost:3141");
  } catch (err: any) {
    console.error(`Failed to start dashboard server: ${err.message}`);
  }

  // 5. Start Stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("CCatHome MCP Server running on stdio transport");
}

// Start if executed directly
if (
  import.meta.url.startsWith("file:") &&
  (process.argv[1] === fileURLToPath(import.meta.url) ||
    process.argv[1]?.endsWith("dist/index.js") ||
    process.argv[1]?.endsWith("index.ts"))
) {
  main().catch((err) => {
    console.error("Fatal error starting CCatHome server:", err);
    process.exit(1);
  });
}
