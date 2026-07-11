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

const DIR = makeTempWorkspace("task2");

describe("benchmark task 2 build verification", () => {
  afterEach(() => cleanupWorkspace(DIR));

  it("runs a compile-like execute_step that emits dist output", async () => {
    await resetGitWorkspace(DIR);
    fs.writeFileSync(path.join(DIR, "dummy.txt"), "x\n", "utf-8");
    await runCommandGated("git add dummy.txt");
    await runCommandGated('git commit -m "init"');
    registerCapability(executeStepDefinition, executeStepHandler);
    saveWorkflow("bench2", "Build", [{ id: "build", title: "Compile" }]);
    fs.mkdirSync(path.join(DIR, "dist"), { recursive: true });
    fs.writeFileSync(
      path.join(DIR, "exec.js"),
      "import fs from 'fs'; fs.mkdirSync('dist',{recursive:true}); fs.writeFileSync('dist/out.js','export default 1\\n');",
      "utf-8"
    );
    fs.writeFileSync(
      path.join(DIR, "check.js"),
      "import fs from 'fs'; process.exit(fs.existsSync('dist/out.js')?0:1);",
      "utf-8"
    );
    approveCommandForTests("node exec.js", "build");
    approveCommandForTests("node check.js", "build");
    const res = await invoke("execute_step", {
      workflowId: "bench2",
      stepId: "build",
      executionCommand: "node exec.js",
      validationCommand: "node check.js",
      maxRetries: 0,
    });
    expect(res.result.success).toBe(true);
    expect(fs.existsSync(path.join(DIR, "dist", "out.js"))).toBe(true);
  });
});
