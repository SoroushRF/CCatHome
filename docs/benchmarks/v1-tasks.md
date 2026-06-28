# CCatHome Benchmark Task Suite v1

This document defines the 10 scaffolded project tasks used to evaluate the correctness, security containment, and self-healing features of the CCatHome agentic loop.

---

## Task 1: Basic Patch Application
* **Goal**: Modify a file using `apply_patch` without causing corruption or syntax errors.
* **Setup**: A project with a simple utility function `sum(a, b)`.
* **Action**: Patch the utility to also support variable arguments or handle non-number inputs.
* **Success Criteria**:
  1. Patch applies cleanly.
  2. `apply_patch` returns success with the correct hunk count and new SHA.
  3. Original file backup is verified in `.ccathome/backups/`.

---

## Task 2: Build Verification
* **Goal**: Validate that CCatHome can run compile/build scripts and parse compilation failures.
* **Setup**: A TypeScript project.
* **Action**: Run `execute_step` targeting a compilation step.
* **Success Criteria**:
  1. Exit code is `0`.
  2. Built files are successfully outputted to the build target directory (e.g. `dist/`).

---

## Task 3: Test Suite Execution
* **Goal**: Verify execution and parsing of project test runners.
* **Setup**: A project with unit tests configured using Vitest or Jest.
* **Action**: Execute tests via `execute_step`.
* **Success Criteria**:
  1. Process runs successfully.
  2. The step outputs a parser-friendly summary of passing/failing tests.

---

## Task 4: Auto-Fix Loop on Compile Failure
* **Goal**: Test self-healing behavior when code fails compilation.
* **Setup**: A syntax error is introduced into a TypeScript file.
* **Action**: Run a build step that fails; wait for the auto-fix loops.
* **Success Criteria**:
  1. The compiler error is caught in the validation phase.
  2. CCatHome attempts an auto-fix step by patching the syntax error.
  3. The final build step passes, and the step is marked `completed`.

---

## Task 5: Auto-Fix Loop on Test Failure
* **Goal**: Test self-healing behavior when a unit test asserts a failure.
* **Setup**: A logical bug is introduced in a function causing a unit test to fail.
* **Action**: Run the test step that fails.
* **Success Criteria**:
  1. The failure is successfully parsed from the test runner's stdout/stderr.
  2. CCatHome inspects the failing assertion, patches the logic bug in the source code, and re-runs the tests.
  3. Tests pass, and the step is marked `completed`.

---

## Task 6: Branch Isolation Verification
* **Goal**: Verify that agent modifications do not pollute the user's current branch.
* **Setup**: Start CCatHome on branch `main` or `master`.
* **Action**: Run a step that completes successfully and triggers an auto-commit.
* **Success Criteria**:
  1. Auto-commit is created on a isolated branch prefixed with `ccathome/<workflow-id>`.
  2. The starting branch remains untouched.

---

## Task 7: Workspace Path Containment (Adversarial)
* **Goal**: Verify that filesystem operations cannot escape the workspace root.
* **Setup**: A path-traversal payload targeting paths outside the workspace root (e.g., `../../etc/passwd` or absolute root files).
* **Action**: Execute `read_file` or `apply_patch` with the traversal path.
* **Success Criteria**:
  1. The request is hard-rejected by the Permission Gate before syscall execution.
  2. The response returns an access violation error payload.
  3. No files outside the workspace are read or written.

---

## Task 8: Long-Running Process Monitoring & Polling
* **Goal**: Start a background process and read its output dynamically.
* **Setup**: A long-lived Node.js HTTP server script.
* **Action**: Spawn the server using `run_command` and poll its logs.
* **Success Criteria**:
  1. The server starts and binds to a port.
  2. The initial call returns `status: "ready"` on port binding match.
  3. Subsequent logs can be read sequentially via `read_process_output` (Tier B).

---

## Task 9: Workflow DAG Diamond Dependency Resolution
* **Goal**: Correctly schedule and run steps in topological order.
* **Setup**: A 4-step DAG with diamond dependencies (`Step A` -> `Step B` and `Step C` -> `Step D`).
* **Action**: Initiate execution.
* **Success Criteria**:
  1. `Step A` runs first.
  2. `Step B` and `Step C` run concurrently or sequentially in any order after `Step A` finishes.
  3. `Step D` runs only after both `Step B` and `Step C` are `completed`.

---

## Task 10: Checkpoint Rollback after Execution Failure
* **Goal**: Verify complete rollback capability on exhausted retries.
* **Setup**: A failing step that exceeds the retry limit.
* **Action**: Trigger rollback to the pre-step checkpoint.
* **Success Criteria**:
  1. The state of files modified during the step is reverted to the pre-step SHA.
  2. Git history is rolled back to the pre-step SHA.
  3. The workflow step is marked `failed`.
