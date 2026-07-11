# PRD v2.1 — `CCatHome`

**Document status:** Accepted for engineering
**Version:** 2.1.0 (supersedes v2.0.0 — see Changelog §0.1)
**Owner:** Soroush
**Classification:** Internal design document

---

## 0. Document Control

### 0.1 Changelog

#### From v2.0.0 → v2.1.0 (remediation track)

| # | v2.0 Problem | v2.1 Resolution |
|---|---|---|
| 1 | Tier A budget listed as 11; `open_project` undocumented | Budget is **12** including `open_project` (ADR 0004) |
| 2 | `execute_step` described as engine-owned auto-resolve + internal auto-fix | Caller-supplied commands + engine duties (ADR 0003 / 0005) |
| 3 | Memory API documented as `key`/`value`/`category` | Public API is `content`/`tags` / `query`/`limit` (ADR 0006) |
| 4 | Context Manager claimed as universal central wrapper | Module `src/core/context-manager.ts` used selectively by high-output tools |
| 5 | Open `vm` vs `isolated-vm` decision (§11 dangling) | Keep Node `vm` with mitigations; residual risk (ADR 0001 / 0008) |
| 6 | Schema omitted HITL / summary / uniqueness | Document migrations 0002–0005 (`requires_confirmation`, `pending_confirmations`, `summary`) |
| 7 | Dashboard token deferred to hypothetical v2 HTTP | v1 dashboard on `:3141` requires startup token (ADR 0009) |
| 8 | Permission tiers listed `npm i` as Tier 0 | `npm install`/`ci` are Tier 2; bare `node` is Tier 2 |

#### From v1.0 → v2.0.0


| # | v1.0 Problem | v2.0 Resolution |
|---|---|---|
| 1 | `stream_command` assumed stdio supports server-initiated push | Replaced with log-file + polling model (§4.3) |
| 2 | "Embedded vector store" named with no implementation behind it | Replaced with SQLite FTS5 for v1; vector search explicitly deferred with a defined upgrade path (§4.6 / `project_memory`) |
| 3 | No design for context window pressure | Context Manager is now a first-class architectural layer (§4.3) |
| 4 | Security requirements stated without enforcement mechanism | 4-tier permission classification system with defined enforcement points (§6) |
| 5 | Implementation plan had no verifiable deliverables or exit criteria | Every phase below has explicit deliverables, acceptance criteria, and an integration gate (§9) |
| 6 | Success metrics had no benchmark methodology | Metrics now specify dataset, harness, and measurement procedure (§10) |
| 7 | Tool failure contracts undefined (`apply_patch`, `stream_command`, `recall`) | Every tool in §5 has a defined success and failure payload |
| 8 | Scope unbounded (browser automation, sub-agents, Docker — all "later") | Explicit v1/v2/non-goal scope boundary (§2) |
| 9 | No target client decision; assumed Claude Desktop, but designed around Code-only mechanisms | Target client formally decided: Claude Code primary, Desktop secondary profile (§3) |
| 10 | Tool count unmanaged (35+ implied, no loading strategy) | Tiered dispatcher architecture: 11 direct tools, ~13 dispatcher-routed (§5) |

### 0.2 Terminology

- **Workspace**: the target project directory the agent operates on.
- **Capability**: any unit of executable functionality the agent exposes, whether directly registered as an MCP tool (Tier A) or routed through the dispatcher (Tier B).
- **Step**: a node in the workflow DAG, representing one unit of planned work.
- **Checkpoint**: a recoverable snapshot of git state + file backups taken before a risky operation.

---

## 1. Problem Statement & Goals

### 1.1 Problem Statement

Claude Code provides an autonomous coding agent experience tied to a specific client and subscription path. Developers who want equivalent autonomy — planning, execution, self-healing, and persistence across sessions — while driving the agent from a different client (primarily Claude Code itself, with Claude Desktop as a constrained secondary target) need a portable execution layer that does not depend on Anthropic's internal agent harness.

### 1.2 Goals (v1)

1. Deliver an MCP server that gives any MCP-compatible client autonomous, multi-step software engineering capability: plan → execute → validate → self-heal → commit, without per-step human confirmation outside of defined safety gates.
2. Persist execution state (workflow graph, checkpoints, project memory) outside the model's context so sessions can be interrupted and resumed.
3. Keep the registered tool surface small enough that tool selection accuracy does not degrade, while keeping the underlying capability surface effectively unbounded.
4. Enforce security and rollback guarantees that are *implemented*, not merely asserted.

### 1.3 Non-Goals (v1)

Explicitly out of scope for this version, with rationale:

| Item | Rationale for exclusion |
|---|---|
| Browser automation (Playwright suite) | Adds a second automation surface and a new dependency tree before the core loop is proven. Revisit in v2 once the workflow engine and self-healing loop are validated in production use. |
| Docker-based sandboxing | Rejected as a default, not merely deferred — adds a hard dependency that contradicts the "local desktop tool" UX goal. May be offered as an *opt-in* execution backend in v2 for users who already have Docker. |
| Sub-agent orchestration / multi-agent delegation | Out of scope until the single-agent loop has a measured success rate (§10). Adding delegation before the base loop is reliable compounds failure modes. |
| Semantic (vector) memory recall | Deferred to v2. FTS5 is the v1 backing store; schema is designed to accept a vector index later without breaking the `recall` tool contract (§4.6). |
| LSP-grade code intelligence (`find_definition`, `find_references`) | Cut entirely from v1, not deferred. Pattern-based `detect_workspace` output is sufficient for the orientation use case; full LSP integration is a substantial project on its own and is not on the critical path to the core differentiator (the workflow + self-healing loop). |
| Windows-native shell parity | v1 targets macOS/Linux shells (`bash`/`zsh`). Windows support (`PowerShell` abstraction) is a tracked v2 item, not silently assumed working. |

---

## 2. Target Client Decision

### 2.1 Decision

**Claude Code is the primary target client.** Claude Desktop is supported as a secondary, capability-reduced profile.

### 2.2 Rationale

The three mechanisms that make a large agentic tool surface viable without degrading model performance — deferred tool loading, programmatic/compound tool execution, and output truncation — are only partially available depending on the client:

| Mechanism | Claude Code | Claude Desktop |
|---|---|---|
| Deferred tool loading (native tool search) | Supported natively; on by default | Not supported. `notifications/tools/list_changed` is received but discarded — confirmed non-compliant, no dynamic reveal possible. |
| Programmatic/compound execution | Available via hosted code execution at the API level (not applicable to our MCP layer either way) | Same — not an MCP primitive on any client |
| Output truncation | Fully controlled server-side | Fully controlled server-side |

Because two of three mechanisms are unavailable on **any** client at the MCP layer, this system implements DIY equivalents for both (the dispatcher pattern and the sandboxed script runner — §5), which work identically regardless of client. The client decision therefore only affects how aggressively we can rely on native deferred loading as a *supplement*:

- On **Claude Code**, Tier A tools can additionally be tagged `_meta: {"anthropic/alwaysLoad": true}`, allowing native tool search to manage anything we haven't already pulled into the dispatcher, as a second layer of headroom.
- On **Claude Desktop**, the dispatcher pattern alone must carry the full weight, since there is no native fallback. This is acceptable because the dispatcher design was sized assuming zero native support in the first place (§5).

### 2.3 Consequence

No part of this system's correctness depends on a client-native feature being present. Every token-management mechanism in this PRD is implemented at the server level. Native client support, where available, is a bonus, not a dependency.

---

## 3. System Architecture

### 3.1 High-Level Diagram

```
+-----------------------------------------------------------------+
|                      MCP Client (Claude Code /                  |
|                       Claude Desktop)                           |
+------------------------------+------------------------------------+
                               | MCP JSON-RPC (stdio)
                               v
+-----------------------------------------------------------------+
|                    CCatHome (Node.js / TS)                      |
|                                                                   |
|  +----------------+   +------------------+   +-----------------+ |
|  | Tier A Tools   |   | Dispatcher        |   | Context Manager | |
|  | (12 direct)    |-->| invoke() +        |-->| (truncation,    | |
|  |                |   | list_capabilities |   |  log_id/expand) | |
|  +----------------+   +------------------+   +-----------------+ |
|           |                     |                      |          |
|           v                     v                      v          |
|  +-------------------------------------------------------------+ |
|  |                Capability Implementation Layer               | |
|  |  filesystem | terminal | git | workflow | memory | script   | |
|  +-------------------------------------------------------------+ |
|           |                                                       |
|           v                                                       |
|  +-------------------------------------------------------------+ |
|  |  State Engine: SQLite (workflows, checkpoints, FTS5 memory) | |
|  +-------------------------------------------------------------+ |
|           |                                                       |
|           v                                                       |
|  +-------------------------------------------------------------+ |
|  |          Permission Tier Gate (0-3) — enforced here          | |
|  +-------------------------------------------------------------+ |
+------------------------------+------------------------------------+
                               |
                               v
+-----------------------------------------------------------------+
|                  Target Workspace (sandboxed path)               |
+-----------------------------------------------------------------+
                               |
                               v (optional, async, read-only consumer)
+-----------------------------------------------------------------+
|        Local Dashboard (localhost:3141) — SSE from State Engine  |
+-----------------------------------------------------------------+
```

### 3.2 Design Principles (carried forward and made enforceable)

1. **Claude plans, the server executes.** No capability returns partial control to the model mid-operation without an explicit, logged reason.
2. **Every registered tool earns its slot.** A capability is only directly registered (Tier A) if it is called with high frequency, is a session anchor, or is a flagship capability that must be discoverable without a lookup. Everything else is dispatcher-routed.
3. **State outlives the conversation.** Any data needed to resume work after a session, crash, or context reset lives in SQLite, never solely in the model's context.
4. **Security is enforced at a single chokepoint.** All execution — whether from a direct tool, the dispatcher, or the script runner — passes through the same Permission Tier Gate. There is no execution path that bypasses it.

---

## 4. Core Subsystems

### 4.1 Filesystem Subsystem

**Requirements:**
- All writes go through `apply_patch`. There is no `write_file` tool in v1 — full-file overwrites are achieved by patching from an empty/null base, keeping a single code path and a single failure contract.
- **Failure contract (`apply_patch`):**
  1. Original file is copied to `.ccathome/backups/<sha>.bak`.
  2. Patch is applied to a temp file, not the target.
  3. On success: atomic rename temp → target. Response: `{ success: true, appliedHunks: number, newSha: string }`.
  4. On failure (patch doesn't apply, `expectedSha` mismatch): temp file is discarded, target is untouched. Response: `{ success: false, error: "patch_failed" | "sha_mismatch", currentSha: string, reason: string }`. On `sha_mismatch`, the caller is expected to re-read the file and regenerate the patch against `currentSha` — this is the documented recovery path, not an open question.
- Path containment: every path argument is resolved with `path.resolve()` against the workspace root, then checked with `path.relative()` — if the relative path starts with `..` or is absolute outside the root, the call is hard-rejected at the gate (§6) before touching the filesystem. This is enforced once, centrally, not per-tool.

### 4.2 Terminal & Process Subsystem

**Requirements:**
- `run_command` is for ad-hoc, short-lived commands outside the active workflow graph (version checks, one-off inspection). It is explicitly *not* the entry point for build/test/install — those go through `execute_step`. Each tool's description names the other to remove ambiguity at the model's decision point.
- Long-running processes (dev servers) are handled as follows:
  1. Process is spawned; stdout/stderr are piped to `.ccathome/logs/<pid>.log`.
  2. The call returns immediately once one of: (a) a configurable readiness signal is matched (port bind, regex like `ready on localhost:\d+`), or (b) a timeout elapses (default 10s) — whichever comes first, with the response indicating which.
  3. Response: `{ pid: number, status: "ready" | "timeout" | "exited", logPath: string, recentOutput: string }`.
  4. Further inspection happens via `read_process_output(pid, fromLine?)`, a Tier B capability, which tails the log file from the given offset — this is the log-file/poll model that replaces the impossible stdio-push design from v1.
- Shell abstraction: v1 targets POSIX shells only (§2.3 non-goals). The shell driver is written behind an interface so a PowerShell driver can be added without changing the tool contract.

### 4.3 Context Manager (new in v2 — was entirely absent in v1)

Cross-cutting helpers live in `src/core/context-manager.ts` (`truncateChars`, `truncateLines`, `tailLines`, `outlineSource`, `summarizeCommandOutput`, `summarizeAttemptLog`). High-output tools call these helpers; this is **selective adoption**, not a universal response wrapper around every capability.

**Rules enforced today:**
- `read_file` on a file over ~300 lines returns an outline via `outlineSource` plus `totalLines` + `fileId`. Specific ranges use `read_file_section` (Tier B).
- `run_command` caps stdout/stderr with `tailLines(..., 20)` and always returns a hex `logId`. Full logs via `expand_log({ logId })`.
- `execute_step` stores complete `full_log` in SQLite and returns a truncated `summary` (also column `workflow_steps.summary`). `get_workflow_state` defaults to `summary` and only includes `fullLog` when `includeFullLog: true`.

### 4.4 Git Version Control Subsystem

- Automatic micro-commits occur at every successful `execute_step` completion, on a dedicated branch (`ccathome/<workflow-id>`), never on the user's active branch, removing the v1 ambiguity around mutating the working directory.
- Manual git operations (`git_diff`, `git_commit` with `amend`, `git_branch`, `git_checkout`) are Tier B, for cases where Claude needs to deviate from the automatic flow (e.g., squashing before a PR). The `amend` flag is explicitly documented as incompatible with the auto-commit cadence — calling it on a commit the engine itself created mid-step is rejected with `{ error: "amend_conflicts_with_autocommit" }` rather than silently producing a confusing history.

### 4.5 State & Workflow Engine

- DAG state machine in SQLite, schema below (§7).
- `execute_step` is the compound execution primitive (ADR 0003 / 0005). The **client supplies** `executionCommand`, `validationCommand`, and optional `recoveryCommand`; the engine enforces safety and loop duties:

```
execute_step({ workflowId, stepId, executionCommand, validationCommand, maxRetries, recoveryCommand? }):
  refuse if dependencies unmet → error dependencies_unmet
  → ensureBranchIsolation(workflowId)   // ccathome/<workflowId>
  → checkpoint
  → run executionCommand (nonzero exit = failure; skip validation)
  → run validationCommand (must exit 0)
  → on failure and retries remain: restore checkpoint; run recoveryCommand (nonzero aborts loop)
  → on success: auto-commit with [ccathome-auto] when dirty; mark COMPLETED; return { summary, logId, retryCount }
  → on exhausted retries / confirmation: FAILED or requires_confirmation
```

  `maxRetries: 0` = one attempt; `maxRetries: N` = one initial + up to N recovery cycles. Dynamic patch generation stays with the calling agent (ADR 0003).

### 4.6 Memory Subsystem

- Backing store: SQLite FTS5 (BM25 ranking) — chosen over a vector store for v1 because the memory content (architecture decisions, preferences, recurring bugs) is short, structured, and keyword-dense; semantic recall adds complexity without proportional benefit at this stage.
- Public Tier B API (ADR 0006): `remember({ content, tags? })` → `{ success, memoryId }`; `recall({ query, limit? })` → `{ success, memories: [{ id, content, tags, score }] }`. Storage columns remain FTS `key`/`value`/`category` (id → key, content → value, tags JSON → category).
- **Upgrade path:** `project_memory` includes nullable `embedding` UNINDEXED from day one. v2 may populate via `sqlite-vec` without changing the public tool contract.

### 4.7 Execution Sandbox & Script Runner (PTC equivalent)

- `run_script({ code, timeoutMs? })` executes inside Node's `vm` module (ADR 0001 / 0008). **Decision closed:** keep `vm` for v1; it is **not** a hard security boundary. Mitigations: default timeout (5s, capped), frozen sandbox object, buffered `console` → capped `log[]`, writes via `safeWriteFile`, bound `runCommand`/`readFile`/`writeFile` gated individually.
- Residual risk: prototype-chain / host escape payloads may still reach Node APIs; treat sandbox as defense-in-depth alongside the Permission Gate and path containment, not as isolation equivalent to `isolated-vm` or containers.
- Only the script's final return value (plus a capped action log) returns to the model's context.

---

## 5. Tool Architecture

### 5.1 Tier A — Directly Registered (12 tools)

Budget constant: `TIER_A_BUDGET = 12` in `src/core/dispatcher.ts` (ADR 0004).

| Tool | Input | Output | Notes |
|---|---|---|---|
| `invoke` | `{ capability: string, args: object }` | capability-specific | Dispatcher executor |
| `list_capabilities` | `{ query?: string }` | `{ matches: Array<{ name, description, schema }> }` (≤5) | Never includes Tier A names (§5.3) |
| `execute_step` | `{ workflowId, stepId, executionCommand, validationCommand, maxRetries?, recoveryCommand? }` | `{ success, status, stepId, summary, retryCount, logId? }` | Caller commands + engine duties, §4.5 / ADR 0005 |
| `run_script` | `{ code: string, timeoutMs? }` | `{ result?: any, log: string[] }` | Sandboxed orchestrator, §4.7 |
| `read_file` | `{ path: string }` | outline or content + `fileId` | Context-managed, §4.3 |
| `apply_patch` | `{ path, patch, expectedSha? }` | see §4.1 failure contract | Atomic temp+rename |
| `run_command` | `{ command: string, timeoutMs?, readinessPattern? }` | `{ stdout?, stderr?, exitCode?, logId, status? }` | Ad-hoc only, not build/test |
| `detect_workspace` | `{ path?: string }` | project info + optional retarget | Session anchor; retarget policy ADR 0004 |
| `create_workflow` | `{ name, steps: Array<{id, title, depends_on}> }` | `{ workflowId }` | Rejects cycles / duplicate ids |
| `get_workflow_state` | `{ workflowId?, stepId?, includeFullLog? }` | summary by default | fullLog opt-in |
| `ask_user` | `{ type, question?, options?, command?, risk?, response?, approvalToken? }` | `{ response? }` | Mutations need secret or dashboard, §5.4 / ADR 0009 |
| `open_project` | `{ path: string }` | `{ success, message?, projectInfo? }` | Workspace retarget; Tier 2 outside initial tree |

### 5.2 Tier B — Dispatcher-Routed (~13 capabilities, zero schema cost)

Filesystem: `search_files`, `list_directory`, `move_file`, `read_file_section`
Process: `kill_process`, `read_process_output`, `expand_log`
Git: `git_diff`, `git_commit`, `git_branch`, `git_checkout`
Memory: `remember`, `recall`
Checkpoint: `checkpoint`, `restore_checkpoint`

These are not registered as MCP tools. They exist only as routing targets inside `invoke`, documented only through `list_capabilities`. Adding a 25th capability costs zero context tokens.

### 5.3 Dispatcher Contract

- `list_capabilities` performs an FTS match against capability name + description, returning at most 5 results with full input schema, so Claude can call `invoke` correctly on the first attempt.
- **Hard rule:** `list_capabilities` results never include any Tier A tool name. This removes, by construction, any scenario where Claude has to decide whether to call something directly or through the dispatcher — if a name isn't in the lookup results, it was never a candidate.
- `invoke` on an unknown capability name returns `{ error: "unknown_capability", suggestion: <closest FTS match> }` rather than a generic failure, so the model can self-correct in the same turn.

### 5.4 `ask_user` — Merged HITL Tool

Replaces what would otherwise be two overlapping tools (`confirm_action`, `ask_user_question`):

- `type: "permission"` — engine/gate creates a `pending_confirmations` row and returns/throws `requires_confirmation`. MCP `ask_user` may create/poll; **approve/reject via MCP requires `approvalToken === CCATHOME_APPROVAL_TOKEN`**. Dashboard HTTP (launch token) may approve/reject. Approvals are **single-use** (ADR 0009).
- `type: "clarification"` — persists a pending clarification and waits for dashboard/secret resolution (does not return `"No response received"` immediately).

One tool, one schema, discriminated by `type`.

---

## 6. Security Model

### 6.1 Permission Tiers

| Tier | Behavior | Examples |
|---|---|---|
| 0 | Always allowed | `git status`, `git diff`, test runners (`npm test`, vitest), reads |
| 1 | Allowed within workspace scope | writes, `npm run <script>`, `git commit` |
| 2 | Requires explicit confirmation (dashboard or `approvalToken`) | `git push`, `npm install`/`ci`, bare `node`, outbound network, workspace retarget outside initial tree |
| 3 | Always blocked, no override | `rm -rf /`, path traversal (`../../`), `curl \| bash`, `sudo` |

### 6.2 Enforcement Architecture

- **Single chokepoint:** every execution path — `run_command`, the internal steps of `execute_step`, and every bound function callable from inside `run_script` — passes through one `classifyAndGate(command, context)` function before anything executes. There is no second code path that runs a command without going through this function. This is the direct fix for the v1 finding that `run_command` was "effectively unrestricted shell access."
- Path containment is enforced the same way for every filesystem-touching capability: resolve against workspace root, reject anything that escapes it, before the syscall.
- Classification is rule-based (command prefix + argument pattern matching) for v1. An LLM-based classifier for ambiguous commands is a tracked v2 idea, not a v1 dependency — v1 ships with a deliberately conservative static ruleset and defaults to Tier 2 (confirm) for anything it doesn't recognize, rather than defaulting to allow.

### 6.3 Server Authentication

v1 binds MCP to stdio and runs a **local HTTP/SSE dashboard on port 3141**. The dashboard **requires a startup-generated launch token**; the server prints `Dashboard: http://localhost:3141/?token=...` at boot. Unauthenticated requests receive 401. Optional `CCATHOME_APPROVAL_TOKEN` authorizes MCP-side confirmation mutations (ADR 0009). Any future remote HTTP transport must retain token auth as a hard requirement.

---

## 7. Data Model

Schema as of migrations `0001`–`0005` (forward-only under `db/migrations/`):

```sql
CREATE TABLE workflows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT CHECK(status IN ('pending','running','completed','failed','requires_confirmation')) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE workflow_steps (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    depends_on TEXT,           -- JSON array of step IDs
    status TEXT CHECK(status IN ('pending','running','completed','failed','requires_confirmation')) DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    full_log TEXT,
    summary TEXT,              -- truncated model-facing log (migration 0004)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_workflow_steps_workflow_id_id ON workflow_steps (workflow_id, id);

CREATE TABLE pending_confirmations (
    id TEXT PRIMARY KEY,
    step_id TEXT REFERENCES workflow_steps(id) ON DELETE CASCADE,
    command TEXT NOT NULL,
    status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    type TEXT CHECK(type IN ('permission', 'clarification')) DEFAULT 'permission',
    question TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE checkpoints (
    id TEXT PRIMARY KEY,
    workflow_step_id TEXT REFERENCES workflow_steps(id),
    git_sha TEXT,
    backup_meta TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE VIRTUAL TABLE project_memory USING fts5(
    key, value, category, embedding UNINDEXED
);

CREATE TABLE command_log (
    id TEXT PRIMARY KEY,
    pid INTEGER,
    log_path TEXT,
    status TEXT CHECK(status IN ('running','ready','exited','killed')),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 8. Non-Functional Requirements

| Requirement | Target | Measurement |
|---|---|---|
| Filesystem op latency | < 250ms p95 for files under 1MB | Benchmark harness, §10 |
| Path containment | 0 breaches | Adversarial test suite (traversal strings, symlink escapes) run in CI, not asserted in prose |
| Data locality | No workspace content leaves the host | Code review checklist item; no telemetry/network calls exist in v1 by construction — there is nothing to disable |
| Tool schema overhead | ≤ 12 Tier A schemas loaded per session | CI / `index.test.ts` asserts `TIER_A_TOOLS.size === TIER_A_BUDGET` |

---

## 9. Risks & Open Decisions

| Risk | Impact | Mitigation / Decision Needed |
|---|---|---|
| `run_script` sandbox escape | High — `vm` is not a hard boundary (ADR 0008) | Mitigations shipped (timeout, freeze, gated I/O); residual risk accepted for v1; revisit `isolated-vm` only if threat model requires it |
| Static command classifier misses a dangerous pattern | Medium | Default-to-confirm for unrecognized commands (§6.2); maintain the ruleset as a versioned, reviewed file, not inline logic |
| Auto-commit cadence pollutes git history on the user's actual branch | Medium | Mitigated by branch isolation (§4.4); needs an explicit squash/cleanup tool before merging back, tracked for Phase 3 |
| Dispatcher round-trip tax degrades perceived responsiveness for frequently-needed Tier B capabilities | Low-Medium | Re-evaluate Tier A/B split after first real usage data (§10); promote any Tier B capability that turns out to be high-frequency |
| FTS5 recall quality insufficient for prose-heavy memories | Low | Tracked v2 item (vector upgrade path), not a v1 blocker |

---

## 10. Success Metrics & Measurement Methodology

Unlike v1, every metric below specifies what is actually measured and how.

| Metric | Target | Benchmark Methodology |
|---|---|---|
| Autonomous step completion rate | Measured baseline first; no target asserted until harness data exists | Fixed suite of 10 scaffolded project tasks in `docs/benchmarks/v1-tasks.md` run via `npm run benchmark:v1` / harness scripts; completion = all steps reach `completed` without manual intervention beyond Tier 2 confirmations |
| Self-healing recovery | Measured rate of (auto-fix success + clean rollback) vs. (dirty state requiring manual cleanup) | Deliberate fault injection: introduce a syntax error mid-step in 5 of the 10 benchmark tasks; record outcome category |
| Path containment | 0 breaches, verified not asserted | Adversarial unit test suite run in CI on every commit (traversal, symlink, null-byte injection) |
| Tool-call round-trip overhead (dispatcher tax) | Measured, reported, not targeted in v1 | Compare total tool-call count and wall-clock time for an identical task run with Tier B capabilities vs. a hypothetical all-direct registration, on a sample of 5 tasks |

The previous version's "≥85% completion, 100% rollback integrity" figures are explicitly retracted — they had no benchmark behind them. v1's job is to *establish* the first real baseline, not assert one in advance.
