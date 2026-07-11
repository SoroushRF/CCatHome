# CCatHome Benchmark Results v1

**Last updated:** 2026-07-11  
**Remediation:** Phases R0–R7 (`docs/plans/REMEDIATION_TO_90.md`)

This document **must not** conflate Vitest unit/integration pass rates with autonomous
completion of the 10 scaffolded tasks in `v1-tasks.md`. The harness below drives the same
capabilities with scripted success criteria — it is **not** an LLM-in-the-loop agent run.

---

## A) Unit / integration regression (Vitest)

| Suite | Role | Status |
| :--- | :--- | :--- |
| `src/**/*.test.ts` (excl. optional filter) | Capability + gate + workflow + HITL regression | `npm test` — CI gate |
| `src/security/*.test.ts` | Dedicated adversarial suite (R7.3) | `vitest run src/security` / CI `adversarial` job |

---

## B) E2E harness (`npm run benchmark:v1`)

| Task | Intent | Harness file | Status |
| :--- | :--- | :--- | :--- |
| 1 Patch | `apply_patch` | `src/benchmarks/task1.test.ts` | Pass |
| 2 Build | `execute_step` → dist | `src/benchmarks/task2.test.ts` | Pass |
| 3 Tests | step summary | `src/benchmarks/task3.test.ts` | Pass |
| 4 Compile recovery | caller `recoveryCommand` | `src/benchmarks/task4.test.ts` | Pass |
| 5 Test recovery | caller `recoveryCommand` | `src/benchmarks/task5.test.ts` | Pass |
| 6 Branch isolation | `ccathome/<id>` | `src/benchmarks/task6.test.ts` | Pass |
| 7 Path containment | adversarial paths | `src/benchmarks/task7.test.ts` | Pass |
| 8 Process polling | readiness + `read_process_output` | `src/benchmarks/task8.test.ts` | Pass |
| 9 DAG diamond | deps gating | `src/benchmarks/task9.test.ts` | Pass |
| 10 Checkpoint rollback | restore after fail | `src/benchmarks/task10.test.ts` | Pass |

### Harness runs

| Date | Commit | Command | Result |
| :--- | :--- | :--- | :--- |
| 2026-07-11 | `0f58e6d` | `npm run benchmark:v1` | **10/10 passed** (≈30s) |

---

## Methodology notes

- Tasks 4–5 use **caller-supplied** `recoveryCommand` (ADR 0003), not an internal LLM auto-fixer.
- Path containment and gate chaining are also covered by `src/security/adversarial.*.test.ts`.
- CLI: `npm run benchmark:v1 -- --task <id>` filters by Vitest test name (`task N`).
