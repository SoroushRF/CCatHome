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
});
