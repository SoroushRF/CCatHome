# ADR 0009 — HITL Approval Authority

* **Status**: Accepted
* **Deciders**: Engineering (remediation track R0)
* **Date**: 2026-07-11
* **Relates to**: audit findings S1, S2, L7; PRD §5.4; `ask_user.ts`; dashboard

## Context

The threat model for the Permission Gate is: the LLM must not execute dangerous (Tier 2+) actions **without the user noticing / approving**.

Today `ask_user` is Tier 0 and accepts `response: "approved" | "rejected"` over the same MCP tool channel the agent uses. Tests (and any agent) can self-approve. Approvals are sticky (`permission-gate.ts` never consumes them). The dashboard claims to be the approval surface but has no approve/reject API or UI, and the launch token is never printed.

## Decision

### Who may mutate confirmation state

| Channel | May create pending? | May approve/reject? |
|---|---|---|
| MCP `ask_user` without secret | Yes (and poll) | **No** |
| MCP `ask_user` with `approvalToken === process.env.CCATHOME_APPROVAL_TOKEN` | Yes | Yes (constant-time compare) |
| Dashboard HTTP API authenticated with dashboard launch token | N/A (reads pending) | **Yes** |

### Approval lifecycle

* Approvals are **single-use**: after a gated command is allowed via an approved row, mark the row `consumed` (or delete it). Identical command requires a new approval (closes S2).
* Pending lookup is scoped by `step_id` consistently between gate and `ask_user`.

### Clarification type

* `type: "clarification"` must wait for dashboard/secret resolution — not return `"No response received"` immediately (Phase R4).

### Auto-raise vs structured error

* The gate / `run_command` / `execute_step` path creates a pending row and returns/throws `requires_confirmation`.
* Auto-blocking poll inside MCP (current `ask_user` wait loop) remains available when the **client** calls `ask_user` without `response`.
* Dashboard must print `http://localhost:3141/?token=...` at startup so a human can approve.

## Consequences

* Phase R4 implements token print, approve/reject API+UI, `approvalToken` gate, consume-on-use, clarification wait.
* Existing tests that call `ask_user({ response: "approved" })` without a token must be updated to set `CCATHOME_APPROVAL_TOKEN` in test env or use the dashboard HTTP API.
* PRD §5.4 “automatically raises ask_user” is clarified in R6: engine raises a pending confirmation; the client or dashboard completes HITL.
