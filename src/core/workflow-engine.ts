import { getDb } from "./db.js";
import { StepStatus, WorkflowStatus } from "./constants.js";

export interface WorkflowStepInput {
  id: string;
  title: string;
  depends_on?: string[];
}

/**
 * Checks if the workflow steps form a valid directed acyclic graph (DAG).
 * Throws an error if any cycle is detected or if dependencies reference missing steps.
 */
export function validateWorkflowDAG(steps: WorkflowStepInput[]): void {
  const stepMap = new Map<string, WorkflowStepInput>();
  const seen = new Set<string>();
  for (const s of steps) {
    if (seen.has(s.id)) {
      throw new Error(`Duplicate step id '${s.id}' in workflow`);
    }
    seen.add(s.id);
    stepMap.set(s.id, s);
  }

  // Validate dependencies exist
  for (const s of steps) {
    if (s.depends_on) {
      for (const dep of s.depends_on) {
        if (!stepMap.has(dep)) {
          throw new Error(`Step '${s.id}' depends on missing step '${dep}'`);
        }
      }
    }
  }

  // DFS Cycle Detection
  const visited = new Set<string>();
  const recStack = new Set<string>();

  function hasCycle(id: string): boolean {
    visited.add(id);
    recStack.add(id);

    const step = stepMap.get(id);
    if (step && step.depends_on) {
      for (const dep of step.depends_on) {
        if (!visited.has(dep)) {
          if (hasCycle(dep)) return true;
        } else if (recStack.has(dep)) {
          return true;
        }
      }
    }

    recStack.delete(id);
    return false;
  }

  for (const s of steps) {
    if (!visited.has(s.id)) {
      if (hasCycle(s.id)) {
        throw new Error("Workflow graph contains cycles and is not a valid DAG");
      }
    }
  }
}

/**
 * Inserts a new workflow and its steps into the SQLite database.
 * Throws if the steps do not form a valid DAG.
 */
export function saveWorkflow(workflowId: string, name: string, steps: WorkflowStepInput[]): void {
  validateWorkflowDAG(steps);

  const db = getDb();
  const insertWorkflow = db.prepare(`
    INSERT INTO workflows (id, name, status)
    VALUES (?, ?, ?)
  `);

  const insertStep = db.prepare(`
    INSERT INTO workflow_steps (id, workflow_id, title, depends_on, status, retry_count)
    VALUES (?, ?, ?, ?, ?, 0)
  `);

  // Save in a single transaction
  const saveTx = db.transaction(() => {
    insertWorkflow.run(workflowId, name, WorkflowStatus.PENDING);
    for (const s of steps) {
      const depsJson = s.depends_on ? JSON.stringify(s.depends_on) : "[]";
      insertStep.run(s.id, workflowId, s.title, depsJson, StepStatus.PENDING);
    }
  });

  saveTx();
}

/**
 * Returns whether all declared dependencies of a step are completed.
 */
export function areStepDependenciesMet(workflowId: string, stepId: string): boolean {
  const db = getDb();
  const step = db
    .prepare(`SELECT depends_on FROM workflow_steps WHERE id = ? AND workflow_id = ?`)
    .get(stepId, workflowId) as { depends_on: string } | undefined;
  if (!step) {
    return false;
  }

  const deps = JSON.parse(step.depends_on || "[]") as string[];
  if (deps.length === 0) {
    return true;
  }

  const completed = db
    .prepare(`SELECT id FROM workflow_steps WHERE workflow_id = ? AND status = ?`)
    .all(workflowId, StepStatus.COMPLETED) as { id: string }[];
  const completedIds = new Set(completed.map((s) => s.id));
  return deps.every((dep) => completedIds.has(dep));
}

/**
 * Returns the list of step IDs that are currently ready to execute
 * (status is pending and all dependencies are completed).
 */
export function getRunnableSteps(workflowId: string): string[] {
  const db = getDb();

  // Get all steps in the workflow
  const steps = db
    .prepare(
      `
    SELECT id, depends_on, status FROM workflow_steps WHERE workflow_id = ?
  `,
    )
    .all(workflowId) as { id: string; depends_on: string; status: string }[];

  const completed = new Set<string>(
    steps.filter((s) => s.status === StepStatus.COMPLETED).map((s) => s.id),
  );

  const runnable: string[] = [];
  for (const s of steps) {
    if (s.status !== StepStatus.PENDING) {
      continue;
    }

    const deps = JSON.parse(s.depends_on || "[]") as string[];
    const allDepsMet = deps.every((dep) => completed.has(dep));
    if (allDepsMet) {
      runnable.push(s.id);
    }
  }

  return runnable;
}
