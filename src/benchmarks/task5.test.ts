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

const DIR = makeTempWorkspace("task5");

describe("benchmark task 5 recovery test fix", () => {
  afterEach(() => cleanupWorkspace(DIR));

  it("recovers mid-graph style single step with recoveryCommand", async () => {
    await resetGitWorkspace(DIR);
    fs.writeFileSync(path.join(DIR, "dummy.txt"), "x\n", "utf-8");
    await runCommandGated("git add dummy.txt");
    await runCommandGated('git commit -m "init"');
    registerCapability(executeStepDefinition, executeStepHandler);
    saveWorkflow("bench5", "Test Fix", [{ id: "tfix", title: "Fix tests" }]);
    fs.writeFileSync(path.join(DIR, "exec.js"), "console.log('test run');", "utf-8");
    fs.writeFileSync(
      path.join(DIR, "check.js"),
      "import fs from 'fs'; process.exit(fs.existsSync('tests-green')?0:1);",
      "utf-8"
    );
    fs.writeFileSync(
      path.join(DIR, "recover.js"),
      "import fs from 'fs'; fs.writeFileSync('tests-green','1');",
      "utf-8"
    );
    approveCommandForTests("node exec.js", "tfix");
    approveCommandForTests("node check.js", "tfix");
    approveCommandForTests("node recover.js", "tfix");
    const res = await invoke("execute_step", {
      workflowId: "bench5",
      stepId: "tfix",
      executionCommand: "node exec.js",
      validationCommand: "node check.js",
      recoveryCommand: "node recover.js",
      maxRetries: 2,
    });
    expect(res.result.success).toBe(true);
    expect(res.result.status).toBe("completed");
  });
});
