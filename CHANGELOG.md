# Changelog

All notable changes to the `CCatHome` server will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Notes
- Remediation Phases R0–R5 landed on `main`; R6–R7 docs/test/release track in progress (`docs/plans/REMEDIATION_TO_90.md`).
- Historical `[2.0.0]` bullets annotated where superseded by Unreleased remediation entries.

### Added
- Migration `0003-workflow-step-composite.sql`: unique index on `workflow_steps(workflow_id, id)`.
- Migration `0004-step-summary.sql`: `workflow_steps.summary` column for truncated model-facing logs.
- Migration `0005-confirmation-type.sql`: confirmation `type`/`question` for clarification HITL.
- `execute_step` returns `stepId`, `summary`, and `logId` (ADR 0005 / remediation R3.3.4–5).
- Context manager (`src/core/context-manager.ts`) used by read_file / run_command / execute_step.
- Dashboard HITL approve/reject API + token URL print (ADR 0009 / R4).
- ADR 0010: restore_checkpoint ungated reset rationale.

### Changed
- Moved `npm install` / `npm i` / `npm ci` from Tier 0 to Tier 2 (lifecycle script risk; remediation R2.1.3).
- Removed `^node\\b` from Tier 1 auto-allow (remediation R2.1.2).
- `execute_step` enforces DAG readiness, branch isolation, auto-commit, exec+validation success, and recovery abort (remediation R3).
- `ask_user` requires `approvalToken` matching `CCATHOME_APPROVAL_TOKEN` to mutate confirmations.
- Approvals are single-use (consumed by the permission gate after allow).
- `list_capabilities` returns at most 5 ranked matches.

### Fixed
- `execute_step` refuses DAG-blocked steps with `dependencies_unmet` (remediation R3.1.1).
- `create_workflow` rejects duplicate step ids (remediation R3.1.2).
- `detect_workspace` discovery test now uses a platform-absolute temp path (Linux CI).
- `run_command` flushes/closes the log write stream on child `close` so `expand_log` sees stderr.
- Checkpoint copies untracked directories, parses renames, and fails on missing backups.
- Patch parser keeps hunks open across `\\ No newline at end of file`.
- Recall LIKE fallback escapes `%`/`_` metacharacters.

---

## [2.0.0] - 2026-06-29

### Added
- Stdio Model Context Protocol (MCP) server integration using `@modelcontextprotocol/sdk`.
- Static capability bootstrap registration module registering Tier A + Tier B capabilities (historically phrased as “26”; current budget is **12 Tier A** — see Unreleased / ADR 0004).
- Live glassmorphic web dashboard with Server-Sent Events (SSE) server on port 3141.
- Authentication tokens and security cookies protecting local dashboard server requests.
- Gated filesystem VM sandbox interface intercepting `readFile` and `writeFile` statements.
- Cycle-detection check validating diamond-shaped DAG workflow configurations.
- Levenshtein-distance tool typo suggestions when executing dispatch invoke.
- Static gate bypass validator script checks inside `npm run lint`.
- Atomic temp-write + rename for `apply_patch` (not full CoW filesystem semantics).

### Changed
- Refactored `runCommandGated` to run command operations via `child_process.spawn` instead of `exec`, resolving the 1MB buffer cap issue.
- Updated path containment checks (`resolveSafePath`) to validate fully resolved real paths via `fs.realpathSync` to block symlink escapes.
- Moved `npm install` utility commands to Tier 0 (auto-allowed). **Superseded:** Unreleased / R2.1.3 moves `npm install`/`ci` to Tier 2.
- Moved `git checkout`, `git reset`, and `git clean` commands to Tier 2 (requires confirmation).
- Modified Tier 3 blocked patterns to run unanchored regexes preventing chaining bypasses.

### Fixed
- Fixed typo `node-node` to `node-version: '20'` in the GitHub actions CI pipeline script.
- Added `npm run build` compilation step to CI checklist.
