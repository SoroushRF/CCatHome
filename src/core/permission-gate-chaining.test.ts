import { describe, it, expect } from "vitest";
import { classifyCommand } from "./permission-gate.js";
import { PermissionTier } from "./constants.js";

describe("Permission Gate Security Hardening Suite (Findings #1, #2, #4)", () => {
  it("should classify npm install as Tier 0", () => {
    expect(classifyCommand("npm install")).toBe(PermissionTier.TIER_0);
    expect(classifyCommand("npm i")).toBe(PermissionTier.TIER_0);
    expect(classifyCommand("npm ci")).toBe(PermissionTier.TIER_0);
    expect(classifyCommand("npm install --save-dev zod")).toBe(PermissionTier.TIER_0);
  });

  it("should classify dangerous git destructive operations as Tier 2", () => {
    expect(classifyCommand("git checkout main")).toBe(PermissionTier.TIER_1);
    expect(classifyCommand("git checkout -- .")).toBe(PermissionTier.TIER_2);
    expect(classifyCommand("git checkout .")).toBe(PermissionTier.TIER_2);
    expect(classifyCommand("git reset --hard HEAD")).toBe(PermissionTier.TIER_2);
    expect(classifyCommand("git clean -fd")).toBe(PermissionTier.TIER_2);
  });

  it("should block unanchored destructive commands (command chaining bypass checks)", () => {
    expect(classifyCommand("rm -rf /")).toBe(PermissionTier.TIER_3);
    expect(classifyCommand("echo ok && rm -rf /")).toBe(PermissionTier.TIER_3);
    expect(classifyCommand("npm install; rm -rf / ")).toBe(PermissionTier.TIER_3);
    expect(classifyCommand("node run.js || sudo rm -rf /")).toBe(PermissionTier.TIER_3);
    expect(classifyCommand("rm --force --recursive /")).toBe(PermissionTier.TIER_3);
    expect(classifyCommand("echo hello; rm --recursive /")).toBe(PermissionTier.TIER_3);
    expect(classifyCommand("rm -rf /var/lib/important")).toBe(PermissionTier.TIER_3);
    expect(classifyCommand("rm --recursive /etc/config")).toBe(PermissionTier.TIER_3);
    expect(classifyCommand("rm -rf .git")).toBe(PermissionTier.TIER_3);
    expect(classifyCommand("rm -rf /home/user/project/.git")).toBe(PermissionTier.TIER_3);
  });

  it("should block sensitive path writes inside the workspace", () => {
    expect(classifyCommand("write_file .git/hooks/pre-commit")).toBe(PermissionTier.TIER_3);
    expect(classifyCommand("write_file .env")).toBe(PermissionTier.TIER_3);
    expect(classifyCommand("write_file permission-rules.json")).toBe(PermissionTier.TIER_3);
    expect(classifyCommand("write_file ccathome.sqlite")).toBe(PermissionTier.TIER_3);
  });
});
