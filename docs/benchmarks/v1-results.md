# CCatHome Benchmark Results v1

**Last updated:** 2026-07-11  
**Remediation:** Phases R0–R7 (`docs/plans/REMEDIATION_TO_90.md`)

This document **must not** conflate Vitest unit/integration pass rates with autonomous
completion of the 10 scaffolded tasks in `v1-tasks.md`.

---

## A) Unit / integration regression (Vitest)

| Suite | Role | Status |
| :--- | :--- | :--- |
| `src/**/*.test.ts` | Capability + gate + workflow + HITL regression | Run `npm test` — authoritative CI gate |
| `src/security/*.test.ts` | Dedicated adversarial suite (R7) | Run `npm run test:adversarial` |

These tests exercise real temp workspaces and git where needed, but they are **not** an
agentic E2E harness that drives an LLM through `v1-tasks.md`.

---

## B) E2E harness status

| Task | Intent | Harness | Status |
| :--- | :--- | :--- | :--- |
| 1 Patch | `apply_patch` | `scripts/run-benchmark-task.ts --task 1` | Scaffolded (R7) |
| 2 Build | `execute_step` validation | `--task 2` | Scaffolded |
| 3 Tests | process + step | `--task 3` | Scaffolded |
| 4 Compile recovery | caller `recoveryCommand` | `--task 4` | Scaffolded |
| 5 Test recovery | caller `recoveryCommand` | `--task 5` | Scaffolded |
| 6 Branch isolation | `ccathome/<id>` | `--task 6` | Scaffolded |
| 7 Path containment | adversarial paths | `--task 7` | Scaffolded |
| 8–10 Process / concurrency / rollback | process + checkpoint | `--task 8`…`10` | Scaffolded |

Record dated results with commit SHA under **Harness runs** below when executed.

### Harness runs

| Date | Commit | Command | Result |
| :--- | :--- | :--- | :--- |
| 2026-07-11 | _(fill on run)_ | `npm run benchmark:v1` | Pending / see CI |

---

## Methodology notes

- Tasks 4–5 use **caller-supplied** `recoveryCommand` (ADR 0003), not an internal LLM auto-fixer.
- Path containment and gate chaining are proven primarily by adversarial unit tests, not by claiming “100% benchmark.”
