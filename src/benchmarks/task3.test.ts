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

const DIR = makeTempWorkspace("task3");

describe("benchmark task 3 test suite execution", () => {
  afterEach(() => cleanupWorkspace(DIR));

  it("runs a test-like execute_step and records a summary", async () => {
    await resetGitWorkspace(DIR);
    fs.writeFileSync(path.join(DIR, "dummy.txt"), "x\n", "utf-8");
    await runCommandGated("git add dummy.txt");
    await runCommandGated('git commit -m "init"');
    registerCapability(executeStepDefinition, executeStepHandler);
    saveWorkflow("bench3", "Tests", [{ id: "test", title: "Unit" }]);
    fs.writeFileSync(
      path.join(DIR, "exec.js"),
      "console.log('PASS src/sum.test.js'); process.exit(0);",
      "utf-8"
    );
    fs.writeFileSync(path.join(DIR, "check.js"), "process.exit(0);", "utf-8");
    approveCommandForTests("node exec.js", "test");
    approveCommandForTests("node check.js", "test");
    const res = await invoke("execute_step", {
      workflowId: "bench3",
      stepId: "test",
      executionCommand: "node exec.js",
      validationCommand: "node check.js",
      maxRetries: 0,
    });
    expect(res.result.success).toBe(true);
    expect(res.result.summary).toContain("PASS");
  });
});
