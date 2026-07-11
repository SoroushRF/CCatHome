# ADR 0004 — Tier A Budget Includes `open_project`

* **Status**: Accepted
* **Deciders**: Engineering (remediation track R0)
* **Date**: 2026-07-11
* **Relates to**: PRD §5.1 / §8; `docs/plans/REMEDIATION_TO_90.md` finding D-C; audit S3

## Context

PRD §5.1 and §8 specify a Tier A budget of **≤ 11** directly registered MCP tools. The shipped code registers **12** Tier A tools, including `open_project` (`src/core/dispatcher.ts` `TIER_A_TOOLS`, asserted in `src/index.test.ts`).

`open_project` was added as a session-anchor capability so a client can retarget `config.workspaceRoot` without restarting the MCP server. That meets AGENTS.md §2.1 criteria (session-anchor / high discoverability), but:

1. The PRD was never updated (AGENTS.md §1.1 violation).
2. Retargeting is currently Tier 0 with no allowlist (security finding S3).

## Decision

1. **Raise the Tier A budget to 12.** Keep `open_project` as a Tier A MCP tool.
2. Encode the budget as `TIER_A_BUDGET` next to `TIER_A_TOOLS` (Phase R1) and keep the CI assertion `TIER_A_TOOLS.size === TIER_A_BUDGET`.
3. **Security follows in Phase R2** (not this ADR’s implementation): capture `initialWorkspaceRoot` at startup; constrain retarget with an allowlist / Tier 2 confirmation when leaving the initial tree (ADR scope for product placement only).

## Consequences

* PRD §5.1 / §8 must be updated in Phase R6 to say 12 tools and document `open_project`.
* `docs/tools/open_project.md` remains required and must describe the post-R2 security policy.
* Removing `open_project` from Tier A is rejected: it is already shipped and is a legitimate session anchor.
