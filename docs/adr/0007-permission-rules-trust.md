# ADR 0007 — `permission-rules.json` Load Trust Boundary

* **Status**: Accepted
* **Deciders**: Engineering (remediation track R0)
* **Date**: 2026-07-11
* **Relates to**: audit finding S15; `src/core/permission-gate.ts`

## Context

`loadRulesConfig()` currently tries, in order:

1. `config.workspaceRoot/permission-rules.json`
2. `process.cwd()/permission-rules.json`
3. Package-relative path via `import.meta.url`

Rules are cached after the first successful load. Combined with `open_project` / `detect_workspace` retargeting the workspace (S3), an agent can point the workspace at a tree that contains a malicious `permission-rules.json` (e.g. empty Tier 3, `defaultTier: 0`) **before** the first classify call, poisoning the gate for the process lifetime.

## Decision

**Never load `permission-rules.json` from `config.workspaceRoot`.**

Load only from the **server install / package path** (resolved from `import.meta.url` / packaged location). `process.cwd()` may be used only as a last-resort fallback when it is the package root during development, not as a workspace-relative path.

Workspace trees must not be able to override the security policy.

## Consequences

* Implementation in Phase R2 Task R2.1.1.
* Operators who want custom rules must place them in the server install directory or ship a fork — not inside the target project.
* Unit test must prove a malicious workspace file is ignored.
* This ADR does not by itself fix S3 (retarget); it removes the rule-poisoning amplifier.
