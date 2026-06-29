import { describe, it, expect, beforeEach } from "vitest";
import { registerCapability, clearRegistry } from "../../core/router.js";
import { invoke } from "../../core/dispatcher.js";
import { z } from "zod";
import { PermissionTier } from "../../core/constants.js";
import { listCapabilitiesDefinition, listCapabilitiesHandler } from "./list_capabilities.js";
import { invokeDefinition, invokeHandler } from "./invoke.js";

describe("Dispatcher Discovery & Routing Suite (Step 3.1)", () => {
  beforeEach(() => {
    clearRegistry();

    // Register discovery tools
    registerCapability(listCapabilitiesDefinition, listCapabilitiesHandler);
    registerCapability(invokeDefinition, invokeHandler);

    // Register a dummy Tier A capability in the registry
    registerCapability(
      {
        name: "execute_step",
        description: "Executes a workflow step",
        inputSchema: z.object({}),
        tier: PermissionTier.TIER_1,
      },
      async () => ({ success: true })
    );

    // Register a dummy Tier B capability in the registry (e.g. remember or dummy_b)
    registerCapability(
      {
        name: "remember_secret",
        description: "Stores a project secret in memory database",
        inputSchema: z.object({ secret: z.string() }),
        tier: PermissionTier.TIER_1,
      },
      async (args: { secret: string }) => ({ stored: true, length: args.secret.length })
    );
  });

  it("should never list Tier A capability names in list_capabilities matches", async () => {
    const listRes = await invoke("list_capabilities", {});
    expect(listRes.success).toBe(true);

    const matches = listRes.result.matches;
    expect(matches).toBeDefined();

    // Verify Tier B capability is listed
    const hasTierB = matches.some((m: any) => m.name === "remember_secret");
    expect(hasTierB).toBe(true);

    // Verify Tier A capabilities are NOT listed
    const hasListCap = matches.some((m: any) => m.name === "list_capabilities");
    const hasInvoke = matches.some((m: any) => m.name === "invoke");
    const hasExecStep = matches.some((m: any) => m.name === "execute_step");

    expect(hasListCap).toBe(false);
    expect(hasInvoke).toBe(false);
    expect(hasExecStep).toBe(false);
  });

  it("should filter listed capabilities based on query", async () => {
    // Query that matches
    const resMatch = await invoke("list_capabilities", { query: "secret" });
    expect(resMatch.success).toBe(true);
    expect(resMatch.result.matches.length).toBe(1);
    expect(resMatch.result.matches[0].name).toBe("remember_secret");

    // Query that does not match
    const resNoMatch = await invoke("list_capabilities", { query: "non_existent_query" });
    expect(resNoMatch.success).toBe(true);
    expect(resNoMatch.result.matches.length).toBe(0);
  });

  it("should route tool executions to Tier B via invoke", async () => {
    const invokeRes = await invoke("invoke", {
      capability: "remember_secret",
      args: { secret: "antigravity" },
    });

    expect(invokeRes.success).toBe(true);
    expect(invokeRes.result.success).toBe(true);
    expect(invokeRes.result.result.stored).toBe(true);
    expect(invokeRes.result.result.length).toBe(11);
  });

  it("should fail gracefully on invoke with unknown capability", async () => {
    const invokeRes = await invoke("invoke", {
      capability: "remember_secre",
      args: {},
    });

    expect(invokeRes.success).toBe(true); // invoke tool itself executed successfully
    expect(invokeRes.result.success).toBe(false); // but target tool invocation failed
    expect(invokeRes.result.error).toContain("unknown_capability");
    expect(invokeRes.result.error).toContain("remember_secret"); // suggestion
  });
});
