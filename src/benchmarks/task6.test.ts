import { describe, it, expect, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { registerCapability } from "../core/router.js";
import { invoke } from "../core/dispatcher.js";
import { runCommandGated } from "../core/process-runner.js";
import { saveWorkflow } from "../core/workflow-engine.js";
import { executeStepDefinition, executeStepHandler } from "../tools/workflow/execute_step.js";
import { approveCommandForTests } from "../test/approve-command.js";
import { cleanupWorkspace, makeTempWorkspace, resetGitWorkspace } from "./helpers.js";

const DIR = makeTempWorkspace("task6");

describe("benchmark task 6 branch isolation", () => {
  afterEach(() => cleanupWorkspace(DIR));

  it("auto-commits on ccathome/<workflowId> without touching main", async () => {
    await resetGitWorkspace(DIR);
    fs.writeFileSync(path.join(DIR, "dummy.txt"), "base\n", "utf-8");
    await runCommandGated("git add dummy.txt");
    await runCommandGated('git commit -m "init"');
    const mainSha = (await runCommandGated("git rev-parse main")).stdout.trim();

    registerCapability(executeStepDefinition, executeStepHandler);
    saveWorkflow("bench6", "Branch Isolation", [{ id: "s1", title: "Write" }]);
    fs.writeFileSync(
      path.join(DIR, "exec.js"),
      "import fs from 'fs'; fs.writeFileSync('out.txt', 'ok', 'utf-8');\n",
      "utf-8",
    );
    fs.writeFileSync(path.join(DIR, "check.js"), "process.exit(0);\n", "utf-8");
    approveCommandForTests("node exec.js", "s1");
    approveCommandForTests("node check.js", "s1");

    const res = await invoke("execute_step", {
      workflowId: "bench6",
      stepId: "s1",
      executionCommand: "node exec.js",
      validationCommand: "node check.js",
      maxRetries: 0,
    });
    expect(res.result.success).toBe(true);

    const branch = (await runCommandGated("git branch --show-current")).stdout.trim();
    expect(branch).toBe("ccathome/bench6");
    const mainAfter = (await runCommandGated("git rev-parse main")).stdout.trim();
    expect(mainAfter).toBe(mainSha);
    const subject = (await runCommandGated("git log -n 1 --pretty=format:%s")).stdout.trim();
    expect(subject).toContain("[ccathome-auto]");
  });
});
