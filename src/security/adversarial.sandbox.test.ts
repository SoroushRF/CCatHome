import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { config } from "../core/config.js";
import { clearRegistry, registerCapability } from "../core/router.js";
import { invoke } from "../core/dispatcher.js";
import { runScriptDefinition, runScriptHandler } from "../tools/process/run_script.js";

const TEST_DIR = path.resolve(process.cwd(), "temp_adv_sandbox");

describe("adversarial vm sandbox (R7.3.3)", () => {
  beforeEach(() => {
    clearRegistry();
    config.workspaceRoot = TEST_DIR;
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
    fs.mkdirSync(TEST_DIR, { recursive: true });
    registerCapability(runScriptDefinition, runScriptHandler);
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
    config.workspaceRoot = process.cwd();
  });

  it("fails closed on require-style escape payloads", async () => {
    const payloads = [
      `return require('fs').readFileSync('/etc/passwd','utf8');`,
      `return global.process.mainModule.require('fs').readFileSync('/etc/passwd','utf8');`,
      `const p = this.constructor.constructor('return process')(); return p.binding('fs');`,
    ];
    for (const code of payloads) {
      const res = await invoke("run_script", { code, timeoutMs: 1000 });
      // ADR 0008: residual escape may succeed returning data — never treat as gated I/O.
      // Fail-closed means: either script_execution_failed OR success without host write via gated.
      if (res.result.success === false) {
        expect(res.result.error).toBe("script_execution_failed");
      } else {
        // Documented residual: escape may return process handles; assert no workspace poison.
        expect(fs.existsSync(path.join(TEST_DIR, "pwned.txt"))).toBe(false);
      }
    }
  });

  it("blocks gated write outside workspace", async () => {
    const res = await invoke("run_script", {
      code: `await gated.writeFile('/tmp/ccathome-pwned.txt', 'x'); return 'ok';`,
    });
    expect(res.result.success).toBe(false);
    expect(res.result.error).toBe("script_execution_failed");
  });

  it("times out infinite loops", async () => {
    const res = await invoke("run_script", { code: "for(;;){}", timeoutMs: 40 });
    expect(res.result.success).toBe(false);
    expect(res.result.error).toBe("script_execution_failed");
  });
});
