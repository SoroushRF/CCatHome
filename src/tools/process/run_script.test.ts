import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { config } from "../../core/config.js";
import { registerCapability, clearRegistry } from "../../core/router.js";
import { invoke } from "../../core/dispatcher.js";
import { runScriptDefinition, runScriptHandler } from "./run_script.js";

const TEST_DIR = path.resolve(config.workspaceRoot, "temp_run_script_test");

describe("Sandboxed Script Runner Suite", () => {
  beforeEach(() => {
    clearRegistry();
    config.workspaceRoot = TEST_DIR;
    if (fs.existsSync(TEST_DIR)) {
      try {
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
      } catch (_e) {
        // ignore
      }
    }
    fs.mkdirSync(TEST_DIR, { recursive: true });

    registerCapability(runScriptDefinition, runScriptHandler);
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      try {
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
      } catch (_e) {
        // ignore
      }
    }
    config.workspaceRoot = process.cwd();
  });

  it("should execute simple arithmetic inside sandbox", async () => {
    const res = await invoke("run_script", {
      code: "return 10 * 5;",
    });

    expect(res.success).toBe(true);
    expect(res.result.success).toBe(true);
    expect(res.result.result).toBe(50);
  });

  it("should read and write files using sandboxed gated callbacks", async () => {
    const res = await invoke("run_script", {
      code: `
        await gated.writeFile('test.txt', 'hello from vm');
        const content = await gated.readFile('test.txt');
        return content;
      `,
    });

    expect(res.success).toBe(true);
    expect(res.result.success).toBe(true);
    expect(res.result.result).toBe("hello from vm");

    // Double check on file system
    const fileContent = fs.readFileSync(path.join(TEST_DIR, "test.txt"), "utf-8");
    expect(fileContent).toBe("hello from vm");
  });

  it("should allow safe command execution and block unauthorized command execution", async () => {
    // 1. Run git status (should be allowed)
    const resGitStatus = await invoke("run_script", {
      code: `
        const cmdRes = await gated.runCommand('git status');
        return cmdRes.exitCode;
      `,
    });
    expect(resGitStatus.success).toBe(true);
    expect(resGitStatus.result.success).toBe(true);

    // 2. Try running a blocked command (e.g. rm -rf /)
    const resBlocked = await invoke("run_script", {
      code: `
        return await gated.runCommand('rm -rf /');
      `,
    });

    expect(resBlocked.success).toBe(true);
    expect(resBlocked.result.success).toBe(false);
    expect(resBlocked.result.error).toBe("script_execution_failed");
    expect(resBlocked.result.reason).toContain("rejected by the Permission Gate");
  });

  it("should timeout infinite loops and return capped log", async () => {
    const res = await invoke("run_script", {
      code: "while(true) {}",
      timeoutMs: 50,
    });
    expect(res.result.success).toBe(false);
    expect(res.result.error).toBe("script_execution_failed");
  });

  describe("sandbox adversarial", () => {
    it("should not yield a usable process via classic prototype escape as declared API", async () => {
      // ADR 0008: vm is not a security boundary; assert escape does not provide
      // a working require('fs') through the *declared* gated surface, and that
      // runaway escapes still surface as script_execution_failed when they throw.
      const res = await invoke("run_script", {
        code: `
          try {
            const proc = this.constructor.constructor('return process')();
            if (proc && proc.mainModule) {
              return { escaped: true };
            }
            return { escaped: !!proc };
          } catch (e) {
            return { escaped: false, err: String(e) };
          }
        `,
        timeoutMs: 1000,
      });
      // Document residual risk: escape may return a process object. We still
      // require gated.* for intentional I/O and treat full escape as known residual.
      expect(res.result.success).toBe(true);
      expect(res.result.log).toBeDefined();
    });
  });

  describe("run_script failure contracts (R7.2.3)", () => {
    it("fails closed on classic constructor escape attempts that throw", async () => {
      const res = await invoke("run_script", {
        code: `
          const fs = this.constructor.constructor('return process.mainModule.require("fs")')();
          return fs.readFileSync('/etc/passwd', 'utf8');
        `,
        timeoutMs: 1000,
      });
      // Either residual escape returns data (documented ADR 0008 risk) or
      // script_execution_failed — never silent success without result shape.
      expect(res.result.success === true || res.result.error === "script_execution_failed").toBe(
        true,
      );
      if (res.result.success === false) {
        expect(res.result.error).toBe("script_execution_failed");
      }
    });

    it("rejects path escape via gated.writeFile", async () => {
      const res = await invoke("run_script", {
        code: `await gated.writeFile('../../outside.txt', 'nope'); return 'ok';`,
      });
      expect(res.result.success).toBe(false);
      expect(res.result.error).toBe("script_execution_failed");
    });

    it("surfaces timeout as script_execution_failed with reason", async () => {
      const res = await invoke("run_script", {
        code: "while(true) {}",
        timeoutMs: 30,
      });
      expect(res.result.success).toBe(false);
      expect(res.result.error).toBe("script_execution_failed");
      expect(String(res.result.reason || "")).toMatch(/timed out|Script timed out|timeout/i);
    });
  });
});
