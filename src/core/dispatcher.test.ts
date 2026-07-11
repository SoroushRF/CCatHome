import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { registerCapability, clearRegistry } from "./router.js";
import { invoke, listCapabilities } from "./dispatcher.js";
import { PermissionTier, CapabilityName } from "./constants.js";

describe("Dispatcher & Router Skeleton", () => {
  beforeEach(() => {
    clearRegistry();
  });

  it("should successfully register and invoke an allowed capability", async () => {
    const handlerSpy = vi.fn().mockResolvedValue({ status: "ok" });
    const schema = z.object({ value: z.string() });

    registerCapability(
      {
        name: "test_allowed",
        description: "An allowed test capability",
        inputSchema: schema,
        tier: PermissionTier.TIER_0,
      },
      handlerSpy,
    );

    const res = await invoke("test_allowed", { value: "hello" });

    expect(res.success).toBe(true);
    expect(res.result).toEqual({ status: "ok" });
    expect(handlerSpy).toHaveBeenCalledTimes(1);
    expect(handlerSpy).toHaveBeenCalledWith({ value: "hello" });
  });

  it("should fail validation if arguments do not match inputSchema", async () => {
    const handlerSpy = vi.fn().mockResolvedValue({ status: "ok" });
    const schema = z.object({ value: z.string() });

    registerCapability(
      {
        name: "test_validation",
        description: "A validation test capability",
        inputSchema: schema,
        tier: PermissionTier.TIER_0,
      },
      handlerSpy,
    );

    const res = await invoke("test_validation", { value: 123 }); // Expect string, get number

    expect(res.success).toBe(false);
    expect(res.error).toContain("validation_failed");
    expect(handlerSpy).not.toHaveBeenCalled();
  });

  it("should reject Tier 3 capabilities BEFORE executing the handler", async () => {
    const handlerSpy = vi.fn().mockResolvedValue({ status: "never_executed" });
    const schema = z.object({});

    registerCapability(
      {
        name: "test_blocked",
        description: "A blocked Tier 3 capability",
        inputSchema: schema,
        tier: PermissionTier.TIER_3,
      },
      handlerSpy,
    );

    const res = await invoke("test_blocked", {});

    expect(res.success).toBe(false);
    expect(res.error).toContain("permission_denied");
    expect(res.tier).toBe(PermissionTier.TIER_3);
    // CRITICAL: Verify that the handler spy was never called
    expect(handlerSpy).not.toHaveBeenCalled();
  });

  it("should reject Tier 2 capabilities BEFORE executing the handler (Phase 1 behavior)", async () => {
    const handlerSpy = vi.fn().mockResolvedValue({ status: "never_executed" });
    const schema = z.object({});

    registerCapability(
      {
        name: "test_confirm",
        description: "A Tier 2 capability requiring confirmation",
        inputSchema: schema,
        tier: PermissionTier.TIER_2,
      },
      handlerSpy,
    );

    const res = await invoke("test_confirm", {});

    expect(res.success).toBe(false);
    expect(res.error).toContain("requires_confirmation");
    expect(res.tier).toBe(PermissionTier.TIER_2);
    // CRITICAL: Verify that the handler spy was never called
    expect(handlerSpy).not.toHaveBeenCalled();
  });

  it("should suggest the closest capability name on typo", async () => {
    registerCapability(
      {
        name: "git_diff",
        description: "Git diff helper",
        inputSchema: z.object({}),
        tier: PermissionTier.TIER_0,
      },
      async () => {},
    );

    const res = await invoke("git_dff", {}); // Typo

    expect(res.success).toBe(false);
    expect(res.error).toBe("unknown_capability");
    expect(res.suggestion).toBe("git_diff");
  });

  it("should list only Tier B capabilities (not Tier A tools)", () => {
    // Register a Tier A tool name (invoke)
    registerCapability(
      {
        name: CapabilityName.INVOKE,
        description: "Direct invocation tool",
        inputSchema: z.object({}),
        tier: PermissionTier.TIER_0,
      },
      async () => {},
    );

    // Register a Tier B tool name (git_diff)
    registerCapability(
      {
        name: CapabilityName.GIT_DIFF,
        description: "Git diff helper",
        inputSchema: z.object({}),
        tier: PermissionTier.TIER_0,
      },
      async () => {},
    );

    const list = listCapabilities();
    const names = list.map((c) => c.name);

    // git_diff should be present, invoke should be hidden
    expect(names).toContain(CapabilityName.GIT_DIFF);
    expect(names).not.toContain(CapabilityName.INVOKE);
  });
});
