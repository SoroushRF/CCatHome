import { describe, it, expect, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { registerCapability } from "../core/router.js";
import { invoke } from "../core/dispatcher.js";
import { runCommandGated } from "../core/process-runner.js";
import { saveWorkflow } from "../core/workflow-engine.js";
import { getRunnableSteps } from "../core/workflow-engine.js";
import { executeStepDefinition, executeStepHandler } from "../tools/workflow/execute_step.js";
import { approveCommandForTests } from "../test/approve-command.js";
import { cleanupWorkspace, makeTempWorkspace, resetGitWorkspace } from "./helpers.js";
import { getDb } from "../core/db.js";
import { StepStatus } from "../core/constants.js";

const DIR = makeTempWorkspace("task9");

describe("benchmark task 9 DAG diamond", () => {
  afterEach(() => cleanupWorkspace(DIR));

  it("only runs D after B and C complete", async () => {
    await resetGitWorkspace(DIR);
    fs.writeFileSync(path.join(DIR, "dummy.txt"), "x\n", "utf-8");
    await runCommandGated("git add dummy.txt");
    await runCommandGated('git commit -m "init"');
    registerCapability(executeStepDefinition, executeStepHandler);

    saveWorkflow("bench9", "Diamond", [
      { id: "A", title: "A" },
      { id: "B", title: "B", depends_on: ["A"] },
      { id: "C", title: "C", depends_on: ["A"] },
      { id: "D", title: "D", depends_on: ["B", "C"] },
    ]);

    fs.writeFileSync(path.join(DIR, "ok.js"), "process.exit(0);", "utf-8");
    const run = async (stepId: string) => {
      approveCommandForTests("node ok.js", stepId);
      return invoke("execute_step", {
        workflowId: "bench9",
        stepId,
        executionCommand: "node ok.js",
        validationCommand: "node ok.js",
        maxRetries: 0,
      });
    };

    expect((await run("D")).result.error).toBe("dependencies_unmet");
    expect((await run("B")).result.error).toBe("dependencies_unmet");

    expect((await run("A")).result.success).toBe(true);
    expect((await run("B")).result.success).toBe(true);
    expect((await run("C")).result.success).toBe(true);
    expect((await run("D")).result.success).toBe(true);

    const db = getDb();
    const d = db
      .prepare("SELECT status FROM workflow_steps WHERE workflow_id = ? AND id = ?")
      .get("bench9", "D") as { status: string };
    expect(d.status).toBe(StepStatus.COMPLETED);

    const runnableAfter = getRunnableSteps("bench9");
    expect(runnableAfter).toEqual([]);
  });
});
