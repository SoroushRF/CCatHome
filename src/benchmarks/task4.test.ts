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

const DIR = makeTempWorkspace("task4");

describe("benchmark task 4 recovery compile fix", () => {
  afterEach(() => cleanupWorkspace(DIR));

  it("recovers via caller recoveryCommand after validation failure", async () => {
    await resetGitWorkspace(DIR);
    fs.writeFileSync(path.join(DIR, "dummy.txt"), "x\n", "utf-8");
    await runCommandGated("git add dummy.txt");
    await runCommandGated('git commit -m "init"');
    registerCapability(executeStepDefinition, executeStepHandler);
    saveWorkflow("bench4", "Compile Fix", [{ id: "fix", title: "Fix" }]);
    fs.writeFileSync(path.join(DIR, "exec.js"), "console.log('build');", "utf-8");
    fs.writeFileSync(
      path.join(DIR, "check.js"),
      "import fs from 'fs'; process.exit(fs.existsSync('fixed.txt')?0:1);",
      "utf-8"
    );
    fs.writeFileSync(
      path.join(DIR, "recover.js"),
      "import fs from 'fs'; fs.writeFileSync('fixed.txt','ok');",
      "utf-8"
    );
    approveCommandForTests("node exec.js", "fix");
    approveCommandForTests("node check.js", "fix");
    approveCommandForTests("node recover.js", "fix");
    const res = await invoke("execute_step", {
      workflowId: "bench4",
      stepId: "fix",
      executionCommand: "node exec.js",
      validationCommand: "node check.js",
      recoveryCommand: "node recover.js",
      maxRetries: 2,
    });
    expect(res.result.success).toBe(true);
    expect(res.result.status).toBe("completed");
    expect(res.result.retryCount).toBe(1);
  });
});
