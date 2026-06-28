import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { config } from "../../core/config.js";
import { getDb, closeDb } from "../../core/db.js";
import { registerCapability, clearRegistry } from "../../core/router.js";
import { invoke } from "../../core/dispatcher.js";
import { createWorkflowDefinition, createWorkflowHandler } from "./create_workflow.js";
import { getWorkflowStateDefinition, getWorkflowStateHandler } from "./get_workflow_state.js";
import { getRunnableSteps } from "../../core/workflow-engine.js";

const TEST_DIR = path.resolve(config.workspaceRoot, "temp_workflow_test");

describe("Workflow DAG Engine Suite", () => {
  beforeEach(() => {
    clearRegistry();
    config.workspaceRoot = TEST_DIR;
    if (fs.existsSync(TEST_DIR)) {
      try {
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
      } catch (_e) {}
    }
    fs.mkdirSync(TEST_DIR, { recursive: true });

    registerCapability(createWorkflowDefinition, createWorkflowHandler);
    registerCapability(getWorkflowStateDefinition, getWorkflowStateHandler);
  });

  afterEach(() => {
    closeDb();
    if (fs.existsSync(TEST_DIR)) {
      try {
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
      } catch (_e) {}
    }
    config.workspaceRoot = process.cwd();
  });

  it("should validate and save a 5-node diamond DAG and verify topological running states", async () => {
    // Construct a diamond graph with 5 steps:
    //      A (root)
    //     / \
    //    B   C
    //     \ /
    //      D
    //      |
    //      E (leaf)
    const steps = [
      { id: "stepA", title: "Initialize codebase" },
      { id: "stepB", title: "Lint checks", depends_on: ["stepA"] },
      { id: "stepC", title: "Type checking", depends_on: ["stepA"] },
      { id: "stepD", title: "Run unit tests", depends_on: ["stepB", "stepC"] },
      { id: "stepE", title: "Build project bundle", depends_on: ["stepD"] },
    ];

    const createRes = await invoke("create_workflow", {
      name: "CI Pipeline",
      steps,
    });

    expect(createRes.success).toBe(true);
    const wfId = createRes.result.workflowId;
    expect(wfId).toBeDefined();

    // 1. Initial state: only stepA should be runnable (its dependencies are empty/met)
    let runnable = getRunnableSteps(wfId);
    expect(runnable).toEqual(["stepA"]);

    // 2. Mark stepA as completed in database
    const db = getDb();
    db.prepare("UPDATE workflow_steps SET status = 'completed' WHERE id = 'stepA'").run();

    // Now, stepB and stepC should be runnable
    runnable = getRunnableSteps(wfId).sort();
    expect(runnable).toEqual(["stepB", "stepC"]);

    // 3. Mark stepB as completed
    db.prepare("UPDATE workflow_steps SET status = 'completed' WHERE id = 'stepB'").run();

    // StepC is still runnable, but stepD is blocked since stepC is pending
    runnable = getRunnableSteps(wfId);
    expect(runnable).toEqual(["stepC"]);

    // 4. Mark stepC as completed
    db.prepare("UPDATE workflow_steps SET status = 'completed' WHERE id = 'stepC'").run();

    // Now stepD should be runnable
    runnable = getRunnableSteps(wfId);
    expect(runnable).toEqual(["stepD"]);

    // 5. Mark stepD as completed
    db.prepare("UPDATE workflow_steps SET status = 'completed' WHERE id = 'stepD'").run();

    // Now stepE should be runnable
    runnable = getRunnableSteps(wfId);
    expect(runnable).toEqual(["stepE"]);
  });

  it("should reject workflows containing cyclic dependencies", async () => {
    // Cyclic dependency: A -> B -> C -> A
    const cyclicSteps = [
      { id: "stepA", title: "Step A", depends_on: ["stepC"] },
      { id: "stepB", title: "Step B", depends_on: ["stepA"] },
      { id: "stepC", title: "Step C", depends_on: ["stepB"] },
    ];

    const res = await invoke("create_workflow", {
      name: "Cyclic Workflow",
      steps: cyclicSteps,
    });

    expect(res.result.success).toBe(false);
    expect(res.result.error).toBe("invalid_workflow");
    expect(res.result.reason).toContain("cycles");
  });

  it("should reject step dependency on missing step ID", async () => {
    const brokenSteps = [
      { id: "stepA", title: "Step A", depends_on: ["missing_step"] },
    ];

    const res = await invoke("create_workflow", {
      name: "Broken dependencies",
      steps: brokenSteps,
    });

    expect(res.result.success).toBe(false);
    expect(res.result.error).toBe("invalid_workflow");
    expect(res.result.reason).toContain("depends on missing step");
  });
});
