# ADR 0005 — `execute_step` Contract: Caller Commands + Engine Duties

* **Status**: Accepted
* **Deciders**: Engineering (remediation track R0)
* **Date**: 2026-07-11
* **Extends**: ADR 0003 (caller-supplied `recoveryCommand`)
* **Relates to**: PRD §4.5 / §5.1; findings L1–L6

## Context

PRD §4.5 / §5.1 describe `execute_step` as roughly `{ step_id? }` → engine resolves the next runnable step, runs an internal action definition, auto-fixes, and returns `{ step_id, status, summary, logId }`.

Shipped code requires caller-supplied `workflowId`, `stepId`, `executionCommand`, `validationCommand`, and optional `recoveryCommand` (ADR 0003). That client/engine split is correct for an MCP server, but the engine still fails several **engine duties** the product claims:

| Duty | Claimed | Shipped |
|---|---|---|
| DAG readiness before run | Yes | No (`getRunnableSteps` unused) |
| Branch isolation `ccathome/<workflow-id>` | Yes | Helper exists; not wired |
| Auto-commit on success | Yes | Missing |
| Success = exec **and** validation exit 0 | Implied | Validation only |
| Recovery failure handling | Implied | Logged and ignored |
| `maxRetries` semantics | Documented loosely | Off-by-one vs tests |
| Structured `summary` / `logId` return | PRD | Missing |

## Decision

**Keep the caller-supplied command contract** (ADR 0003 stands). Update PRD text in R6 to match.

**Engine must enforce** (Phase R3):

1. Refuse steps that are not DAG-runnable (`dependencies_unmet`) unless resuming `requires_confirmation` / eligible retry with deps still completed.
2. Call `ensureBranchIsolation(workflowId)` before work.
3. Treat nonzero `executionCommand` exit as failure (do not succeed on validation alone).
4. Abort the retry loop when `recoveryCommand` exits nonzero.
5. Define `maxRetries` as: `0` → one attempt; `N` → one initial attempt plus up to `N` recovery cycles.
6. On success: auto-commit on the isolated branch with a `[ccathome-auto]` marker.
7. Return `{ success, status, stepId, summary, retryCount, logId? }`.

**Client remains responsible for**: generating patches / recovery commands, choosing which step to run, and Tier 2 approvals via HITL (ADR 0009).

## Consequences

* Breaking change vs PRD prose, **not** vs shipped tool I/O (additive fields / stricter success). Document in CHANGELOG when R3 lands.
* Integration tests that manually mark dependencies complete to bypass DAG must gain negative-path coverage for `dependencies_unmet`.
