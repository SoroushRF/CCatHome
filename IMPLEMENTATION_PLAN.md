# Implementation Plan v2.0 — `CCatHome`

> **Active delivery track (2026-07-11+):**  
> Phases 0–3 below are **historical**. An objective audit found material gaps between claimed completion and enforced behavior (security bypasses, unwired DAG/isolation/auto-commit, HITL/dashboard holes, doc↔code drift, dishonest benchmark claims).  
> **Authoritative remaining work:** [`docs/plans/REMEDIATION_TO_90.md`](docs/plans/REMEDIATION_TO_90.md) (Phases R0–R7).  
> Execute that plan with **one Task = one commit**. Do not treat this v2.0 checklist as “done.”

---

## Guiding Rule for This Plan

Every step below has a **deliverable** (a concrue artifact: code, test, or document), an **acceptance criterion** (a binary, verifiable check), and contributes to a phase-level **integration gate** — no phase is considered complete based on a feature list alone.

---

## Phase 0: Foundations & Decisions (Week 0, before any feature code)

This phase did not exist in v1 and is the direct fix for "the plan has no risk handling, just a feature list."

| Step | Deliverable | Acceptance Criterion |
|---|---|---|
| 0.1 Repo scaffold | TypeScript repo, `tsup`, `zod`, `@modelcontextprotocol/sdk`, lint/format config, CI pipeline (lint + typecheck + unit tests on push) | CI passes on an empty scaffold commit |
| 0.2 Sandbox decision | Written ADR (Architecture Decision Record) choosing `vm` vs `isolated-vm` for `run_script`, with explicit security trade-off analysis | ADR merged to `docs/adr/0001-sandbox-runtime.md` before any Phase 2 script-runner code is written |
| 0.3 Command classification ruleset | `permission-rules.json` (or equivalent) defining Tier 0-3 patterns as data, not inline code | File exists, is loaded by a passing unit test that asserts at least one example command per tier |
| 0.4 Benchmark task suite definition | The 10 scaffolded project tasks referenced in PRD §10, written down with expected outcomes | Document checked into `docs/benchmarks/v1-tasks.md` |

**Phase 0 exit gate:** CI is green, the ADR is merged, and the benchmark suite exists in writing before Phase 1 begins. No code beyond scaffolding is written until this gate passes.

---

## Phase 1: Core Execution Layer (Weeks 1–3)

### Step 1.1 — Router, Dispatcher, and Permission Gate skeleton
- **Deliverable:** `core/router.ts`, `core/dispatcher.ts`, `core/permission-gate.ts`. The gate is wired in as the single chokepoint described in §6.2, even before real capabilities exist behind it — proven with a stub capability.
- **Acceptance criterion:** A unit test demonstrates that a Tier 3 stub command is rejected *before* the stub's execution function is called (verified via a spy/mock, not just by checking the response).

### Step 1.2 — Filesystem capabilities
- **Deliverable:** `apply_patch` with the full copy-on-write contract from PRD §4.1, `read_file` with context-manager outlining, `search_files`, `list_directory`, `move_file` (Tier B).
- **Acceptance criterion:** Test suite includes: successful patch, stale-SHA patch (asserts `sha_mismatch` payload shape), malformed patch (asserts target file untouched), and a path-traversal attempt (asserts gate rejection, not a filesystem error).

### Step 1.3 — Terminal & process capabilities
- **Deliverable:** `run_command`, the log-file-based long-running process model from §4.2, `read_process_output`, `kill_process`.
- **Acceptance criterion:** An integration test spawns a real long-lived process (e.g. a Node http server), confirms `status: "ready"` is returned on port-bind detection within the timeout, and confirms `read_process_output` returns correct content after the process logs additional output post-return.

### Step 1.4 — Git subsystem
- **Deliverable:** `git_status`-equivalent internal helper, `git_diff`, `git_commit`, branch-isolation logic (auto-creates `ccathome/<workflow-id>` on first commit).
- **Acceptance criterion:** Integration test confirms commits made by the agent never appear on the branch that was checked out when the server started.

**Phase 1 integration gate:** A single end-to-end test runs: detect a scaffolded repo → apply a patch → run a command against the patched code → commit. All four subsystems are exercised together, through the gate, in one test. This is the cross-tool integration testing v1 explicitly lacked.

---

## Phase 2: Workflow Engine, Memory, and the Compound Loop (Weeks 4–6)

### Step 2.1 — DAG workflow engine
- **Deliverable:** `create_workflow`, `get_workflow_state`, dependency resolution logic (topological readiness check).
- **Acceptance criterion:** Test constructs a 5-node DAG with a diamond dependency shape; confirms the engine correctly identifies runnable nodes at each stage and rejects creating a workflow with a cycle.

### Step 2.2 — `execute_step` compound loop
- **Deliverable:** Full micro-loop from PRD §4.5: pre-checkpoint → execute → validate → conditional auto-fix → commit-or-fail-report.
- **Acceptance criterion:** Three scripted scenarios, each with an assertion on the *returned structure*, not just pass/fail: (a) clean success, (b) validation failure followed by successful auto-fix, (c) validation failure exceeding retry threshold, returning a structured failure report with no silent rollback.

### Step 2.3 — Checkpoint & rollback
- **Deliverable:** `checkpoint`, `restore_checkpoint`, wired so a failed `execute_step` retry sequence can be manually rolled back via `restore_checkpoint` (deliberately not automatic — see §9 risk).
- **Acceptance criterion:** Test deliberately corrupts a file mid-step, confirms `restore_checkpoint` returns the file and git state to the pre-step snapshot exactly (byte-for-byte file comparison, not just "no error").

### Step 2.4 — Memory subsystem
- **Deliverable:** `remember`, `recall` over FTS5, schema with the reserved `embedding` column.
- **Acceptance criterion:** Test inserts 20 varied memory entries, confirms `recall` returns relevant results ranked above irrelevant ones for at least 3 representative queries (qualitative ranking check, documented in the test itself, not asserted as a number).

### Step 2.5 — Sandboxed script runner
- **Deliverable:** `run_script`, implemented per the ADR from Step 0.2, with bound capability functions individually gated (PRD §4.7's critical correction).
- **Acceptance criterion:** A test script calls a bound `runCommand` with a Tier 3 pattern from *inside* the sandbox; asserts the gate intercepts it exactly as it would a direct `run_command` call — proving there is no bypass via the script path.

**Phase 2 integration gate:** A workflow of 3+ steps, including one step that intentionally fails validation, runs end-to-end via `execute_step` calls only (no direct subsystem calls), and produces a correct, recoverable failure report. This is run against the Phase 0.4 benchmark suite for the first time — establishing the first real (not asserted) baseline numbers for PRD §10.

---

## Phase 3: Dispatcher Maturity, Hardening, and Benchmarking (Weeks 7–8)

### Step 3.1 — `list_capabilities` and full Tier B migration
- **Deliverable:** All Tier B capabilities (§5.2) routed exclusively through `invoke`; `list_capabilities` implemented with the "never surfaces Tier A names" rule enforced by a test, not just a comment.
- **Acceptance criterion:** A test asserts the literal string of every Tier A tool name is absent from any `list_capabilities` response across a representative set of queries.

### Step 3.2 — `ask_user` and confirmation flow
- **Deliverable:** `ask_user` merged tool (§5.4), wired so a Tier 2 permission gate rejection automatically raises it rather than returning a bare error.
- **Acceptance criterion:** Integration test: a Tier 2 command is attempted inside `execute_step`; confirms the step pauses in a `requires_confirmation` state rather than failing the step outright, and resumes correctly once `ask_user` receives a simulated approval.

### Step 3.3 — Full benchmark run & security adversarial pass
- **Deliverable:** All 10 benchmark tasks from Phase 0.4 run end-to-end; full adversarial path-containment and sandbox-escape test suite run and passing.
- **Acceptance criterion:** Results recorded in `docs/benchmarks/v1-results.md` with actual pass/fail/partial counts — this document *is* the v1 success-metrics report, replacing the fabricated figures from the original PRD.

### Step 3.4 — Dashboard (optional, time-permitting within this phase, not a blocker for v1 sign-off)
- **Deliverable:** `localhost:3141` web UI, SSE-fed from the State Engine, showing workflow state, live logs, file tree, checkpoint history.
- **Acceptance criterion:** Manual verification — a user can observe a full benchmark task run live in the browser without needing to read raw tool output in the client.

**Phase 3 integration gate (= v1 sign-off):** Benchmark results document exists with real numbers. Adversarial security suite passes with 0 breaches. `ask_user` flow verified end-to-end. Dashboard is present or explicitly descoped with a written reason — not silently dropped.

---

## Cross-Phase Practices (apply throughout, not a separate phase)

- Every Tier A and Tier B tool ships with its failure contract documented in the same PR as its implementation — no tool is merged with an "undefined behavior on error" gap.
- Every PR that touches `core/permission-gate.ts` requires a second reviewer, given its role as the single security chokepoint.
- No phase's "done" status is self-declared by completing the feature list; it is declared by the integration gate test suite passing in CI.
