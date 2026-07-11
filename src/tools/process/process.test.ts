import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { registerCapability, clearRegistry } from "../../core/router.js";
import { invoke } from "../../core/dispatcher.js";
import { config } from "../../core/config.js";
import { killAllProcesses } from "../../core/process-registry.js";
import { runCommandDefinition, runCommandHandler } from "./run_command.js";
import { killProcessDefinition, killProcessHandler } from "./kill_process.js";
import { readProcessOutputDefinition, readProcessOutputHandler } from "./read_process_output.js";
import { expandLogDefinition, expandLogHandler } from "./expand_log.js";
import { approveCommandForTests } from "../../test/approve-command.js";
import { closeDb, getDb } from "../../core/db.js";

const TEST_DIR = path.resolve(config.workspaceRoot, "temp_proc_test");

describe("Process Capabilities Suite", () => {
  beforeEach(() => {
    clearRegistry();
    config.workspaceRoot = TEST_DIR;

    if (fs.existsSync(TEST_DIR)) {
      try {
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
      } catch (_err) {
        // Ignore transient EPERM on Windows
      }
    }
    try {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    } catch (_err) {
      // Ignore if already exists
    }

    registerCapability(runCommandDefinition, runCommandHandler);
    registerCapability(killProcessDefinition, killProcessHandler);
    registerCapability(readProcessOutputDefinition, readProcessOutputHandler);
    registerCapability(expandLogDefinition, expandLogHandler);
    getDb(); // ensure DB for approvals
  });

  afterEach(async () => {
    killAllProcesses();
    closeDb();
    // Allow OS time to release file handles on Windows
    await new Promise((resolve) => setTimeout(resolve, 150));
    if (fs.existsSync(TEST_DIR)) {
      try {
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
      } catch (_err) {
        // Ignore EPERM
      }
    }
    config.workspaceRoot = process.cwd();
  });

  it("should run short-lived commands and expand their logs", async () => {
    const command = `node -e "console.log('hello stdout'); console.error('hello stderr');"`;
    approveCommandForTests(command);
    const res = await invoke("run_command", {
      command,
    });

    expect(res.success).toBe(true);
    expect(res.result.status).toBe("exited");
    expect(res.result.exitCode).toBe(0);
    expect(res.result.stdout).toContain("hello stdout");
    expect(res.result.stderr).toContain("hello stderr");
    expect(res.result.logId).toBeDefined();

    // Verify expand_log works
    const expandRes = await invoke("expand_log", {
      logId: res.result.logId,
    });
    expect(expandRes.success).toBe(true);
    const joined = expandRes.result.lines.join("\n");
    expect(joined).toContain("hello stdout");
    expect(joined).toContain("hello stderr");
  });

  it("should run background processes, detect readiness, read output, and kill them", async () => {
    // Spawns a background process that logs a readiness signal, then prints heartbeats
    const command = `node -e "console.log('ready on localhost:3000'); setInterval(() => console.log('pulse'), 50);"`;
    approveCommandForTests(command);
    const res = await invoke("run_command", {
      command,
      timeoutMs: 5000,
      readinessPattern: "ready on localhost:\\d+",
    });

    expect(res.success).toBe(true);
    expect(res.result.status).toBe("ready");
    expect(res.result.pid).toBeDefined();
    expect(res.result.recentOutput).toContain("ready on localhost:3000");

    const pid = res.result.pid;

    // Wait a brief moment to accumulate heartbeats
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Read process output
    const outputRes = await invoke("read_process_output", {
      pid,
      fromLine: 1,
    });
    expect(outputRes.success).toBe(true);
    const text = outputRes.result.lines.join("\n");
    expect(text).toContain("ready on localhost:3000");
    expect(text).toContain("pulse");

    // Kill the process
    const killRes = await invoke("kill_process", { pid });
    expect(killRes.success).toBe(true);

    // Verify it is killed (sending signal 0 will fail/throw once the OS terminates/reaps it)
    let killed = false;
    for (let i = 0; i < 15; i++) {
      try {
        process.kill(pid, 0);
        await new Promise((resolve) => setTimeout(resolve, 50));
      } catch (_e) {
        killed = true;
        break;
      }
    }
    expect(killed).toBe(true);
  });

  it("should block Tier 3 commands at the gate before spawning", async () => {
    const res = await invoke("run_command", {
      command: "rm -rf /",
    });

    expect(res.result.success).toBe(false);
    expect(res.result.error).toBe("permission_denied");
  });

  describe("run_command failure contracts (R7.2.2)", () => {
    it("returns requires_confirmation for Tier 2 without approval", async () => {
      const res = await invoke("run_command", { command: "git push" });
      expect(res.result.success).toBe(false);
      expect(res.result.error).toBe("requires_confirmation");
    });

    it("returns invalid_readiness_pattern when pattern is too long", async () => {
      const command = `node -e "console.log('x')"`;
      approveCommandForTests(command);
      const res = await invoke("run_command", {
        command,
        readinessPattern: "a".repeat(201),
      });
      expect(res.result.success).toBe(false);
      expect(res.result.error).toBe("invalid_readiness_pattern");
    });

    it("returns log_setup_failed when logs directory cannot be created", async () => {
      const logsParent = path.join(TEST_DIR, ".ccathome");
      fs.mkdirSync(logsParent, { recursive: true });
      const blocker = path.join(logsParent, "logs");
      fs.writeFileSync(blocker, "not-a-dir", "utf-8");
      const command = `node -e "console.log('hi')"`;
      approveCommandForTests(command);
      const res = await invoke("run_command", { command });
      expect(res.result.success).toBe(false);
      expect(res.result.error).toBe("log_setup_failed");
      fs.rmSync(blocker, { force: true });
    });
  });

});
