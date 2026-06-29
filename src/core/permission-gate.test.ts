import { describe, it, expect } from "vitest";
import { classifyCommand, classifyAndGate } from "./permission-gate.js";
import { PermissionTier } from "./constants.js";

describe("Permission Gate Command Classifier", () => {
  it("should classify Tier 0 commands correctly", () => {
    expect(classifyCommand("git status")).toBe(PermissionTier.TIER_0);
    expect(classifyCommand("git diff")).toBe(PermissionTier.TIER_0);
    expect(classifyCommand("npm test")).toBe(PermissionTier.TIER_0);
    expect(classifyCommand("npm run test")).toBe(PermissionTier.TIER_0);
  });

  it("should classify Tier 1 commands correctly", () => {
    expect(classifyCommand("git add src/index.ts")).toBe(PermissionTier.TIER_1);
    expect(classifyCommand("git commit -m \"feat: init\"")).toBe(PermissionTier.TIER_1);
    expect(classifyCommand("npm run build")).toBe(PermissionTier.TIER_1);
  });

  it("should classify Tier 2 commands correctly", () => {
    expect(classifyCommand("git push origin main")).toBe(PermissionTier.TIER_2);
    expect(classifyCommand("curl https://google.com")).toBe(PermissionTier.TIER_2);
  });

  it("should classify Tier 3 commands correctly", () => {
    expect(classifyCommand("rm -rf /")).toBe(PermissionTier.TIER_3);
    expect(classifyCommand("rm -rf / ")).toBe(PermissionTier.TIER_3);
    expect(classifyCommand("sudo apt-get install")).toBe(PermissionTier.TIER_3);
    expect(classifyCommand("cat ../../etc/passwd")).toBe(PermissionTier.TIER_3);
    expect(classifyCommand("echo hello | bash")).toBe(PermissionTier.TIER_3);
  });

  it("should fallback to Tier 2 (default) for unrecognized commands", () => {
    expect(classifyCommand("unknown-command-xyz")).toBe(PermissionTier.TIER_2);
  });

  it("should gate commands based on classification tiers", () => {
    // Tiers 0 and 1 are allowed automatically
    expect(classifyAndGate("git status").allowed).toBe(true);
    expect(classifyAndGate("npm run build").allowed).toBe(true);

    // Tier 2 requires confirmation (returns false/gated in Phase 0)
    expect(classifyAndGate("git push").allowed).toBe(false);

    // Tier 3 is blocked immediately
    expect(classifyAndGate("rm -rf /").allowed).toBe(false);
  });
});
