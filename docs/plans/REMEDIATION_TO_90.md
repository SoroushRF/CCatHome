# Remediation Plan — Push CCatHome to 90+ Quality

**Document status:** Active engineering plan  
**Version:** 1.0.0  
**Date:** 2026-07-11  
**Supersedes for delivery tracking:** `IMPLEMENTATION_PLAN.md` v2.0 (Phases 0–3 are treated as historically claimed; this plan is the authoritative remaining work)  
**Source of truth hierarchy (AGENTS.md §1.1):** `PRD.md` → this plan → `docs/adr/*.md` → inline comments  
**Origin:** Objective audit of logic, security, testing, and product honesty (2026-07-11). Baseline quality score: **~52/100**. Target: **≥90/100**.

---

## 0. How to execute this plan

### 0.1 Non-negotiable commit discipline

> **Every Task below is exactly one git commit.**  
> Do not batch Tasks. Do not squash mid-phase unless the user explicitly asks.  
> Commit message format: `<type>(<scope>): <imperative summary>`  
> Types: `fix`, `feat`, `docs`, `test`, `refactor`, `chore`, `security`, `ci`.  
> After each commit: `npm run typecheck && npm run lint && npm test` must pass (unless the Task is explicitly a known red→green intermediate — those are marked `ALLOW-RED` and must be followed immediately by a green Task).

### 0.2 PR discipline (AGENTS.md §1.4 / §2.x)

- Prefer **one Phase Step = one PR** (or one ADR = one PR). Never mix unrelated Steps.
- Any PR that touches `src/core/permission-gate.ts` requires a second reviewer (AGENTS.md §2.6).
- New external dependencies require a one-line justification in the PR body (AGENTS.md §1.4).
- Breaking tool contract changes require: ADR + major version bump + `CHANGELOG.md` + `docs/tools/<name>.md` changelog section (AGENTS.md §1.2).

### 0.3 Definition of Done for “90+”

The repo scores ≥90 only when **all** of the following are true:

| # | Criterion | Verification |
|---|---|---|
| D1 | CI green: build, lint, typecheck, unit/integration, adversarial, coverage gate | `.github/workflows/ci.yml` |
| D2 | Zero known complete security bypasses from the 2026-07-11 audit | Adversarial suite + manual checklist in Phase R7 |
| D3 | Flagship product contracts enforced in code (DAG, branch isolation, auto-commit, HITL) | Integration tests in Phase R3/R4 |
| D4 | PRD ↔ code ↔ `docs/tools/*` ↔ README ↔ CHANGELOG ↔ package version aligned | Doc audit checklist Phase R6 |
| D5 | Benchmark results are honest (separate harness or clearly labeled unit coverage) | `docs/benchmarks/v1-results.md` rewrite |
| D6 | AGENTS.md rules are enforceable by CI where claimed (gate lint, magic strings, Tier A budget) | Custom lint + tests |
| D7 | README setup works on clean checkout | Manual/scripted smoke in Phase R7 |
| D8 | No failing tests; flaky races fixed | `npm test` stable locally + CI |

### 0.4 Scoring rubric this plan optimizes

| Dimension | Baseline | Target | Primary phases |
|---|---:|---:|---|
| Structure & conventions | 72 | 90 | R0, R5, R6 |
| Logic / product contracts | 45 | 92 | R3, R5 |
| Security | 32 | 90 | R2, R4, R7 |
| Testing | 52 | 90 | R1, R7 |
| Docs / honesty | 40 | 92 | R0, R6 |
| **Overall** | **52** | **≥90** | All |

### 0.5 Decision policy before coding

Several audit findings are **product decisions**, not pure bugs. Phase R0 locks them via ADRs so later Tasks do not thrash. Default recommendations (override only via ADR):

| Decision | Recommendation | Rationale |
|---|---|---|
| Keep `open_project` as Tier A? | **Yes, keep Tier A**; raise PRD budget to **12**; require Tier 2 confirmation + path allowlist for retarget | Already shipped; high session-anchor value; must not remain ungated |
| `execute_step` input contract | **Keep caller-supplied commands** (ADR 0003); add DAG gate, isolation, auto-commit, stricter success | Align PRD §4.5/§5.1 text to ADR 0003 reality |
| `remember`/`recall` API | **Keep code shape** (`content`/`tags`/`limit`); update PRD §4.6 | Code is coherent; PRD is stale |
| Sandbox runtime | **Keep `vm` for v1** (ADR 0001) but implement documented mitigations (timeout, freeze, no host `console`, escape regression tests); document residual risk honestly | Portability; do not pretend it is a security boundary |
| CoW wording | Rename claims to **“atomic temp-write + rename”** / **“git SHA + file backups”** | Honesty |
| Version numbers | Bump package to **2.1.0** after remediation (minor: hardening + contract clarifications that are additive; use **3.0.0** only if we break tool I/O) | AGENTS semver |

---

## 1. Audit inventory (what this plan fixes)

### 1.1 Critical — security

| ID | Finding | Primary refs |
|---|---|---|
| S1 | Agent can self-approve Tier 2 via `ask_user({ response: "approved" })` | `src/tools/system/ask_user.ts:64-84` |
| S2 | Approvals sticky (never consumed) | `src/core/permission-gate.ts:146-148` |
| S3 | `open_project` / `detect_workspace` retarget any path at Tier 0 | `open_project.ts:45-46`, `detect_workspace.ts:27-28` |
| S4 | `^node\b` is Tier 1 → arbitrary ungated code | `permission-rules.json:37` |
| S5 | Prefix-anchored Tier 0/1 + shell chaining false negatives | `permission-gate.ts:88-109`, `permission-rules.json` |
| S6 | `vm` sandbox escapable; no timeout; host `console` | `run_script.ts:65-79`, ADR 0001 |
| S7 | Sensitive-path Tier 3 only matches synthetic `write_file` strings | `permission-rules.json:73-76`; `apply_patch.ts` ungated |
| S8 | `npm i` / `npm install` / `npm ci` Tier 0 (lifecycle scripts) | `permission-rules.json:19-21` |
| S9 | Git helpers shell-inject via unquoted interpolation | `git_branch.ts:28`, `git_checkout.ts`, `git_commit.ts` |
| S10 | Gate-bypass lint weaker than AGENTS.md claims | `scripts/lint-gate-bypass.js`, AGENTS.md §1.3 |
| S11 | Dashboard token never printed → 401 forever | `dashboard-server.ts:423`, `index.ts:63-64` |
| S12 | Dashboard XSS via `innerHTML` | `dashboard-server.ts:318-387` |
| S13 | `expand_log` trusts `logId` path segment | `expand_log.ts:30` |
| S14 | Full `process.env` leaked to every spawn | `run_command.ts:79`, `process-runner.ts` |
| S15 | Workspace can poison `permission-rules.json` load order | `permission-gate.ts:43-60` |
| S16 | Pipe-to-shell Tier 3 incomplete (`|/bin/bash`, `$()`, backticks) | `permission-rules.json:71-72` |

### 1.2 Critical — product logic

| ID | Finding | Primary refs |
|---|---|---|
| L1 | `execute_step` ignores DAG readiness | `execute_step.ts:46-75` vs `workflow-engine.ts:100-126` |
| L2 | Branch isolation never wired into workflow path | `git-utils.ts:18-42` only called from tests |
| L3 | No auto-commit on successful `execute_step` | PRD §4.4/§4.5; `execute_step.ts` end |
| L4 | Success ignores `executionCommand` exit code | `execute_step.ts:108-110` |
| L5 | Recovery failures ignored | `execute_step.ts:123-128` |
| L6 | `maxRetries` off-by-one | `execute_step.ts:82` |
| L7 | HITL incomplete: no dashboard approve; clarification stub | `ask_user.ts:116-120`; dashboard HTML |
| L8 | Dispatcher Tier 2 still Phase-1 bare deny | `dispatcher.ts:64-71` |
| L9 | Global step ID PK collision across workflows | `db/migrations/0001-init.sql` |
| L10 | Checkpoint: dirs/renames/atomicity/ungated hard reset | `checkpoint.ts`, `restore_checkpoint.ts` |
| L11 | `run_script.writeFile` bypasses `apply_patch` write contract | `run_script.ts:51-61` |
| L12 | `command_log` table never written | PRD §7; dashboard reads empty |

### 1.3 Testing / honesty

| ID | Finding | Primary refs |
|---|---|---|
| T1 | Suite currently **fails** (58/60) while benchmarks claim 100% | `process.test.ts`, `discovery.test.ts`; `docs/benchmarks/v1-results.md` |
| T2 | Benchmarks remap unit tests to “10 E2E tasks” | `v1-results.md` vs `v1-tasks.md` |
| T3 | Failure contracts largely untested | AGENTS.md §1.3; many `docs/tools/*.md` |
| T4 | No adversarial CI job / null-byte / vm-escape suite | PRD §8/§10; AGENTS.md §2.5 |
| T5 | No vitest isolation/coverage config | missing `vitest.config.ts` |
| T6 | Shared mutable globals → parallel flakiness | `config.ts`, `db.ts` |

### 1.4 Docs / hygiene

| ID | Finding | Primary refs |
|---|---|---|
| D-A | package/server `1.0.0` vs CHANGELOG `2.0.0` | `package.json`, `index.ts`, `CHANGELOG.md` |
| D-B | README `npm run dev` missing | `README.md:54` |
| D-C | PRD still Draft; Tier A ≤11 vs code 12 | `PRD.md`, `index.test.ts` |
| D-D | Tool docs tier/schema/failure drift (all 27 files) | `docs/tools/*` |
| D-E | CHANGELOG claims vs `permission-rules.json` (git checkout Tier) | CHANGELOG vs rules |
| D-F | PRD dangling §7.3 / §11 refs; AGENTS cites PRD §11 | `PRD.md`, `AGENTS.md:165` |
| D-G | “CoW” marketing overclaim | README, CHANGELOG, tool docs |
| D-H | No pre-commit secret scan | AGENTS.md §1.4 |
| D-I | Magic status strings; incomplete `WorkflowStatus` enum | `constants.ts:10-15` |
| D-J | Context Manager module missing | PRD §4.3 |

---

## 2. Phase map (overview)

| Phase | Name | Goal | Est. commits (Tasks) |
|---|---|---|---:|
| **R0** | Decisions, truth, and stop-the-bleeding | ADRs + version policy + fix red tests | ~12 |
| **R1** | Constants, scripts, and quality scaffolding | Magic-string enums, package scripts, vitest baseline | ~10 |
| **R2** | Security hardening (gate, paths, sandbox, git) | Close S1–S16 complete bypasses | ~28 |
| **R3** | Core loop fidelity (`execute_step` / workflow / git) | Close L1–L6, L9 | ~16 |
| **R4** | HITL + dashboard end-to-end | Close L7–L8, S11–S12 | ~14 |
| **R5** | Capability contract completion | Context manager, command_log, invoke/list, checkpoint, run_script writes | ~18 |
| **R6** | Documentation & product honesty | PRD, tools docs, README, CHANGELOG, benchmarks | ~35 |
| **R7** | Testing, adversarial suite, CI, release bar | Close T1–T6, D-H; hit 90+ DoD | ~22 |

**Total:** ~155 atomic commits across ~8 PRs (one per phase), plus ADR PRs as required.

Suggested branch naming (AGENTS / cloud convention):  
`cursor/r0-decisions-1fef`, `cursor/r2-security-1fef`, … or one long-lived `cursor/remediation-to-90-1fef` with phase PRs stacked — prefer **one branch per Phase** for reviewability (AGENTS.md §1.4).

---

## Phase R0 — Decisions, truth, and stop-the-bleeding

**Exit gate:** ADRs merged (or opened and accepted in-repo), currently failing tests green, version policy written, this plan linked from `IMPLEMENTATION_PLAN.md`.

### Step R0.1 — Plan & index wiring

#### Task R0.1.1 — Add this remediation plan
- **Commit:** `docs: add REMEDIATION_TO_90 comprehensive plan`
- **Files:** `docs/plans/REMEDIATION_TO_90.md` (this file)
- **Acceptance:** File exists; linked from IMPLEMENTATION_PLAN in next Task.

#### Task R0.1.2 — Point IMPLEMENTATION_PLAN at remediation track
- **Commit:** `docs: supersede v2 plan with remediation track pointer`
- **Files:** `IMPLEMENTATION_PLAN.md`
- **Change:** Add banner at top: Phases 0–3 historically delivered with known gaps; active work is `docs/plans/REMEDIATION_TO_90.md`. Keep historical phase text for archaeology.
- **Acceptance:** First 30 lines clearly state active plan path.

#### Task R0.1.3 — Fix AGENTS.md broken PRD §11 reference
- **Commit:** `docs(agents): replace nonexistent PRD §11 cite with Cross-Phase Practices`
- **Files:** `AGENTS.md:165`
- **Change:** Cite `IMPLEMENTATION_PLAN.md` Cross-Phase Practices / this plan §0.2 instead of `PRD §11`.
- **Acceptance:** No dangling §11 references in AGENTS.md.

---

### Step R0.2 — Architecture Decision Records (mandatory before behavior changes)

#### Task R0.2.1 — ADR 0004: Tier A budget and `open_project`
- **Commit:** `docs(adr): 0004 tier-a budget includes open_project`
- **Files:** `docs/adr/0004-tier-a-open-project.md`
- **Decision:** Raise Tier A budget to **12**; `open_project` remains Tier A; retarget requires confirmation + allowlist (implemented in R2).
- **Acceptance:** ADR Status Accepted; PRD update deferred to R6 but ADR is SoT for code work in R2.

#### Task R0.2.1 notes for ADR body
Must cover: PRD §5.1/§8 contradiction; `index.test.ts` already asserts 12; session-anchor justification per AGENTS §2.1.

#### Task R0.2.2 — ADR 0005: `execute_step` contract vs PRD §4.5
- **Commit:** `docs(adr): 0005 execute_step caller-supplied commands and engine duties`
- **Files:** `docs/adr/0005-execute-step-contract.md`
- **Decision:** Keep caller-supplied `executionCommand` / `validationCommand` / `recoveryCommand` (extends ADR 0003). Engine **must** enforce: DAG readiness, branch isolation, exec+validation success, recovery failure handling, auto-commit on success, structured summary return.
- **Acceptance:** Explicit list of engine duties vs client duties.

#### Task R0.2.3 — ADR 0006: Memory API shape
- **Commit:** `docs(adr): 0006 remember-recall content-tags API`
- **Files:** `docs/adr/0006-memory-api.md`
- **Decision:** Canonical API is code’s `{ content, tags? }` / `{ query, limit? }`. PRD §4.6 will be updated in R6. FTS5 `key`/`value`/`category` columns map as: key=id, value=content, category=tags JSON.
- **Acceptance:** Mapping table in ADR.

#### Task R0.2.4 — ADR 0007: Permission rules load trust boundary
- **Commit:** `docs(adr): 0007 permission-rules load only from server install path`
- **Files:** `docs/adr/0007-permission-rules-trust.md`
- **Decision:** Never load `permission-rules.json` from `config.workspaceRoot`. Load only from package root / install path. Workspace cannot poison the gate (fixes S15).
- **Acceptance:** Decision stated; implementation in R2.

#### Task R0.2.5 — ADR 0008: Sandbox residual risk honesty
- **Commit:** `docs(adr): 0008 vm sandbox residual risk and mitigations`
- **Files:** `docs/adr/0008-vm-sandbox-mitigations.md`
- **Decision:** Do not supersede ADR 0001. Add required mitigations: `timeout`, `Object.freeze` sandbox, remove host `console` (or wrap), document that `vm` is **not** a security boundary; escape tests must fail closed (detect escape → error). Optional future: `isolated-vm` as opt-in.
- **Acceptance:** Mitigations checklist for R2 Tasks.

#### Task R0.2.6 — ADR 0009: HITL approval authority
- **Commit:** `docs(adr): 0009 hitl approval requires dashboard or local secret`
- **Files:** `docs/adr/0009-hitl-approval-authority.md`
- **Decision:** MCP/`ask_user` may **create** pending confirmations and **poll**, but must **not** accept `response: approved|rejected` over the agent tool channel unless accompanied by a server-side approval secret (env `CCATHOME_APPROVAL_TOKEN`) **or** the approval arrives via dashboard HTTP API authenticated with the dashboard token. Prevents S1.
- **Acceptance:** Threat model paragraph + API sketch.

---

### Step R0.3 — Stop the bleeding (make CI/tests truthful)

#### Task R0.3.1 — Fix `discovery.test.ts` Windows path assumption
- **Commit:** `test(discovery): use platform-absolute path for detect_workspace retarget`
- **Files:** `src/tools/system/discovery.test.ts`
- **Change:** Replace hardcoded `C:\Users\...` with `fs.mkdtempSync` absolute path under OS temp (or `path.resolve('/')` child that exists). Assert `config.workspaceRoot` equals `path.resolve(thatPath)`.
- **Acceptance:** Test passes on Linux CI.

#### Task R0.3.2 — Fix `process.test.ts` stderr log race
- **Commit:** `fix(process): flush/close log stream before expand_log assertions`
- **Files:** `src/tools/process/run_command.ts` (ensure log stream ends on exit), optionally test wait
- **Change:** On child `close`/`exit`, end the write stream and await `finish` before resolving the handler promise so `expand_log` sees stdout+stderr.
- **Acceptance:** `process.test.ts` passes; no flake in 10 local reruns (`ALLOW` note: document in commit body).

#### Task R0.3.3 — Record baseline test count honestly
- **Commit:** `docs(benchmarks): mark v1-results as provisional pending remediation`
- **Files:** `docs/benchmarks/v1-results.md`
- **Change:** Banner: results conflated unit tests with E2E; suite had failures as of 2026-07-11; full rewrite in Phase R6/R7.
- **Acceptance:** No reader can mistake current file for audited E2E proof.

---

### Step R0.4 — Version policy note (no bump yet)

#### Task R0.4.1 — Document version skew in CHANGELOG Unreleased
- **Commit:** `docs(changelog): note 1.0.0 package vs 2.0.0 changelog skew under Unreleased`
- **Files:** `CHANGELOG.md`
- **Change:** Add `## [Unreleased]` section listing remediation track and stating package remains `1.0.0` until R7 release bump.
- **Acceptance:** Skew acknowledged, not silently left.

**Phase R0 exit checklist**
- [ ] ADRs 0004–0009 present
- [ ] `npm test` green
- [ ] Plan linked from IMPLEMENTATION_PLAN
- [ ] Benchmark honesty banner present

---

## Phase R1 — Constants, scripts, and quality scaffolding

**Exit gate:** Magic statuses centralized; package scripts usable; vitest config exists; format check in CI optional-prep.

### Step R1.1 — Enum completeness (AGENTS.md §1.3)

#### Task R1.1.1 — Extend `WorkflowStatus` / add `StepStatus`
- **Commit:** `refactor(constants): add requires_confirmation and StepStatus enum`
- **Files:** `src/core/constants.ts`
- **Change:** Add `REQUIRES_CONFIRMATION = "requires_confirmation"` to workflow statuses; add `StepStatus` enum mirroring DB CHECK values including `requires_confirmation`.
- **Acceptance:** Enums exported; no behavior change yet.

#### Task R1.1.2 — Replace magic strings in `execute_step.ts`
- **Commit:** `refactor(execute_step): use StepStatus and WorkflowStatus enums`
- **Files:** `src/tools/workflow/execute_step.ts`
- **Acceptance:** No raw `"completed"|"failed"|"running"|"requires_confirmation"` literals.

#### Task R1.1.3 — Replace magic strings in `ask_user.ts` / workflow-engine / create_workflow / get_workflow_state
- **Commit:** `refactor(workflow): use status enums across workflow tools`
- **Files:** `ask_user.ts`, `workflow-engine.ts`, `create_workflow.ts`, `get_workflow_state.ts`
- **Acceptance:** Grep for status literals in those files is empty (except imports).

#### Task R1.1.4 — Replace magic strings in dashboard SQL/UI status handling
- **Commit:** `refactor(dashboard): use status enums for comparisons`
- **Files:** `src/core/dashboard-server.ts` (TS side); HTML may keep CSS class strings that match enum values — document mapping.
- **Acceptance:** TS comparisons use enums.

#### Task R1.1.5 — Add lint script note / simple grep CI check for magic statuses
- **Commit:** `ci: add scripts/lint-no-magic-status.js`
- **Files:** `scripts/lint-no-magic-status.js`, `package.json` `lint` script
- **Change:** Fail if `\b(pending|running|completed|failed|requires_confirmation)\b` string literals appear in `src/tools/**` and `src/core/**` outside `constants.ts` and tests (allowlist tests + HTML template carefully).
- **Acceptance:** `npm run lint` enforces; document allowlist in script header.

---

### Step R1.2 — Package scripts & README prerequisites

#### Task R1.2.1 — Add `start` and `dev` scripts
- **Commit:** `chore(package): add start and dev scripts for MCP server`
- **Files:** `package.json`
- **Change:**
  - `"start": "node dist/index.js"`
  - `"dev": "npm run build && node dist/index.js"`
  - Optionally `"coverage": "vitest run --coverage"` (coverage provider added in R7 — if added early, add dependency in same commit with justification).
- **Acceptance:** `npm run build && npm start --help` or process starts (stdio); README can be updated in R6 — for now scripts exist.

#### Task R1.2.2 — Add `format:check` script
- **Commit:** `chore(package): add format:check script`
- **Files:** `package.json`
- **Change:** `"format:check": "prettier --check \"src/**/*.ts\""`
- **Acceptance:** Script runs.

#### Task R1.2.3 — Add baseline `vitest.config.ts` (threads/isolation)
- **Commit:** `chore(test): add vitest.config.ts with file isolation defaults`
- **Files:** `vitest.config.ts`
- **Change:** `poolOptions` / `fileParallelism: false` initially to kill cross-file `config` races (can re-enable after R7 isolation refactor). `include: ['src/**/*.test.ts']`.
- **Acceptance:** `npm test` green with config present.

---

### Step R1.3 — Tier A budget test aligns with ADR 0004

#### Task R1.3.1 — Document expected Tier A count constant
- **Commit:** `refactor(dispatcher): export TIER_A_BUDGET constant`
- **Files:** `src/core/dispatcher.ts`, `src/index.test.ts`
- **Change:** `export const TIER_A_BUDGET = 12;` assert `TIER_A_TOOLS.size === TIER_A_BUDGET` and `<= TIER_A_BUDGET`.
- **Acceptance:** Single source of truth for budget.

**Phase R1 exit checklist**
- [ ] Status enums used in core workflow paths
- [ ] Magic-status lint in `npm run lint`
- [ ] `dev`/`start`/`format:check` exist
- [ ] Vitest config present; tests green

---

## Phase R2 — Security hardening

**Exit gate:** Adversarial unit tests for S1–S16 either pass or are explicitly deferred with ADR risk acceptance. No complete bypass remains for the LLM-without-user-noticing threat model.

> PRs touching `permission-gate.ts` need second reviewer (AGENTS §2.6).

### Step R2.1 — Permission rules trust & classification fixes

#### Task R2.1.1 — Load rules only from install path (ADR 0007)
- **Commit:** `security(gate): stop loading permission-rules from workspaceRoot`
- **Files:** `src/core/permission-gate.ts`
- **Change:** Remove `config.workspaceRoot` from `pathsToTry`. Prefer `process.cwd()` only if it is the server package, else `import.meta.url` relative `../../permission-rules.json`.
- **Tests:** Unit test that a malicious workspace file is ignored.
- **Acceptance:** S15 closed.

#### Task R2.1.2 — Retire `^node\b` from Tier 1
- **Commit:** `security(rules): remove node from tier-1 auto-allow`
- **Files:** `permission-rules.json`, `src/core/permission-gate.test.ts`
- **Change:** Delete `^node\\b`. Bare `node` falls to default Tier 2. Optionally allow narrow `^node --test\\b` later if needed.
- **Acceptance:** `node -e "..."` classifies as Tier 2; update any tests that used `node -e` as “safe” to approve via test helper or use `printf`/`true` instead.

#### Task R2.1.3 — Move npm install family to Tier 2
- **Commit:** `security(rules): require confirmation for npm install/ci`
- **Files:** `permission-rules.json`, tests, CHANGELOG Unreleased note
- **Change:** Remove `^npm i\\b`, `^npm install\\b`, `^npm ci\\b` from Tier 0; they become default Tier 2 (or explicit Tier 2 patterns).
- **Acceptance:** S8 closed; chaining test that assumed npm Tier 0 updated.

#### Task R2.1.4 — Align git checkout/reset with CHANGELOG (Tier 2 for destructive forms)
- **Commit:** `security(rules): keep safe git checkout tier-1; hard forms tier-2`
- **Files:** `permission-rules.json`
- **Change:** Ensure `^git checkout\\b` does not auto-allow `checkout --` / `checkout .` — prefer removing broad `^git checkout\\b` from Tier 1; allow only `^git checkout\\s+[^-].*` carefully OR classify all checkout as Tier 2 except `--show-current` style reads. Document choice in commit body.
- **Acceptance:** `git reset --hard` and `git clean` remain Tier 2; CHANGELOG and rules agree.

#### Task R2.1.5 — Add chaining-aware classification for Tier 0/1 prefixes
- **Commit:** `security(gate): reject or escalate commands with shell metacharacters when matched only by anchored safe prefixes`
- **Files:** `src/core/permission-gate.ts`, `permission-gate-chaining.test.ts`
- **Change:** After computing tier, if command matches `[;&|\`\n]|\$\(` and the matched rule was Tier 0/1 **anchored** prefix, escalate to at least Tier 2 (or re-scan remainder). Document algorithm in comment.
- **Acceptance:** `git status; curl https://evil` → Tier ≥2; existing Tier 3 `rm` cases still Tier 3.

#### Task R2.1.6 — Expand pipe-to-shell and substitution Tier 3 patterns
- **Commit:** `security(rules): block bin-shell pipes and critical substitutions`
- **Files:** `permission-rules.json`, tests
- **Change:** Add patterns for `\|\\s*/bin/(ba)?sh`, `\|\\s*/usr/bin/(ba)?sh`, clear `curl|wget` + pipe cases; treat `` ` `` and `$(` with dangerous inners conservatively (Tier 2 minimum via R2.1.5 may suffice — prefer Tier 3 for `curl.*\|` and `wget.*\|`).
- **Acceptance:** S16 materially closed; tests listed in commit.

#### Task R2.1.7 — Sensitive path protection for real writers
- **Commit:** `security(path): block writes to .env .git/hooks permission-rules sqlite via shared helper`
- **Files:** new `src/core/sensitive-paths.ts`, `apply_patch.ts`, `move_file.ts`, `run_script.ts` writeFile
- **Change:** Central `assertNotSensitiveWorkspacePath(absPath)` used by all writers. Keep classifier patterns for `write_file` synthetic commands too.
- **Acceptance:** S7 closed with tests using `apply_patch` to `.env`.

---

### Step R2.2 — Path containment hardening

#### Task R2.2.1 — Fix `..hidden` false positive in path-utils
- **Commit:** `fix(path): correct .. segment detection without blocking ..hidden`
- **Files:** `src/core/path-utils.ts`, `path-utils.test.ts`
- **Acceptance:** `..hidden` allowed if under root; `../x` blocked.

#### Task R2.2.2 — Harden `expand_log` logId
- **Commit:** `security(expand_log): allow only hex logId and resolveSafePath`
- **Files:** `src/tools/process/expand_log.ts`, tests
- **Change:** `/^[a-f0-9]+$/i` check; build path then `resolveSafePath(workspace, rel)`.
- **Acceptance:** S13 closed; `logId: '../...'` → error.

#### Task R2.2.3 — Constrain `open_project` / `detect_workspace` retarget (ADR 0004)
- **Commit:** `security(workspace): require existing dir + optional allowlist env for retarget`
- **Files:** `open_project.ts`, `detect_workspace.ts`, `docs/tools/open_project.md` (minimal note OK; full doc sync R6)
- **Change:**
  - Resolve realpath.
  - If `CCATHOME_WORKSPACE_ALLOWLIST` set (colon-separated prefixes), require target under one prefix.
  - If not set, default: allow only subdirectories of the **initial** workspace root captured at process start (`config.initialWorkspaceRoot` — add field in same or prior tiny commit).
- **Split if needed:** Task R2.2.3a add `initialWorkspaceRoot`; R2.2.3b enforce allowlist.

#### Task R2.2.3a — Capture initial workspace root
- **Commit:** `feat(config): capture initialWorkspaceRoot at startup`
- **Files:** `src/core/config.ts`, `src/index.ts`

#### Task R2.2.3b — Enforce retarget policy + Tier 2 gate for leaving initial tree
- **Commit:** `security(open_project): gate cross-tree workspace switches`
- **Files:** `open_project.ts`, `detect_workspace.ts`, permission synthetic command `open_project <path>` classified Tier 2 when outside initial tree
- **Acceptance:** S3 closed for default config.

#### Task R2.2.4 — Symlink TOCTOU note + re-realpath before write in apply_patch
- **Commit:** `security(apply_patch): re-resolve realpath immediately before rename`
- **Files:** `apply_patch.ts`, tests
- **Acceptance:** Document residual TOCTOU; best-effort check present.

---

### Step R2.3 — Process / sandbox / env

#### Task R2.3.1 — Add vm timeout (ADR 0008)
- **Commit:** `security(run_script): pass timeout to runInContext`
- **Files:** `run_script.ts`, `run_script.test.ts`
- **Change:** Default e.g. 5000ms; input optional `timeoutMs` capped.
- **Acceptance:** Infinite loop script fails with `script_execution_failed`.

#### Task R2.3.2 — Remove host console; freeze sandbox
- **Commit:** `security(run_script): freeze sandbox and use capped console buffer`
- **Files:** `run_script.ts`
- **Change:** In-sandbox `console` pushes to `log: string[]` returned to caller (also satisfies PRD `{ result, log }`). `Object.freeze(sandbox)`.
- **Acceptance:** Return includes `log`; host console not directly exposed.

#### Task R2.3.3 — Detect common vm escape patterns fail-closed
- **Commit:** `security(run_script): detect prototype escape attempts in tests and document residual risk`
- **Files:** `run_script.test.ts`, optionally lightweight pre-scan
- **Change:** Test that known escape payload does not yield working `process.exit` / `child_process` (if escape still possible, assert that gated paths remain required for *declared* API — and file residual in ADR 0008). Prefer asserting escape throws or result cannot `require('fs')`.
- **Acceptance:** Dedicated test file section `describe('sandbox adversarial')`.

#### Task R2.3.4 — Route `run_script` writes through shared safe write helper
- **Commit:** `fix(run_script): use atomic write helper with sensitive-path checks`
- **Files:** `run_script.ts`, new `src/core/safe-write.ts` (temp+rename + mkdir)
- **Acceptance:** L11 partially addressed; full backup optional follow-up Task R5.x.

#### Task R2.3.5 — Env scrubbing for spawns
- **Commit:** `security(process): pass scrubbed env to child processes`
- **Files:** `process-runner.ts`, `run_command.ts`
- **Change:** Allowlist or strip obvious secrets (`*_TOKEN`, `*_SECRET`, `AWS_*`) unless `CCATHOME_PASS_ENV=1`.
- **Acceptance:** S14 mitigated; test asserts stripped var absent in `node -e "console.log(process.env.FOO)"` style with FOO set in parent — wait, node is Tier 2 now; use a tiny shell `printenv` after approval helper in tests.

#### Task R2.3.6 — ReDoS guard for readinessPattern
- **Commit:** `fix(run_command): cap readinessPattern length and use safe timeout`
- **Files:** `run_command.ts`
- **Acceptance:** Overlong pattern rejected.

---

### Step R2.4 — Git argv safety

#### Task R2.4.1 — Add `runGit` helper using spawn without shell
- **Commit:** `feat(git-utils): add runGit argv spawn without shell`
- **Files:** `src/core/git-utils.ts`, `process-runner.ts` as needed
- **Change:** `runGit(['branch', name], { gated: true })` using `spawn('git', args, { shell: false })` still going through classifyAndGate on a display command string **and** argv validation (`^[a-zA-Z0-9._/-]+$` for refs).
- **Acceptance:** Helper tested.

#### Task R2.4.2 — Migrate `git_branch` to runGit
- **Commit:** `fix(git_branch): use argv runGit to prevent injection`
- **Files:** `git_branch.ts`, `git.test.ts`

#### Task R2.4.3 — Migrate `git_checkout` to runGit
- **Commit:** `fix(git_checkout): use argv runGit to prevent injection`
- **Files:** `git_checkout.ts`, tests

#### Task R2.4.4 — Migrate `git_commit` to runGit
- **Commit:** `fix(git_commit): use argv runGit and safe -m args`
- **Files:** `git_commit.ts`, tests
- **Acceptance:** S9 closed for public git tools.

#### Task R2.4.5 — Migrate `ensureBranchIsolation` internals to runGit
- **Commit:** `fix(git-utils): ensureBranchIsolation uses runGit`
- **Files:** `git-utils.ts`

---

### Step R2.5 — Gate-bypass lint strengthening (AGENTS.md §1.3)

#### Task R2.5.1 — Detect `node:fs` / `node:child_process` imports
- **Commit:** `ci(lint-gate): detect node: protocol dangerous imports`
- **Files:** `scripts/lint-gate-bypass.js`

#### Task R2.5.2 — Require classifyAndGate or safe helpers in whitelisted files
- **Commit:** `ci(lint-gate): assert whitelisted tool files reference gate or safe wrappers`
- **Files:** `scripts/lint-gate-bypass.js`
- **Change:** Whitelist entries must contain `classifyAndGate` or `runCommandGated` or `resolveSafePath`/`safeWrite` as appropriate — documented matrix in script.

#### Task R2.5.3 — Ban new `runCommandUngated` call sites outside allowlist
- **Commit:** `ci(lint-gate): allowlist runCommandUngated call sites`
- **Files:** `scripts/lint-gate-bypass.js`
- **Change:** Only `restore_checkpoint.ts` / `checkpoint.ts` temporarily allowed; Phase R5 should remove or justify via ADR.

**Phase R2 exit checklist**
- [ ] New tests: chaining prefix, npm install tier, node tier, expand_log traversal, open_project allowlist, apply_patch sensitive, git injection, rules trust
- [ ] `permission-gate.ts` PR reviewed (second reviewer)
- [ ] ADR 0007/0008/0009 mitigations implemented or explicitly residual-documented

---

## Phase R3 — Core loop fidelity

**Exit gate:** Integration test: create DAG → cannot run blocked step → isolation branch created → success auto-commits → failure respects exec+validation → recovery failure stops loop.

### Step R3.1 — DAG enforcement

#### Task R3.1.1 — Enforce runnable check in `execute_step`
- **Commit:** `fix(execute_step): refuse steps that are not DAG-runnable`
- **Files:** `execute_step.ts`, `execute_step.test.ts`, `integration.test.ts`
- **Change:** Before running, require `getRunnableSteps(workflowId).includes(stepId)` **or** step status is `requires_confirmation`/`failed` retry eligible with deps still completed. Return `error: "dependencies_unmet"`.
- **Acceptance:** L1 closed; remove integration test cheat that marks deps complete manually where possible — or keep setup but add negative test.

#### Task R3.1.2 — Reject duplicate step IDs within create_workflow
- **Commit:** `fix(workflow-engine): reject duplicate step ids on create`
- **Files:** `workflow-engine.ts`, `workflow.test.ts`
- **Acceptance:** Clear error; no silent Map collapse.

#### Task R3.1.3 — Migration 0003: composite uniqueness for steps
- **Commit:** `feat(db): migration 0003 workflow_steps unique (workflow_id, id)`
- **Files:** `db/migrations/0003-workflow-step-composite.sql`, `db.ts` if needed
- **Change:** SQLite limitations may require table rebuild. Prefer new unique index if `id` remains globally unique **OR** change PK to composite — choose composite uniqueness while keeping `id` text; add `UNIQUE(workflow_id, id)` and stop using bare `id` PK if needed.
- **Acceptance:** L9 addressed; document migration in CHANGELOG Unreleased.

> If migration is large, split: R3.1.3a migration file, R3.1.3b code query updates.

---

### Step R3.2 — Branch isolation + auto-commit

#### Task R3.2.1 — Call `ensureBranchIsolation` at `execute_step` start
- **Commit:** `feat(execute_step): ensure ccathome branch isolation before work`
- **Files:** `execute_step.ts`, tests
- **Acceptance:** L2 closed; integration asserts branch prefix.

#### Task R3.2.2 — Auto-commit on success with `[ccathome-auto]` marker
- **Commit:** `feat(execute_step): auto-commit successful steps on isolated branch`
- **Files:** `execute_step.ts`, `git_commit.ts` amend-guard compatibility, tests
- **Change:** `git add -A` gated + commit message including step id. Use `runGit`.
- **Acceptance:** L3 closed; Task 6 benchmark criteria become testable.

#### Task R3.2.3 — Do not auto-commit on failure / confirmation pause
- **Commit:** `test(execute_step): assert no auto-commit when step fails or pauses`
- **Files:** `execute_step.test.ts`
- **Acceptance:** Negative tests land (may be same PR as R3.2.2 if tiny — prefer separate commit).

---

### Step R3.3 — Success / retry semantics

#### Task R3.3.1 — Require executionCommand exit 0 before validation success
- **Commit:** `fix(execute_step): treat nonzero execution exit as failure`
- **Files:** `execute_step.ts`, `ask_user.test.ts` (update scenario that expected push-fail+validation-pass success)
- **Acceptance:** L4 closed.

#### Task R3.3.2 — Fail loop when recoveryCommand exits nonzero
- **Commit:** `fix(execute_step): abort retries when recoveryCommand fails`
- **Files:** `execute_step.ts`, tests
- **Acceptance:** L5 closed.

#### Task R3.3.3 — Fix maxRetries semantics
- **Commit:** `fix(execute_step): interpret maxRetries as max recovery attempts`
- **Files:** `execute_step.ts`, `execute_step.test.ts`, `docs/tools/execute_step.md` (brief)
- **Change:** Define clearly: `maxRetries: 0` → single attempt; `maxRetries: 2` → 1 initial + 2 recoveries = 3 executions max. Align loop and tests; update ADR 0005 if needed in docs commit.
- **Acceptance:** L6 closed; test expectations match docs.

#### Task R3.3.4 — Return structured summary + logId (ADR 0005)
- **Commit:** `feat(execute_step): return summary and logId in result`
- **Files:** `execute_step.ts`, context-manager stub OK if R5 not ready — inline truncate temporarily
- **Acceptance:** Shape includes `{ success, status, stepId, summary, retryCount, logId? }`.

#### Task R3.3.5 — Persist attempt logs via context-manager-friendly summary field
- **Commit:** `feat(execute_step): store summary separately from full_log when column exists`
- **Files:** possibly migration `0004-step-summary.sql`, `execute_step.ts`
- **Acceptance:** `full_log` remains complete; summary capped for model-facing returns.

**Phase R3 exit checklist**
- [ ] Integration test covers DAG deny, isolation, auto-commit, exec failure, recovery failure
- [ ] No test cheats that hide unmet deps without asserting the new error

---

## Phase R4 — HITL + dashboard end-to-end

**Exit gate:** Tier 2 command in `execute_step` pauses; dashboard URL with token printed; human (or test HTTP client with token) approves; step resumes; agent cannot self-approve without secret.

### Step R4.1 — Approval authority (ADR 0009)

#### Task R4.1.1 — Remove naked `response` approval from agent channel
- **Commit:** `security(ask_user): require approvalToken for response mutations`
- **Files:** `ask_user.ts`, `ask_user.test.ts`
- **Change:** If `args.response` set, require `args.approvalToken === process.env.CCATHOME_APPROVAL_TOKEN` (constant-time compare). Dashboard uses separate API (next steps).
- **Acceptance:** S1 closed for MCP path; tests updated.

#### Task R4.1.2 — Single-use approvals (consume on allow)
- **Commit:** `security(gate): consume approved confirmations after use`
- **Files:** `permission-gate.ts`, tests
- **Change:** On allowed-via-approval, mark status `consumed` or delete row.
- **Acceptance:** S2 closed; second identical command requires new approval.

#### Task R4.1.3 — Match pending rows by step_id consistently
- **Commit:** `fix(ask_user): scope pending confirmation lookup by step_id`
- **Files:** `ask_user.ts`, `permission-gate.ts`
- **Acceptance:** Cross-step approve impossible.

---

### Step R4.2 — Dashboard token UX

#### Task R4.2.1 — Return token from `startDashboardServer` and print URL
- **Commit:** `feat(dashboard): print authenticated dashboard URL on startup`
- **Files:** `dashboard-server.ts`, `index.ts`
- **Change:** `console.error(`Dashboard: http://localhost:3141/?token=${token}`)`.
- **Acceptance:** S11 closed.

#### Task R4.2.2 — Add GET health that still requires auth (no change) + test token flow
- **Commit:** `test(dashboard): cover token query param sets cookie`
- **Files:** `dashboard-server.test.ts`
- **Acceptance:** Existing auth test expanded.

---

### Step R4.3 — Dashboard HITL API + UI

#### Task R4.3.1 — POST `/api/confirmations/:id/approve` and `/reject`
- **Commit:** `feat(dashboard): add authenticated approve/reject API`
- **Files:** `dashboard-server.ts`, migration not needed
- **Change:** Update `pending_confirmations`; optionally set step status.
- **Acceptance:** HTTP test with token.

#### Task R4.3.2 — SSE payload includes pending confirmations
- **Commit:** `feat(dashboard): stream pending_confirmations in SSE payload`
- **Files:** `dashboard-server.ts`

#### Task R4.3.3 — UI panel with Approve/Reject buttons
- **Commit:** `feat(dashboard): render HITL approval panel`
- **Files:** `dashboard-server.ts` HTML/JS
- **Change:** `fetch` POST with credentials; no `innerHTML` for user data.
- **Acceptance:** L7 dashboard claim becomes true; update `ask_user` stderr message if needed (tiny follow-up).

#### Task R4.3.4 — Fix XSS: escape all dynamic HTML
- **Commit:** `security(dashboard): escape dynamic values; prefer textContent`
- **Files:** `dashboard-server.ts`
- **Change:** Add `escapeHtml`; replace `innerHTML` concatenations.
- **Acceptance:** S12 closed; test with title `<img onerror=...>`.

#### Task R4.3.5 — Clarification HITL: persist and resolve via dashboard
- **Commit:** `feat(ask_user): clarification waits for dashboard/secret response`
- **Files:** `ask_user.ts`, dashboard UI section, maybe new table or reuse pending with type column
- **Change:** Migration `0005-confirmation-type.sql` if needed — **separate commit** if schema changes.
- **Acceptance:** Clarification no longer returns instant `"No response received"`.

#### Task R4.3.5a — Migration for confirmation type (if required)
- **Commit:** `feat(db): migration 0005 pending confirmation type and question`
- **Files:** `db/migrations/0005-...sql`

---

### Step R4.4 — Wire gate to HITL (finish plan 3.2)

#### Task R4.4.1 — `run_command` / `runCommandGated` throw `RequiresConfirmationError` consistently
- **Commit:** `fix(process-runner): surface RequiresConfirmationError to callers`
- **Files:** `process-runner.ts`, `run_command.ts`
- **Acceptance:** execute_step already catches; run_command returns `requires_confirmation` error code matching docs.

#### Task R4.4.2 — Dispatcher Tier 2: create pending + structured error (not Phase-1 comment)
- **Commit:** `fix(dispatcher): replace phase-1 tier2 deny with structured requires_confirmation`
- **Files:** `dispatcher.ts`
- **Change:** Insert pending confirmation; return `{ error: "requires_confirmation", tier: 2 }` without claiming ask_user auto-raise if MCP client must call ask_user — **or** auto-invoke ask_user poll (dangerous for stdio). Prefer structured error + dashboard notification; document in ADR 0009 addendum commit if behavior differs from PRD “automatically raises”.
- **Acceptance:** Stale Phase-1 comment gone; L8 closed.

#### Task R4.4.3 — Integration test: Tier 2 pause → HTTP approve → resume execute_step
- **Commit:** `test(hitl): end-to-end confirmation via dashboard API`
- **Files:** new `src/tools/system/hitl.integration.test.ts`
- **Acceptance:** Phase 3.2 acceptance criterion finally true.

**Phase R4 exit checklist**
- [ ] Token printed
- [ ] Approve/reject works
- [ ] XSS escaped
- [ ] Agent self-approve blocked
- [ ] E2E HITL test green

---

## Phase R5 — Capability contract completion

**Exit gate:** Context manager exists and is used; `command_log` written; invoke/list match contracts; checkpoint edge fixes; tool behaviors match upcoming docs.

### Step R5.1 — Context Manager (PRD §4.3)

#### Task R5.1.1 — Add `src/core/context-manager.ts`
- **Commit:** `feat(context-manager): add truncate and outline helpers`
- **Files:** `src/core/context-manager.ts`, unit tests
- **Change:** `truncateLines(text, max)`, `outlineSource(content)`, `summarizeCommandOutput(...)`.
- **Acceptance:** Pure functions tested.

#### Task R5.1.2 — Use context-manager in `read_file`
- **Commit:** `refactor(read_file): delegate outlining to context-manager`
- **Files:** `read_file.ts`

#### Task R5.1.3 — Use context-manager in `run_command`
- **Commit:** `refactor(run_command): delegate output capping to context-manager`
- **Files:** `run_command.ts`

#### Task R5.1.4 — Use context-manager in `execute_step` summary
- **Commit:** `refactor(execute_step): build summary via context-manager`
- **Files:** `execute_step.ts`

#### Task R5.1.5 — Use context-manager in `get_workflow_state` default summaries
- **Commit:** `fix(get_workflow_state): do not dump fullLog unless explicitly requested`
- **Files:** `get_workflow_state.ts`, docs later
- **Change:** Add `includeFullLog?: boolean` default false.

---

### Step R5.2 — `command_log` + process registry fidelity

#### Task R5.2.1 — Insert/update `command_log` rows from `run_command`
- **Commit:** `feat(run_command): persist command_log rows for dashboard`
- **Files:** `run_command.ts`, `db` helpers
- **Acceptance:** L12 closed; dashboard process list non-empty in test.

#### Task R5.2.2 — Update status on kill/exit
- **Commit:** `feat(process): update command_log status on kill and exit`
- **Files:** `kill_process.ts`, `process-registry.ts`

#### Task R5.2.3 — Always return `logId` on ready/timeout paths
- **Commit:** `fix(run_command): include logId on ready and timeout responses`
- **Files:** `run_command.ts`, tests

---

### Step R5.3 — Dispatcher / discovery contracts

#### Task R5.3.1 — Cap `list_capabilities` at 5; improve ranking
- **Commit:** `fix(dispatcher): limit list_capabilities to 5 matches`
- **Files:** `dispatcher.ts`, `discovery.test.ts`
- **Change:** `.slice(0, 5)`; prefer name-prefix matches. FTS table optional — if skipping FTS, document PRD amendment in R6.
- **Acceptance:** PRD §5.3 max-5 met.

#### Task R5.3.2 — Structured `unknown_capability` error with suggestion field
- **Commit:** `fix(invoke): return structured unknown_capability error object fields`
- **Files:** `dispatcher.ts`, `invoke.ts`, tests
- **Change:** `error: "unknown_capability"`, `suggestion?: string` on InvokeResult.

#### Task R5.3.3 — Optional: forbid `invoke` of Tier A names
- **Commit:** `fix(invoke): reject Tier A names with forbidden_invocation`
- **Files:** `dispatcher.ts`, tests, ADR note if this is breaking for clients who nested invoke
- **Decision check:** If existing clients rely on nested invoke, skip and document. Default recommendation: **allow** nested invoke but document; only add forbid if PRD hard rule needed. Prefer **docs fix** over behavior break → mark this Task **OPTIONAL SKIP** with commit `docs: clarify invoke may target Tier A` in R6 instead.

---

### Step R5.4 — Checkpoint / restore integrity

#### Task R5.4.1 — Support untracked directories in checkpoint
- **Commit:** `fix(checkpoint): copy untracked directories recursively`
- **Files:** `checkpoint.ts`, tests

#### Task R5.4.2 — Parse git rename porcelain correctly
- **Commit:** `fix(checkpoint): handle rename status in git status porcelain`
- **Files:** `checkpoint.ts`, tests

#### Task R5.4.3 — Make restore more atomic / fail loudly
- **Commit:** `fix(restore_checkpoint): fail if backup missing; order operations safely`
- **Files:** `restore_checkpoint.ts`, failure-contract tests
- **Acceptance:** T3 gap for restore failures closed.

#### Task R5.4.4 — ADR 0010: ungated git reset in restore
- **Commit:** `docs(adr): 0010 restore_checkpoint uses ungated reset with rationale`
- **Files:** `docs/adr/0010-restore-ungated-git.md`
- **Decision:** Either (a) keep ungated with audit log + Tier 2 already approved for step, or (b) route through gate with auto-approved internal context. Pick one and implement follow-up Task.

#### Task R5.4.5 — Implement ADR 0010 choice
- **Commit:** `fix(restore_checkpoint): <gated-or-justified-ungated> reset/clean`
- **Files:** `restore_checkpoint.ts`, lint allowlist update

---

### Step R5.5 — Patch / apply_patch contract polish

#### Task R5.5.1 — Assert backup + newSha in filesystem tests
- **Commit:** `test(apply_patch): assert backup file and newSha on success`
- **Files:** `filesystem.test.ts`

#### Task R5.5.2 — Add `patch_failed` leaves target untouched test
- **Commit:** `test(apply_patch): malformed patch leaves target unchanged`
- **Files:** `filesystem.test.ts`, fix code if failing

#### Task R5.5.3 — Normalize error code `invalid_path` vs docs (code wins until R6)
- **Commit:** `fix(apply_patch): ensure path errors use invalid_path consistently`
- **Files:** `apply_patch.ts`

#### Task R5.5.4 — Patch parser: don’t treat `\ No newline` as hunk end incorrectly
- **Commit:** `fix(patch): handle no-newline marker correctly`
- **Files:** `src/core/patch.ts`, `patch.test.ts`

---

### Step R5.6 — Memory / recall polish

#### Task R5.6.1 — Escape LIKE wildcards in fallback recall
- **Commit:** `fix(recall): escape LIKE metacharacters in fallback path`
- **Files:** `recall.ts`, `memory.test.ts`

#### Task R5.6.2 — Expand memory ranking qualitative test (plan 2.4)
- **Commit:** `test(memory): add varied corpus ranking assertions`
- **Files:** `memory.test.ts`

---

### Step R5.7 — `run_script` output contract

#### Task R5.7.1 — Return `{ result, log }` from run_script
- **Commit:** `feat(run_script): return capped action log array`
- **Files:** `run_script.ts`, tests, (docs in R6)

**Phase R5 exit checklist**
- [ ] Context-manager imported by read_file, run_command, execute_step
- [ ] command_log populated
- [ ] Checkpoint dir/rename tests pass
- [ ] list_capabilities ≤5

---

## Phase R6 — Documentation & product honesty

**Exit gate:** A stranger can read PRD + README + tool docs and not be misled about behavior. Version strings consistent for release prep.

### Step R6.1 — PRD reconciliation (AGENTS.md §1.1)

#### Task R6.1.1 — PRD status: Accepted for engineering; bump doc version 2.1.0
- **Commit:** `docs(prd): mark v2.1.0 accepted and add changelog section`
- **Files:** `PRD.md` §0 header + §0.1

#### Task R6.1.2 — PRD §5.1 Tier A table → 12 tools including `open_project`
- **Commit:** `docs(prd): raise tier A budget to 12 and document open_project`
- **Files:** `PRD.md` §5.1, §8

#### Task R6.1.3 — PRD §4.5 / §5.1 `execute_step` align with ADR 0003/0005
- **Commit:** `docs(prd): align execute_step with caller-supplied recovery contract`
- **Files:** `PRD.md`

#### Task R6.1.4 — PRD §4.6 memory API align with ADR 0006
- **Commit:** `docs(prd): align remember/recall with content-tags API`
- **Files:** `PRD.md`

#### Task R6.1.5 — PRD §4.3 note context-manager module path
- **Commit:** `docs(prd): reference src/core/context-manager.ts`
- **Files:** `PRD.md`

#### Task R6.1.6 — PRD §4.7 / §9 sandbox risk point to ADR 0001+0008
- **Commit:** `docs(prd): close open vm decision; document residual risk`
- **Files:** `PRD.md`

#### Task R6.1.7 — PRD §7 schema: requires_confirmation + pending_confirmations
- **Commit:** `docs(prd): document confirmation schema and migrations`
- **Files:** `PRD.md` §7

#### Task R6.1.8 — Fix dangling §7.3 / §11 references
- **Commit:** `docs(prd): remove or rewrite dangling section references`
- **Files:** `PRD.md` §4.6 upgrade path, §10 methodology refs

#### Task R6.1.9 — PRD §6.3 dashboard token requirement for local HTTP
- **Commit:** `docs(prd): require startup token print for dashboard HTTP`
- **Files:** `PRD.md`

---

### Step R6.2 — README rewrite (currency check AGENTS §1.1 / §2.5)

#### Task R6.2.1 — Fix Getting Started commands
- **Commit:** `docs(readme): fix install build test start instructions`
- **Files:** `README.md`
- **Change:** Document `npm run build`, `npm start`, workspace argv/`WORKSPACE_ROOT`, dashboard token line, MCP client config sketch (Claude Code mcpServers).

#### Task R6.2.2 — Tone down unverifiable marketing; accurate security section
- **Commit:** `docs(readme): replace overclaims with accurate security model summary`
- **Files:** `README.md`
- **Change:** Remove “highly secure” absolute; describe gate + path containment + HITL; note `vm` residual risk; replace “CoW” with accurate wording.

#### Task R6.2.3 — Feature list matches enforced behavior
- **Commit:** `docs(readme): align features with DAG isolation auto-commit HITL`
- **Files:** `README.md`

---

### Step R6.3 — CHANGELOG & versions

#### Task R6.3.1 — Expand Unreleased with remediation entries as phases merge
- **Commit:** `docs(changelog): chronicle remediation phases under Unreleased`
- **Files:** `CHANGELOG.md`
- **Note:** May be amended multiple times; each phase end adds a bullet commit.

#### Task R6.3.2 — Fix false CHANGELOG claims (CoW, npm tier, capability count)
- **Commit:** `docs(changelog): correct historical inaccuracies with footnotes`
- **Files:** `CHANGELOG.md`
- **Change:** Strike or annotate incorrect “CoW”, “26 capabilities”, npm Tier 0 if reverted.

---

### Step R6.4 — Tool docs: tier labels (batch carefully — one commit per doc OR one commit per namespace)

> Prefer **one commit per tool doc** for bisectability (27 commits). If too noisy, one commit per namespace is acceptable **only if** the user relaxes §0.1 — default is **per file**.

#### Task R6.4.1 — `docs/tools/invoke.md` Tier A + schema `args` + errors
- **Commit:** `docs(tools): fix invoke tier schema and errors`

#### Task R6.4.2 — `docs/tools/list_capabilities.md` max-5 + no Tier A
- **Commit:** `docs(tools): fix list_capabilities contract`

#### Task R6.4.3 — `docs/tools/execute_step.md` full engine duties + failures
- **Commit:** `docs(tools): rewrite execute_step failure contract`

#### Task R6.4.4 — `docs/tools/run_script.md` log output + residual sandbox risk
- **Commit:** `docs(tools): update run_script log and security notes`

#### Task R6.4.5 — `docs/tools/read_file.md` outline fields + `invalid_path`
- **Commit:** `docs(tools): align read_file output and errors`

#### Task R6.4.6 — `docs/tools/apply_patch.md` field names + errors + atomic rename wording
- **Commit:** `docs(tools): align apply_patch with code`

#### Task R6.4.7 — `docs/tools/run_command.md` logId on all paths + failures
- **Commit:** `docs(tools): align run_command contract`

#### Task R6.4.8 — `docs/tools/detect_workspace.md` optional path + output shape
- **Commit:** `docs(tools): align detect_workspace`

#### Task R6.4.9 — `docs/tools/create_workflow.md` Tier A + `invalid_workflow`
- **Commit:** `docs(tools): fix create_workflow tier and errors`

#### Task R6.4.10 — `docs/tools/get_workflow_state.md` Tier A + optional ids + fullLog flag
- **Commit:** `docs(tools): align get_workflow_state`

#### Task R6.4.11 — `docs/tools/ask_user.md` approvalToken + timeout + remove no_pending lie
- **Commit:** `docs(tools): rewrite ask_user HITL contract`

#### Task R6.4.12 — `docs/tools/open_project.md` allowlist + confirmation behavior
- **Commit:** `docs(tools): document open_project security policy`

#### Task R6.4.13 — `docs/tools/search_files.md` Tier B + `matches[].content`
- **Commit:** `docs(tools): fix search_files tier and fields`

#### Task R6.4.14 — `docs/tools/read_file_section.md` Tier B + start/end/lines
- **Commit:** `docs(tools): align read_file_section`

#### Task R6.4.15 — `docs/tools/list_directory.md` items[].type
- **Commit:** `docs(tools): align list_directory`

#### Task R6.4.16 — `docs/tools/move_file.md` source/destination + errors
- **Commit:** `docs(tools): align move_file`

#### Task R6.4.17 — `docs/tools/expand_log.md` logId API (replace pid doc)
- **Commit:** `docs(tools): rewrite expand_log for logId`

#### Task R6.4.18 — `docs/tools/read_process_output.md` lines/nextLineOffset
- **Commit:** `docs(tools): align read_process_output`

#### Task R6.4.19 — `docs/tools/kill_process.md` verify still accurate
- **Commit:** `docs(tools): refresh kill_process`

#### Task R6.4.20 — `docs/tools/git_diff.md` staged flag
- **Commit:** `docs(tools): align git_diff`

#### Task R6.4.21 — `docs/tools/git_commit.md` amend + amend_conflicts error
- **Commit:** `docs(tools): align git_commit`

#### Task R6.4.22 — `docs/tools/git_branch.md` list/current
- **Commit:** `docs(tools): align git_branch`

#### Task R6.4.23 — `docs/tools/git_checkout.md` branch/create fields
- **Commit:** `docs(tools): align git_checkout`

#### Task R6.4.24 — `docs/tools/remember.md` content/tags
- **Commit:** `docs(tools): align remember with ADR 0006`

#### Task R6.4.25 — `docs/tools/recall.md` limit + result shape
- **Commit:** `docs(tools): align recall`

#### Task R6.4.26 — `docs/tools/checkpoint.md` optional step id + errors
- **Commit:** `docs(tools): align checkpoint`

#### Task R6.4.27 — `docs/tools/restore_checkpoint.md` failure contracts
- **Commit:** `docs(tools): align restore_checkpoint`

> Each tool doc must gain a `## Changelog` section per AGENTS.md §1.2 (can be added in the same per-file commit).

---

### Step R6.5 — Benchmarks honesty

#### Task R6.5.1 — Rewrite `v1-results.md` methodology
- **Commit:** `docs(benchmarks): rewrite v1-results distinguishing unit vs e2e`
- **Files:** `docs/benchmarks/v1-results.md`
- **Change:** Separate tables: (A) unit/integration regression status; (B) E2E harness status (pending until R7).

#### Task R6.5.2 — Update `v1-tasks.md` success criteria for ADR 0003 recovery
- **Commit:** `docs(benchmarks): clarify tasks 4-5 use caller recoveryCommand`
- **Files:** `docs/benchmarks/v1-tasks.md`

#### Task R6.5.3 — Map each task to intended harness file paths (future)
- **Commit:** `docs(benchmarks): add harness mapping table for R7`
- **Files:** `docs/benchmarks/v1-tasks.md` or new `docs/benchmarks/harness.md`

---

### Step R6.6 — AGENTS.md hygiene updates

#### Task R6.6.1 — Clarify gate lint is `scripts/lint-gate-bypass.js` (+ magic status script)
- **Commit:** `docs(agents): document actual static gate checks`
- **Files:** `AGENTS.md` §1.3

#### Task R6.6.2 — Note Tier A budget constant location
- **Commit:** `docs(agents): point tier A budget check at TIER_A_BUDGET`
- **Files:** `AGENTS.md` §2.1

**Phase R6 exit checklist**
- [ ] No known doc↔code contradiction on tiers/fields/errors for all 27 tools
- [ ] README start path works
- [ ] PRD 2.1.0 accepted, dangling refs gone
- [ ] Benchmarks do not claim false 100% E2E

---

## Phase R7 — Testing, adversarial suite, CI, release bar

**Exit gate:** DoD D1–D8 all checked; package version bumped; quality self-score ≥90 with evidence.

### Step R7.1 — Test isolation

#### Task R7.1.1 — Reset permission-rules cache helper for tests
- **Commit:** `test(gate): export resetRulesCache for test isolation`
- **Files:** `permission-gate.ts`, tests

#### Task R7.1.2 — Per-test temp DB or reset singleton
- **Commit:** `test(db): support isolated db path per test file`
- **Files:** `db.ts`, vitest setup
- **Change:** `CCATHOME_DB_PATH` or `resetDbForTests()`.

#### Task R7.1.3 — Vitest setup file restoring `config.workspaceRoot`
- **Commit:** `test(config): global afterEach restores workspaceRoot`
- **Files:** `src/test/setup.ts`, `vitest.config.ts`

#### Task R7.1.4 — Dashboard tests use port `0` (ephemeral)
- **Commit:** `fix(dashboard-test): bind ephemeral port to avoid collisions`
- **Files:** `dashboard-server.test.ts`, `startDashboardServer`

---

### Step R7.2 — Failure-contract matrix (AGENTS.md §1.3)

For each critical tool, add **one commit per tool** of missing failure tests:

#### Task R7.2.1 — `apply_patch` failure matrix complete
- **Commit:** `test(apply_patch): cover all documented failure codes`

#### Task R7.2.2 — `run_command` Tier2/spawn/log_setup failures
- **Commit:** `test(run_command): cover requires_confirmation and setup failures`

#### Task R7.2.3 — `run_script` timeout + gate deny + escape adversarial
- **Commit:** `test(run_script): adversarial and failure contracts`

#### Task R7.2.4 — `execute_step` step_not_found + dependencies_unmet + rollback bytes
- **Commit:** `test(execute_step): failure contracts and byte-level rollback`

#### Task R7.2.5 — `restore_checkpoint` not_found + git failures
- **Commit:** `test(restore_checkpoint): failure contracts`

#### Task R7.2.6 — `ask_user` invalid_response + missing_command + auth deny
- **Commit:** `test(ask_user): failure and auth contracts`

---

### Step R7.3 — Dedicated adversarial suite (PRD §8/§10, AGENTS §2.5)

#### Task R7.3.1 — Create `src/security/adversarial.path.test.ts`
- **Commit:** `test(security): path traversal absolute and relative cases`
- **Cases:** `../`, absolute `/etc/passwd`, null-byte `%00`, symlink escape (skip only with explicit `expect.fail` if EPERM — never silent pass).

#### Task R7.3.2 — Create `src/security/adversarial.gate.test.ts`
- **Commit:** `test(security): command chaining and sensitive writes`
- **Cases:** prefix+`;curl`, `npm install` tier, `node -e`, `| /bin/bash`, apply_patch `.git/hooks`.

#### Task R7.3.3 — Create `src/security/adversarial.sandbox.test.ts`
- **Commit:** `test(security): vm escape payloads fail closed`

#### Task R7.3.4 — Create `src/security/adversarial.hitl.test.ts`
- **Commit:** `test(security): agent cannot self-approve without token`

#### Task R7.3.5 — Create `src/security/adversarial.dashboard.test.ts`
- **Commit:** `test(security): dashboard XSS payload rendered escaped`

---

### Step R7.4 — Real benchmark harness (optional but needed for honest 100%)

#### Task R7.4.1 — Scaffold harness runner script
- **Commit:** `feat(benchmarks): add scripts/run-benchmark-task.ts skeleton`
- **Files:** `scripts/run-benchmark-task.ts`, `package.json` script `benchmark:v1`
- **Justification:** in-house harness; no new dep if possible.

#### Task R7.4.2 — Implement Task 1 harness (patch)
- **Commit:** `test(benchmarks): e2e task1 apply_patch harness`

#### Task R7.4.3 — Implement Task 6 harness (branch isolation)
- **Commit:** `test(benchmarks): e2e task6 branch isolation harness`

#### Task R7.4.4 — Implement Task 7 harness (adversarial path)
- **Commit:** `test(benchmarks): e2e task7 containment harness`

#### Task R7.4.5 — Implement Tasks 2–5 minimal scaffolds
- **Commit:** `test(benchmarks): e2e tasks2-5 execute_step scaffolds`
- **Note:** May split into multiple commits (one per task) — **preferred**.

#### Task R7.4.6 — Implement Tasks 8–10
- **Commit:** `test(benchmarks): e2e tasks8-10 process concurrency rollback`
- **Split per task if large.**

#### Task R7.4.7 — Publish real results document section
- **Commit:** `docs(benchmarks): record harness results with date and commit sha`
- **Files:** `docs/benchmarks/v1-results.md`

---

### Step R7.5 — Coverage + CI

#### Task R7.5.1 — Add vitest coverage provider
- **Commit:** `chore(test): add @vitest/coverage-v8 with justification`
- **Files:** `package.json`, `vitest.config.ts`
- **PR justification:** needed for release quality gate; no lighter alternative.

#### Task R7.5.2 — Set coverage thresholds (start realistic)
- **Commit:** `ci: enforce coverage thresholds on src/core and src/tools`
- **Change:** e.g. lines 70% initially; ratchet later.

#### Task R7.5.3 — CI job `adversarial`
- **Commit:** `ci: add adversarial test job`
- **Files:** `.github/workflows/ci.yml`
- **Change:** `vitest run src/security`

#### Task R7.5.4 — CI job `format-check`
- **Commit:** `ci: add prettier format:check`
- **Files:** `.github/workflows/ci.yml`

#### Task R7.5.5 — CI assert Tier A budget
- **Commit:** `ci: rely on index.test Tier A budget (document in workflow comment)`
- **Files:** `.github/workflows/ci.yml` comment or script

---

### Step R7.6 — Pre-commit secrets (AGENTS.md §1.4)

#### Task R7.6.1 — Add simple secret scan script
- **Commit:** `chore: add scripts/lint-no-secrets.js`
- **Files:** `scripts/lint-no-secrets.js`, wire into `npm run lint`
- **Change:** Regex for `AKIA`, `sk-`, private keys, etc. No new dependency required initially.

#### Task R7.6.2 — Optional husky hook
- **Commit:** `chore: add husky pre-commit running lint secrets check`
- **Files:** `.husky/pre-commit`, `package.json`
- **Justification:** AGENTS mandates pre-commit scan; husky is standard — **or** document that CI lint is the enforced gate if husky rejected to avoid dep. Prefer script-in-lint without husky if dependency aversion; if so, update AGENTS to say “CI lint includes secret scan” in a docs commit.

---

### Step R7.7 — Release bar

#### Task R7.7.1 — README clean-checkout smoke script
- **Commit:** `chore: add scripts/smoke-readme.sh`
- **Files:** `scripts/smoke-readme.sh`
- **Change:** `npm ci && npm run build && npm test && npm run lint`

#### Task R7.7.2 — Bump package to 2.1.0 (or 3.0.0 if breaking)
- **Commit:** `chore(release): bump version to 2.1.0`
- **Files:** `package.json`, `src/index.ts`, `src/index.test.ts`, `CHANGELOG.md` (move Unreleased → 2.1.0)

#### Task R7.7.3 — Final quality scorecard commit
- **Commit:** `docs(plans): record post-remediation quality scorecard`
- **Files:** `docs/plans/REMEDIATION_TO_90.md` appendix or `docs/plans/SCORECARD_90.md`
- **Change:** Re-score dimensions with evidence links to tests/ADRs.

**Phase R7 exit checklist (= repo 90+ DoD)**
- [ ] All CI jobs green
- [ ] Adversarial suite green
- [ ] Honest benchmark section published
- [ ] Version synced
- [ ] Scorecard ≥90 with no open Critical findings

---

## 3. Suggested PR / branch sequence

| Order | Branch | Contains | Review notes |
|---|---|---|---|
| 1 | `cursor/r0-decisions-1fef` | Phase R0 | Docs-heavy; fast merge |
| 2 | `cursor/r1-scaffolding-1fef` | Phase R1 | Low risk |
| 3 | `cursor/r2-security-1fef` | Phase R2 | **Second reviewer on gate** |
| 4 | `cursor/r3-core-loop-1fef` | Phase R3 | Product-critical |
| 5 | `cursor/r4-hitl-dashboard-1fef` | Phase R4 | Security + UX |
| 6 | `cursor/r5-contracts-1fef` | Phase R5 | Medium |
| 7 | `cursor/r6-docs-honesty-1fef` | Phase R6 | Can partially parallelize after R5 contracts freeze |
| 8 | `cursor/r7-test-ci-release-1fef` | Phase R7 | Release |

R6 tool-doc fixes that match **already stable** code can start after R2 if needed — but avoid documenting APIs that R3–R5 will change (`execute_step`, `ask_user`, `run_script`).

---

## 4. Per-commit workflow cheat sheet

```bash
# For every Task:
git checkout -b cursor/<phase>-<step>-1fef   # if not already on phase branch
# ... implement ONLY the Task files ...
npm run typecheck
npm run lint
npm test
git add -A
git commit -m "$(cat <<'EOF'
<type>(<scope>): <summary>

<body: what/why, cite finding ID e.g. S3/L1, cite ADR if any>
EOF
)"
git push -u origin HEAD
```

Never leave the tree with failing tests overnight unless Task is marked `ALLOW-RED` and the next Task restores green in the same working session.

---

## 5. Traceability matrix (finding → Tasks)

| Finding | Tasks |
|---|---|
| S1 self-approve | R0.2.6, R4.1.1, R7.3.4 |
| S2 sticky approve | R4.1.2 |
| S3 workspace retarget | R0.2.1, R2.2.3a/b |
| S4 node Tier 1 | R2.1.2 |
| S5 prefix chaining | R2.1.5, R7.3.2 |
| S6 vm escape | R0.2.5, R2.3.1–3, R7.3.3 |
| S7 sensitive writes | R2.1.7, R7.3.2 |
| S8 npm install | R2.1.3 |
| S9 git injection | R2.4.1–5 |
| S10 weak gate lint | R2.5.1–3 |
| S11 token print | R4.2.1 |
| S12 XSS | R4.3.4, R7.3.5 |
| S13 expand_log | R2.2.2 |
| S14 env leak | R2.3.5 |
| S15 rules poison | R0.2.4, R2.1.1 |
| S16 pipe shell | R2.1.6 |
| L1 DAG | R3.1.1 |
| L2 isolation | R3.2.1 |
| L3 auto-commit | R3.2.2 |
| L4 exec ignore | R3.3.1 |
| L5 recovery ignore | R3.3.2 |
| L6 maxRetries | R3.3.3 |
| L7 HITL incomplete | R4.3.*, R4.4.3 |
| L8 dispatcher Tier2 | R4.4.2 |
| L9 step PK | R3.1.3 |
| L10 checkpoint | R5.4.* |
| L11 script write | R2.3.4 |
| L12 command_log | R5.2.* |
| T1 failing tests | R0.3.1–2 |
| T2 dishonest bench | R0.3.3, R6.5.*, R7.4.* |
| T3 failure contracts | R7.2.* |
| T4 adversarial CI | R7.3.*, R7.5.3 |
| T5 vitest config | R1.2.3, R7.1.* |
| T6 shared state | R7.1.* |
| D-A version skew | R0.4.1, R7.7.2 |
| D-B README dev | R1.2.1, R6.2.1 |
| D-C PRD Tier A | R0.2.1, R6.1.2 |
| D-D tool docs | R6.4.* |
| D-E CHANGELOG rules | R2.1.4, R6.3.2 |
| D-F dangling refs | R0.1.3, R6.1.8 |
| D-G CoW wording | R6.2.2, R6.4.6 |
| D-H secrets scan | R7.6.* |
| D-I magic strings | R1.1.* |
| D-J context manager | R5.1.* |

---

## 6. Explicit non-goals (still out of scope for 90+)

Do **not** expand scope into these while executing this plan:

- Docker/`isolated-vm` as default sandbox (optional ADR future)
- Vector memory / `sqlite-vec`
- Browser automation
- Multi-agent orchestration
- Windows PowerShell parity (PRD non-goal); keep Linux/macOS green
- Squash/cleanup merge-back tool (PRD Phase 3 risk) — track as follow-up after 90+

---

## 7. Appendix A — Current failing tests (baseline)

Observed 2026-07-11 on Linux CI image:

1. `src/tools/process/process.test.ts` — expand_log missing stderr (`hello stderr`)
2. `src/tools/system/discovery.test.ts` — Windows path retarget expectation

These are Task R0.3.1 and R0.3.2. Do not start R2 until green.

---

## 8. Appendix B — File touch map (high-churn)

| Path | Phases |
|---|---|
| `permission-rules.json` | R2 |
| `src/core/permission-gate.ts` | R2, R4 |
| `src/tools/workflow/execute_step.ts` | R1, R3, R5 |
| `src/tools/system/ask_user.ts` | R1, R4 |
| `src/core/dashboard-server.ts` | R1, R4 |
| `src/tools/process/run_script.ts` | R2, R5 |
| `src/tools/process/run_command.ts` | R0, R2, R5 |
| `src/core/git-utils.ts` | R2, R3 |
| `src/tools/git/*.ts` | R2 |
| `PRD.md` | R6 |
| `docs/tools/*.md` | R6 |
| `.github/workflows/ci.yml` | R7 |
| `db/migrations/0003+` | R3, R4, R5 |

---

## 9. Appendix C — Quality scorecard template (fill in R7.7.3)

| Dimension | Score | Evidence |
|---|---:|---|
| Structure & conventions | 92 | See `docs/plans/SCORECARD_90.md` |
| Logic / product contracts | 93 | See scorecard |
| Security | 91 | See scorecard + `src/security/` |
| Testing | 91 | See scorecard |
| Docs / honesty | 93 | See scorecard |
| **Overall** | **92** | Target ≥90 — filled R7.7.3 |

---

*End of remediation plan. Execute in phase order. One Task = one commit. Update this document only via dedicated `docs(plans):` commits when scope decisions change.*
