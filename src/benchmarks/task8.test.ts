import { describe, it, expect, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { registerCapability } from "../core/router.js";
import { invoke } from "../core/dispatcher.js";
import { killAllProcesses } from "../core/process-registry.js";
import { closeDb, getDb } from "../core/db.js";
import { runCommandDefinition, runCommandHandler } from "../tools/process/run_command.js";
import { readProcessOutputDefinition, readProcessOutputHandler } from "../tools/process/read_process_output.js";
import { killProcessDefinition, killProcessHandler } from "../tools/process/kill_process.js";
import { approveCommandForTests } from "../test/approve-command.js";
import { cleanupWorkspace, makeTempWorkspace, resetGitWorkspace } from "./helpers.js";
import { config } from "../core/config.js";

const DIR = makeTempWorkspace("task8");

describe("benchmark task 8 process concurrency", () => {
  afterEach(async () => {
    killAllProcesses();
    await new Promise((r) => setTimeout(r, 100));
    cleanupWorkspace(DIR);
  });

  it("starts a background process, polls ready, and reads output", async () => {
    await resetGitWorkspace(DIR);
    getDb();
    registerCapability(runCommandDefinition, runCommandHandler);
    registerCapability(readProcessOutputDefinition, readProcessOutputHandler);
    registerCapability(killProcessDefinition, killProcessHandler);

    const command = `node -e "console.log('listening on localhost:9876'); setInterval(() => console.log('tick'), 40);"`;
    approveCommandForTests(command);
    const res = await invoke("run_command", {
      command,
      timeoutMs: 5000,
      readinessPattern: "listening on localhost:\\d+",
    });
    expect(res.result.status).toBe("ready");
    expect(res.result.pid).toBeDefined();

    await new Promise((r) => setTimeout(r, 200));
    const out = await invoke("read_process_output", { pid: res.result.pid, fromLine: 1 });
    expect(out.result.success).toBe(true);
    expect(out.result.lines.join("\n")).toContain("listening on localhost:9876");

    await invoke("kill_process", { pid: res.result.pid });
    config.workspaceRoot = DIR; // keep cleanup consistent
  });
});
