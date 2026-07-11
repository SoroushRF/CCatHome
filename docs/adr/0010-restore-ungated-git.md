# ADR 0010 — `restore_checkpoint` Ungated Git Reset

* **Status**: Accepted
* **Deciders**: Engineering (remediation track R5)
* **Date**: 2026-07-11
* **Relates to**: `restore_checkpoint.ts`, `scripts/lint-gate-bypass.js`, ADR 0005

## Context

`restore_checkpoint` must hard-reset and clean the worktree to a prior SHA as part of the
`execute_step` auto-fix loop. Routing `git reset --hard` / `git clean -fd` through
`classifyAndGate` would re-enter Tier 2 confirmation mid-recovery and deadlock HITL.

## Decision

Keep **ungated** `runCommandUngated` for restore’s reset/clean only:

1. Call sites remain allowlisted in the gate-bypass lint (`checkpoint.ts`, `restore_checkpoint.ts`).
2. Restore already requires a known `checkpointId` created by the engine for the active step.
3. Fail loudly when a listed backup file/dir is missing (`backup_missing`).
4. Do not expose ungated reset as a public Tier B capability.

## Consequences

* Lint allowlist for `runCommandUngated` stays until a future internal auto-approval context exists.
* Operators must treat checkpoint restore as trusted engine machinery, not an agent-callable escape hatch.
