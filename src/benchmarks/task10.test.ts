import { describe, it, expect, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { registerCapability } from "../core/router.js";
import { invoke } from "../core/dispatcher.js";
import { runCommandGated } from "../core/process-runner.js";
import { saveWorkflow } from "../core/workflow-engine.js";
import { executeStepDefinition, executeStepHandler } from "../tools/workflow/execute_step.js";
import { checkpointDefinition, checkpointHandler } from "../tools/checkpoint/checkpoint.js";
import { restoreCheckpointDefinition, restoreCheckpointHandler } from "../tools/checkpoint/restore_checkpoint.js";
import { approveCommandForTests } from "../test/approve-command.js";
import { cleanupWorkspace, makeTempWorkspace, resetGitWorkspace } from "./helpers.js";

const DIR = makeTempWorkspace("task10");

describe("benchmark task 10 checkpoint rollback", () => {
  afterEach(() => cleanupWorkspace(DIR));

  it("restores pre-step bytes after exhausted retries", async () => {
    await resetGitWorkspace(DIR);
    fs.writeFileSync(path.join(DIR, "tracked.txt"), "clean\n", "utf-8");
    await runCommandGated("git add tracked.txt");
    await runCommandGated('git commit -m "init"');
    const preSha = (await runCommandGated("git rev-parse HEAD")).stdout.trim();

    registerCapability(executeStepDefinition, executeStepHandler);
    registerCapability(checkpointDefinition, checkpointHandler);
    registerCapability(restoreCheckpointDefinition, restoreCheckpointHandler);

    const cp = await invoke("checkpoint", {});
    const checkpointId = cp.result.checkpointId;

    saveWorkflow("bench10", "Rollback", [{ id: "fail", title: "Fail" }]);
    fs.writeFileSync(
      path.join(DIR, "exec.js"),
      "import fs from 'fs'; fs.writeFileSync('tracked.txt', 'dirty\\n');",
      "utf-8"
    );
    fs.writeFileSync(path.join(DIR, "check.js"), "process.exit(1);", "utf-8");
    approveCommandForTests("node exec.js", "fail");
    approveCommandForTests("node check.js", "fail");

    const res = await invoke("execute_step", {
      workflowId: "bench10",
      stepId: "fail",
      executionCommand: "node exec.js",
      validationCommand: "node check.js",
      maxRetries: 0,
    });
    expect(res.result.status).toBe("failed");
    expect(fs.readFileSync(path.join(DIR, "tracked.txt"), "utf-8")).toBe("dirty\n");

    const restore = await invoke("restore_checkpoint", { checkpointId });
    expect(restore.result.success).toBe(true);
    expect(fs.readFileSync(path.join(DIR, "tracked.txt"), "utf-8")).toBe("clean\n");
    const afterSha = (await runCommandGated("git rev-parse HEAD")).stdout.trim();
    expect(afterSha).toBe(preSha);
  });
});
