# ADR 0010 — `restore_checkpoint` Ungated Git Reset

* **Status**: Accepted
* **Deciders**: Engineering (remediation track R5)
* **Date**: 2026-07-11
* **Relates to**: `restore_checkpoint.ts`, `scripts/lint-gate-bypass.js`, ADR 0005
* **Updated**: 2026-07-11 — enforce point 4 (not agent-callable); argv ungated spawn

## Context

`restore_checkpoint` must hard-reset and clean the worktree to a prior SHA as part of the
`execute_step` auto-fix loop. Routing `git reset --hard` / `git clean -fd` through
`classifyAndGate` would re-enter Tier 2 confirmation mid-recovery and deadlock HITL.

## Decision

Keep **ungated** git reset/clean for restore only, with these constraints:

1. Call sites remain allowlisted in the gate-bypass lint (`checkpoint.ts`, `restore_checkpoint.ts`).
2. Use `runArgvUngated` (no shell) with `assertSafeGitRef` on the stored SHA — never interpolate into `shell:true`.
3. Fail loudly when a listed backup file/dir is missing (`backup_missing`); contain `backupPath` via `resolveSafePath`.
4. Do **not** register `checkpoint` / `restore_checkpoint` as public Tier B capabilities. `execute_step` imports handlers directly; agents cannot `invoke` them.

## Consequences

* Lint allowlist for ungated runners stays until a future internal auto-approval context exists.
* Operators must treat checkpoint restore as trusted engine machinery, not an agent-callable escape hatch.
* `list_capabilities` / `invoke` will not surface these names after bootstrap.
