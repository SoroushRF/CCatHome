# CCatHome — Three-Stage Code Quality Report

**Audience:** Humans and downstream AI agents. This document is self-contained.  
**Product:** `ccathome` — portable MCP (stdio) TypeScript server for gated multi-step agent execution (DAG workflows, permission gate, HITL dashboard, SQLite memory).  
**Repo:** `github.com/SoroushRF/CCatHome`  
**Report date:** 2026-07-11  
**Authors:** Independent audit + remediation + security-hardening follow-up (cloud agent)  
**Branch for Stage C:** `cursor/security-audit-fixes-53b2` (PR #3)  
**Base branch:** `main`

---

## 0. How to read this document

### 0.1 Three stages (checkpoints)

| Stage | Nickname | Git checkpoint | Approx. commits on `main` lineage | Independent overall score |
|---|---|---|---:|---:|
| **A** | Pre-remediation (Phases 0–3 “done”) | `a768029` — last commit **before** `docs: add REMEDIATION_TO_90 comprehensive plan` (`c72b131`) | **49** | **~52/100** |
| **B** | Post-remediation R0–R7 | `58b60c9` — `Merge remediation R6–R7 into main` (scorecard claimed 92) | **158** | **~70/100** (internal claim **92** was inflated) |
| **C** | Post security-audit fixes | `HEAD` on `cursor/security-audit-fixes-53b2` (`a687afc`) = Stage B + **21** hardening commits | **179** | **~86/100** |

Stage C is the **most detailed** section. Stages A and B provide historical context so another agent can understand *why* Stage C looks the way it does.

### 0.2 Scoring rubric (same for all stages)

| Dimension | What it measures |
|---|---|
| Structure & conventions | One-capability-one-file, ADRs, constants/enums, custom lints, CI shape |
| Logic / product contracts | DAG, execute_step loop, HITL, tool failure contracts, schema honesty |
| Security | Permission gate completeness, path containment, HITL authority, sandbox honesty |
| Testing | Failure-path tests, adversarial suite, isolation, coverage gates |
| Docs / honesty | PRD↔code↔tools↔README↔CHANGELOG alignment; no overclaim |

Weighted overall ≈ equal blend of the five dimensions (security + logic weighted slightly higher in narrative judgment because this is a security-sensitive agent execution layer).

### 0.3 Product summary (unchanged across stages)

CCatHome exposes ~12 Tier A MCP tools and routes Tier B capabilities through `invoke` / `list_capabilities`. Core loop: plan workflow → `execute_step` (checkpoint → exec → validate → recover) → gated shell/git/fs → HITL dashboard on `:3141`. Storage: SQLite + FTS5. Non-goals (v1): Docker sandbox, browser automation, vector memory, Windows shell parity.

---

## 1. Stage A — Pre-remediation (~52/100)

### 1.1 Checkpoint identity

- **SHA:** `a768029` (`fix(lint): whitelist open_project.ts…`)
- **Date:** 2026-06-29 (feature build through late June; remediation plan lands 2026-07-11)
- **Commit count:** 49
- **Next commit (start of Stage B work):** `c72b131` — `docs: add REMEDIATION_TO_90 comprehensive plan`
- **ADRs present:** 3 (`0001` sandbox runtime, `0002` DB, `0003` execute_step recovery)
- **Package narrative:** Feature-complete Phases 0–3 claimed; quality not yet audited honestly

### 1.2 What existed (goods / pros)

| Area | Strength |
|---|---|
| Product skeleton | Full MCP server path: bootstrap → Tier A registration → stdio transport |
| Capability surface | Filesystem, process, git, workflow, checkpoint, memory, `run_script`, discovery, `ask_user`, dashboard |
| Permission gate v0 | Data-driven `permission-rules.json` + classify/gate helpers |
| Custom lint | Early `lint-gate-bypass` for tool-layer `child_process`/`fs` |
| Docs ambition | PRD, IMPLEMENTATION_PLAN, AGENTS.md, README, CHANGELOG, many `docs/tools/*` |
| Architecture intent | Tier A/B dispatcher, SQLite migrations, DAG workflow engine |

### 1.3 What was broken (bads / cons)

Baseline inventory from `docs/plans/REMEDIATION_TO_90.md` §1 (objective audit 2026-07-11):

#### Critical security (S1–S16)

| ID | Finding |
|---|---|
| S1 | Agent could self-approve Tier 2 via `ask_user({ response: "approved" })` |
| S2 | Approvals sticky (never consumed) |
| S3 | `open_project` / `detect_workspace` retarget any path at Tier 0 |
| S4 | `^node\b` Tier 1 → arbitrary ungated code |
| S5 | Prefix-anchored Tier 0/1 + shell chaining false negatives |
| S6 | `vm` escapable; no timeout; host `console` |
| S7 | Sensitive-path Tier 3 only matched synthetic `write_file` strings |
| S8 | `npm i` / `npm install` / `npm ci` Tier 0 (lifecycle scripts) |
| S9 | Git helpers shell-inject via unquoted interpolation |
| S10 | Gate-bypass lint weaker than AGENTS claims |
| S11 | Dashboard token never printed → 401 forever |
| S12 | Dashboard XSS via `innerHTML` |
| S13 | `expand_log` trusted `logId` path segment |
| S14 | Full `process.env` leaked to every spawn |
| S15 | Workspace could poison `permission-rules.json` load order |
| S16 | Pipe-to-shell Tier 3 incomplete (`|/bin/bash`, `$()`, backticks) |

#### Critical product logic (L1–L12)

| ID | Finding |
|---|---|
| L1 | `execute_step` ignored DAG readiness |
| L2 | Branch isolation never wired into workflow path |
| L3 | No auto-commit on successful `execute_step` |
| L4 | Success ignored `executionCommand` exit code |
| L5 | Recovery failures ignored |
| L6 | `maxRetries` off-by-one |
| L7 | HITL incomplete (no dashboard approve; clarification stub) |
| L8 | Dispatcher Tier 2 bare deny |
| L9 | Global step ID PK collision across workflows |
| L10 | Checkpoint dirs/renames/atomicity / ungated hard reset issues |
| L11 | `run_script.writeFile` bypassed write contract |
| L12 | `command_log` never written |

#### Testing / honesty (T1–T6)

| ID | Finding |
|---|---|
| T1 | Suite failing (58/60) while benchmarks claimed 100% |
| T2 | Benchmarks remapped unit tests to “10 E2E tasks” |
| T3 | Failure contracts largely untested |
| T4 | No adversarial CI / vm-escape suite |
| T5 | No vitest isolation/coverage config |
| T6 | Shared mutable globals → flakiness |

#### Docs / hygiene

Version skew (package 1.0.0 vs CHANGELOG 2.0.0), PRD draft vs code Tier A count, tool-doc drift, CoW marketing overclaim, missing Context Manager module, magic status strings.

### 1.4 Stage A scorecard

| Dimension | Score | Note |
|---|---:|---|
| Structure & conventions | 72 | Good layout; weak enforcement |
| Logic / product contracts | 45 | Flagship loop not faithful to PRD |
| Security | 32 | Multiple complete bypasses |
| Testing | 52 | Red suite + dishonest benchmarks |
| Docs / honesty | 40 | Drift and overclaim |
| **Overall** | **~52** | “Shipped shape, not production-ready” |

### 1.5 Stage A pros / cons summary

**Pros:** Fast vertical slice of a real MCP agent runtime; clear product vision; permission-gate *concept* present; enough surface to remediate against.

**Cons:** Security theater risk (gate exists but bypassable); product contracts not enforced; tests/benchmarks dishonest; docs ahead of/behind code inconsistently.

### 1.6 Stage A → Stage B transition

Authoritative plan: `docs/plans/REMEDIATION_TO_90.md` (commit `c72b131`). Phases R0–R7 (~155 planned atomic tasks). Target ≥90. Historical `IMPLEMENTATION_PLAN.md` Phases 0–3 marked non-authoritative.

---

## 2. Stage B — Post-remediation R0–R7 (~70 independent / 92 claimed)

### 2.1 Checkpoint identity

- **SHA:** `58b60c9` — `Merge remediation R6–R7 into main`
- **Date:** 2026-07-11
- **Commit count:** 158 (~109 commits of remediation after Stage A)
- **Package:** `2.1.0`
- **Internal scorecard:** `docs/plans/SCORECARD_90.md` claimed **92/100**
- **Independent re-audit (before Stage C):** **~70/100**

### 2.2 What remediation delivered (goods / pros)

| Area | Delivered |
|---|---|
| ADRs | 0004–0010 (Tier A budget, execute_step contract, memory API, rules trust, vm residual, HITL authority, ungated restore rationale) |
| Security closes | Self-approve blocked (approval token); single-use command approvals; chaining escalation for `; & | $()`; npm/node demoted; sensitive path blocks on `apply_patch`; env scrub; rules not loaded from `workspaceRoot`; argv git helpers; dashboard token + XSS fixes; expand_log hex id |
| Product loop | DAG readiness, branch isolation `ccathome/`, auto-commit `[ccathome-auto]`, exec+validation exit checks, recovery abort |
| HITL | Dashboard approve/reject API; `CCATHOME_APPROVAL_TOKEN` |
| Testing | Failure matrices R7.2; `src/security/adversarial.*`; vitest isolation; coverage thresholds; benchmark harness 10/10 labeled honest |
| CI | lint + typecheck + test + coverage + adversarial job + format-check |
| Docs | PRD 2.1.0; 27 tool docs; honest `v1-results.md`; CHANGELOG 2.1.0 |
| Custom lints | gate-bypass, no-magic-status, no-secrets |

### 2.3 What the independent audit still found at Stage B (bads / cons)

These are the findings that motivated Stage C (the 21 commits). Severity as audited against Stage B tree:

#### Critical / high — security

| # | Finding | Evidence |
|---|---|---|
| 1 | Shell **redirection** / bare `$VAR` not treated as meta → Tier 0 prefix can write outside workspace | `SHELL_META_RE` lacked `>` `<` `$VAR`; `run_command` uses `shell: true` |
| 2 | `^git config\b` was **Tier 1** → classic git RCE (`alias`, `core.hooksPath`, `core.sshCommand`) | `permission-rules.json` |
| 3 | ADR 0010 said “do not expose ungated reset as public Tier B” but **`restore_checkpoint` was registered** and callable via `invoke` | `bootstrap.ts` + `restore_checkpoint.ts` + `runCommandUngated(\`git reset --hard ${sha}\`)` |
| 4 | Broad unanchored patterns (`^vitest`, `^eslint`, `^tsc`, `^git log`) | `permission-rules.json` |
| 5 | Leaving isolation via `git checkout main` still Tier 1 | rules |
| 6 | `$()` / backticks not fully Tier 3 (S16 incomplete) | rules |
| 7 | cwd fallback for `permission-rules.json` when cwd == workspaceRoot | ADR 0007 gap |
| 8 | Node `vm` still escapable (accepted residual ADR 0008) | documented |

#### High / medium — logic

| # | Finding |
|---|---|
| 9 | `run_script` **double `classifyAndGate`** → single-use approval consumed then command fails |
| 10 | Dispatcher **capability Tier 2 never consumed APPROVED** (always inserted PENDING) |
| 11 | `ask_user` clarification returned approve/reject status, not free-text answer |
| 12 | `run_command` returned `success: true` on nonzero exit |
| 13 | `maxRetries` unbounded |
| 14 | `backupPath` not path-contained on restore |
| 15 | Shell-interpolated SHA in restore |

#### Testing / docs gaps at Stage B

| # | Finding |
|---|---|
| 16 | `open_project` / `scrubEnv` / workspace-retarget largely untested |
| 17 | Thin Tier B negative tests (`expand_log`, `kill_process`, `get_workflow_state`) |
| 18 | `list_capabilities` ≤5 cap untested |
| 19 | AGENTS cited nonexistent `registry.test.ts` |
| 20 | README smoke script not in CI |
| 21 | Scorecard **92** overclaimed vs residual bypasses |

### 2.4 Stage B scorecard (independent vs internal)

| Dimension | Internal claim | Independent | Gap reason |
|---|---:|---:|---|
| Structure | 92 | **86** | Strong ADRs/lints; small AGENTS drift |
| Logic | 93 | **62** | Double-gate, dispatcher Tier2, clarify, success flags |
| Security | 91 | **58** | Redirect, git config, public restore, anchors |
| Testing | 91 | **74** | Untested Tier A security helpers |
| Docs / honesty | 93 | **78** | Scorecard overclaim; thin failure docs |
| **Overall** | **92** | **~70** | Process hygiene ≠ live security |

### 2.5 Stage B pros / cons summary

**Pros:** Transformational vs Stage A — real HITL authority, chaining fixes, DAG/isolation/auto-commit, adversarial CI, honest benchmarks, ADR culture. This is a real product, not a prototype.

**Cons:** Internal scorecard treated remediation DoD checkboxes as “90+” while classifier gaps and ADR 0010 violations remained; several logic bugs in approval consumption; Tier A security surfaces under-tested.

### 2.6 Stage B → Stage C transition

Independent audit (2026-07-11) produced ~70 rating and a prioritized fix list. Implementation: branch `cursor/security-audit-fixes-53b2`, **21 commits**, PR https://github.com/SoroushRF/CCatHome/pull/3.

---

## 3. Stage C — Current (post 21 security-audit commits) — DETAILED

### 3.1 Checkpoint identity

- **Branch:** `cursor/security-audit-fixes-53b2`
- **HEAD (at report time):** `a687afc`
- **Base:** `58b60c9` (Stage B / `main`)
- **Delta:** **+21 commits**, ~+898 / −310 lines across 43 files
- **Independent overall score:** **~86/100**
- **Tests at report time:** **157/157** pass; lint errors 0 (warnings remain for `any`); typecheck pass; format-check pass

### 3.2 Full list of the 21 commits (oldest → newest)

```
1f8d495 security(gate): escalate Tier 0/1 on shell redirection and env expansion
b30ebcb security(rules): demote git config and tighten Tier 0/1 anchors
3d9ed4b test: use ungated initGitRepoForTests after git config demotion
16ee6bb feat(process-runner): add runArgvUngated for shell-free internal git
225671d security(restore): argv-only ungated git reset and contain backup paths
c82f33a security(adr-0010): un-register checkpoint/restore from agent invoke
9dd0836 fix(run_script): stop double-consuming single-use Tier 2 approvals
ffe7c89 fix(dispatcher): consume single-use approvals for capability Tier 2
f4cb6d1 fix(execute_step): cap maxRetries at 10 to bound auto-fix DoS
c76e9fb fix(run_command): set success false when process exits nonzero
3fe1b2d db: add pending_confirmations.answer_text for clarification HITL
a286bc7 fix(hitl): return free-text clarification answers via answer_text
9c3120c feat(dashboard): clarification answer API and timing-safe auth
db9b538 security(gate): never load permission-rules from workspace cwd
b8a4fc3 security(scrub-env): strip DATABASE_URL/PRIVATE_KEY and add unit tests
ce531eb test(security): adversarial gate cases and open_project coverage
1be9287 test: expand failure contracts for process, workflow, list_capabilities
ebfaf9e docs(adr-0010): require argv ungated restore and no public Tier B
b438238 docs: changelog, tool contracts, AGENTS path, CI smoke-readme
b1c6b3f fix(git_checkout): surface requires_confirmation for non-isolated branches
a687afc style+docs: prettier format and revise post-audit scorecard to ~86
```

### 3.3 What was fixed (mapped to Stage B findings)

#### Security fixes

| Finding | Fix | Key files |
|---|---|---|
| Redirect / `$VAR` bypass | Expand meta detection; escalate Tier 0/1 | `src/core/permission-gate.ts` |
| `git config` Tier 1 RCE | General config → Tier 2; dangerous keys → Tier 3; only `user.name`/`user.email` Tier 1 | `permission-rules.json` |
| Isolation checkout | Auto-allow only `ccathome/`; other checkouts Tier 2 | `permission-rules.json`, `git_checkout.ts` |
| Unanchored prefixes | Anchor `vitest`/`eslint`/`prettier`/`tsc`/`git log`/`git show` | `permission-rules.json` |
| `$()` / backticks | Tier 3 patterns | `permission-rules.json` |
| Public ungated restore | Un-register from bootstrap; handlers engine-internal only | `src/core/bootstrap.ts`, checkpoint tools |
| Shell-interpolated SHA | `runArgvUngated` + `assertSafeGitRef` | `process-runner.ts`, `restore_checkpoint.ts`, `checkpoint.ts` |
| `backupPath` escape | `resolveSafePath` | `restore_checkpoint.ts` |
| Rules cwd == workspace | Skip cwd fallback when equal to workspaceRoot | `permission-gate.ts` |
| Env secret leak | Expand denylist (`DATABASE_URL`, `PRIVATE_KEY`, …) | `scrub-env.ts` |
| Dashboard token timing | `timingSafeEqual` | `dashboard-server.ts` |

#### Logic / HITL fixes

| Finding | Fix | Key files |
|---|---|---|
| Double-gate in `run_script` | Single `runCommandGated` call | `run_script.ts` |
| Dispatcher Tier 2 never consumes | Transactional APPROVED consume / PENDING insert | `dispatcher.ts` |
| Clarification no answer | Migration `0006` `answer_text`; dashboard `/answer` API; ask_user poll returns text | `db/migrations/0006-…`, `confirmations.ts`, `ask_user.ts`, `dashboard-server.ts` |
| `success: true` on fail | `success: (code ?? 0) === 0` | `run_command.ts` |
| Unbounded retries | Zod `.min(0).max(10)` | `execute_step.ts` |
| Checkout confirmation surfacing | Map `RequiresConfirmationError` → `requires_confirmation` | `git_checkout.ts` |

#### Tests / CI / docs

| Item | Change |
|---|---|
| Harness | `src/test/init-git-repo.ts` for ungated test repo init |
| New tests | `open_project.test.ts`, `scrub-env.test.ts`, adversarial gate expansions, process/workflow/discovery failure contracts |
| Lint | Track `runArgvUngated` in gate-bypass allowlist |
| CI | `smoke-readme` job |
| Docs | ADR 0010 updated; tool docs for checkpoint/restore/open_project; CHANGELOG Unreleased; AGENTS Tier A test path; scorecard revised to ~86 |
| Engines | `package.json` `"engines": { "node": ">=18" }` |

### 3.4 Stage C architecture snapshot (for agents)

```
src/index.ts
  → registerAllCapabilities()   # NO checkpoint/restore registration
  → MCP Tier A tools only (budget 12)
  → dashboard :3141

src/core/
  permission-gate.ts   # classify + meta escalate + single-use consume
  process-runner.ts    # runCommandGated / runArgvGated / runArgvUngated
  dispatcher.ts        # invoke + capability Tier 2 consume + list ≤5
  workflow-engine.ts   # DAG
  db.ts + db/migrations/0001–0006

src/tools/
  workflow/execute_step.ts  # imports checkpoint handlers DIRECTLY
  checkpoint/*              # engine-internal only
  process/run_command.ts    # shell:true AFTER gate
  process/run_script.ts     # vm + gated helpers (ADR 0008 residual)

permission-rules.json       # data plane for tiers
scripts/lint-gate-bypass.js # CI enforcement
```

### 3.5 Stage C scorecard (detailed)

| Dimension | Score | Goods | Remaining bads |
|---|---:|---|---|
| Structure & conventions | **90** | ADRs 0001–0010 enforced in code; one-capability-one-file; custom lints; engines; CI smoke | Soft `any` warnings; magic-string lint covers statuses not all capability names |
| Logic / product contracts | **84** | Approval consume paths coherent; clarify answers; nonzero exit; maxRetries bound; git_checkout surfaces HITL | Step IDs still globally unique PK historically; concurrent `config.activeStepId` races; capability Tier 2 rarely used in prod tools |
| Security | **86** | Redirect/env escalate; git config RCE blocked; restore not agent-callable; argv restore; rules trust hardened; scrubEnv expanded | `shell:true` still on ad-hoc commands; `vm` escapable (ADR 0008); incomplete secret denylist possible; local dashboard CSRF-ish residual |
| Testing | **88** | 157 green; open_project/scrubEnv/adversarial expansions; failure contracts broader | Coverage thresholds soft; MCP stdio E2E still mocked; some Tier B negatives still thin; timing sleeps in process tests |
| Docs / honesty | **88** | Scorecard no longer claims 92; ADR 0010 matches code; CHANGELOG Unreleased accurate | REMEDIATION plan checkboxes may still show `[ ]` archaeologically; PRD “shell behind interface” still aspirational |
| **Overall** | **~86** | Production-adjacent MCP gate | Not yet “hard sandbox / argv-only world” |

### 3.6 Stage C pros / cons

**Pros**
- Classifier covers the previously exploited redirect/`$VAR`/`git config`/isolation gaps.
- Ungated destructive git is no longer an agent-facing Tier B escape hatch.
- Approval single-use semantics work for both command and capability Tier 2 paths.
- Clarification HITL is actually usable (free text).
- Test suite green with security-focused additions.
- Docs/scorecard honesty improved (86 vs fake 92).

**Cons**
- `run_command` still shells out (`shell: true`) — meta escalation is a band-aid; argv-first would be stronger.
- Node `vm` is not a security boundary (documented; still a product limit if agents run untrusted code).
- Global mutable config / step context can race under concurrency.
- Coverage gate allows under-tested files if package averages hold.
- No Dependabot / `npm audit` CI; dependency hygiene manual.
- Windows not supported (honest non-goal, but limits audience).

### 3.7 Verification commands (Stage C)

```bash
npm ci
npm run build
npm run lint
npm run typecheck
npm test                 # expect 157+ pass
npm run test:adversarial
npm run coverage
npm run format:check
./scripts/smoke-readme.sh
npm run benchmark:v1
```

### 3.8 Key file reference map (Stage C)

| Path | Role |
|---|---|
| `permission-rules.json` | Tier 0–3 patterns |
| `src/core/permission-gate.ts` | Classification + approval consume + meta escalate |
| `src/core/process-runner.ts` | Gated/ungated spawn |
| `src/core/dispatcher.ts` | `invoke`, Tier A budget, capability Tier 2 |
| `src/core/bootstrap.ts` | Capability registration (no checkpoint/restore) |
| `src/tools/workflow/execute_step.ts` | Flagship loop |
| `src/tools/checkpoint/*` | Engine-internal snapshot/restore |
| `src/tools/process/run_command.ts` | Ad-hoc shell |
| `src/tools/process/run_script.ts` | VM sandbox |
| `src/tools/system/ask_user.ts` | HITL |
| `src/core/dashboard-server.ts` | Local UI + answer API |
| `src/core/scrub-env.ts` | Child env scrubbing |
| `docs/adr/0010-restore-ungated-git.md` | Ungated restore policy |
| `docs/plans/REMEDIATION_TO_90.md` | Stage A→B plan |
| `docs/plans/SCORECARD_90.md` | Living scorecard (now ~86) |
| `CHANGELOG.md` `[Unreleased]` | Stage C delta notes |

---

## 4. Cross-stage comparison

| Metric | Stage A | Stage B | Stage C |
|---|---|---|---|
| Commits | 49 | 158 | 179 |
| Independent score | ~52 | ~70 | **~86** |
| Internal claim | (none formal) | **92** (inflated) | **86** (aligned) |
| ADRs | 3 | 10 | 10 (0010 enforced) |
| Complete security bypasses (audit-class) | Many (S1–S16) | Fewer but serious residuals | Residuals mostly accepted/`shell:true`/`vm` |
| Flagship loop fidelity | Low | High | High + approval bugs fixed |
| Adversarial CI | No | Yes | Yes + expansions |
| Agent-callable ungated `git reset --hard` | Yes (via restore) | Yes (ADR violated) | **No** |
| `git config` auto-allow | Yes (dangerous) | Yes (Tier 1) | **No** (Tier 2/3) |
| Redirect bypass on Tier 0 | Yes | Yes | **Mitigated** (escalate ≥2) |
| Test honesty | Poor | Good harness | Good + broader negatives |
| Docs honesty | Poor | Better | Best of three |

### Trajectory narrative

1. **Stage A** built the product shape quickly; security and contracts lagged.  
2. **Stage B** closed the catastrophic Stage A holes and built process maturity — then **over-scored itself**.  
3. **Stage C** fixed the independent audit’s remaining critical classifier/ADR/logic gaps and **rebased honesty to ~86**.

---

## 5. Roadmap — boost Stage C toward 90–95

Prioritized for another agent. Prefer **one concern per PR/commit**. Do not claim 90+ until D1–D8 below are true *and* residual `shell:true`/`vm` story is product-accepted with tests.

### 5.1 P0 — Security depth (target +3 to +5 pts)

| # | Task | Acceptance |
|---|---|---|
| R1 | Prefer **argv-only** execution for Tier 0/1 allowlisted commands; reserve `shell:true` for Tier 2+ after confirm | Adversarial: redirect on Tier 0 never reaches spawn |
| R2 | Optional: deny `shell:true` entirely when `CCATHOME_NO_SHELL=1` | Documented env flag + tests |
| R3 | Expand secret scrub denylist from real agent env dumps (`*_KEY`, `*_CREDENTIALS`, cloud provider vars) | Unit table in `scrub-env.test.ts` |
| R4 | Harden `run_script` further or document “never run untrusted code” as hard product rule in README/PRD | ADR 0008 addendum or isolated-vm revisit decision |
| R5 | Add adversarial cases for `${IFS}`, nested redirects, `git -c` option injection | New tests in `src/security/` |

### 5.2 P1 — Logic / concurrency (target +2 to +3 pts)

| # | Task | Acceptance |
|---|---|---|
| L1 | Replace global `config.activeStepId` with per-invocation AsyncLocalStorage / request context | Concurrent execute_step test |
| L2 | Migration to make `(workflow_id, step_id)` the real primary identity (historical L9 completion) | Two workflows can share step id `"build"` |
| L3 | Cap/poll less blockingly for `ask_user` (or async confirmation id return) | MCP session not blocked 60s |
| L4 | Ensure `git_*` tools consistently surface `requires_confirmation` (parity with checkout) | Shared helper |

### 5.3 P2 — Testing / CI (target +1 to +2 pts)

| # | Task | Acceptance |
|---|---|---|
| T1 | Raise coverage thresholds gradually; fail on under-covered security files | `permission-gate`, `scrub-env`, `open_project` file-local floors |
| T2 | Real MCP stdio smoke (spawn server, list tools, one invoke) | Replaces `_registeredTools` private poke |
| T3 | Add `npm audit --production` (or OSV) to CI; Dependabot | CI job green policy documented |
| T4 | Remove timing sleeps where possible; event-based readiness | Flake rate ↓ under load |
| T5 | Property/fuzz classifyCommand corpus | Hundreds of mutated shell strings |

### 5.4 P3 — Docs / release hygiene (target +1 pt)

| # | Task | Acceptance |
|---|---|---|
| D1 | Flip REMEDIATION checkbox archaeology or mark plan `Status: Completed with residuals` | No stale `[ ]` implying unfinished shipped work |
| D2 | PRD: replace “shell behind interface” with accurate driver description or introduce a real `ShellDriver` interface | PRD matches code |
| D3 | Release `2.2.0` (minor: security hardening behavior changes) with migration note for agents that relied on public `restore_checkpoint` / auto `git config` | CHANGELOG + semver |
| D4 | Keep scorecard ≤ claimed CI evidence; never claim 90+ with known complete bypasses | SCORECARD discipline |

### 5.5 Suggested Definition of Done for “≥90”

| # | Criterion |
|---|---|
| D1 | Independent security review finds **no** Tier 0/1 path that writes outside workspace without confirmation |
| D2 | No agent-callable ungated destructive git |
| D3 | Approval consume semantics tested for command + capability + `run_script` gated.runCommand |
| D4 | Coverage floors on security-critical files |
| D5 | Scorecard ≤ independent audit ±2 |
| D6 | CI: lint, typecheck, test, adversarial, coverage, format, smoke-readme, audit |
| D7 | PRD/README/ADR/tool docs aligned on sandbox & shell model |
| D8 | Package version released with CHANGELOG matching behavior |

### 5.6 Explicit non-goals (do not inflate score by claiming these)

- Full OS sandbox / containers (unless product decides Docker opt-in)
- Making Node `vm` a hard security boundary without runtime change
- Windows shell parity
- LLM-in-the-loop E2E as the only quality bar (keep harness honesty)

---

## 6. Agent handoff notes

### 6.1 If continuing security work

1. Start from branch tip of `cursor/security-audit-fixes-53b2` (or merged `main` if PR #3 merged).  
2. Prefer P0 roadmap items R1–R5.  
3. Keep AGENTS.md rules: one capability one file; no gate bypass; ADRs for security model changes; failure contracts before merge.  
4. Every meaningful step = separate commit (this repo’s culture).

### 6.2 If validating claims

```bash
git log --oneline 58b60c9..HEAD   # must show the 21 Stage C commits
npm test && npm run test:adversarial
rg 'registerCapability\(.*[Cc]heckpoint' src/core/bootstrap.ts  # should be empty
rg 'git config\\\\b' permission-rules.json
rg 'SHELL_.*RE|hasShellRedirection|hasEnvExpansion' src/core/permission-gate.ts
```

### 6.3 Source documents

| Doc | Use |
|---|---|
| `docs/plans/REMEDIATION_TO_90.md` | Stage A inventory + R0–R7 plan |
| `docs/plans/SCORECARD_90.md` | Living scores (Stage C = ~86) |
| `docs/adr/0001`–`0010` | Point-in-time decisions |
| `CHANGELOG.md` | `[2.1.0]` = Stage B; `[Unreleased]` = Stage C |
| This file | Three-stage narrative for agents |

### 6.4 Rating cheat-sheet

```
Stage A (a768029, 49 commits):           ~52/100
Stage B (58b60c9, 158 commits):          ~70/100 independent (claimed 92)
Stage C (a687afc, +21 commits):          ~86/100  ← current realistic rating
```

---

## 7. Appendix — Stage C file touch list

```
.github/workflows/ci.yml
AGENTS.md
CHANGELOG.md
db/migrations/0006-confirmation-answer.sql
docs/adr/0010-restore-ungated-git.md
docs/plans/SCORECARD_90.md
docs/tools/checkpoint.md
docs/tools/open_project.md
docs/tools/restore_checkpoint.md
package.json
permission-rules.json
scripts/lint-gate-bypass.js
src/benchmarks/helpers.ts
src/benchmarks/task10.test.ts
src/core/bootstrap.ts
src/core/confirmations.ts
src/core/dashboard-server.ts
src/core/dispatcher.test.ts
src/core/dispatcher.ts
src/core/permission-gate-chaining.test.ts
src/core/permission-gate.ts
src/core/process-runner.ts
src/core/scrub-env.test.ts
src/core/scrub-env.ts
src/security/adversarial.gate.test.ts
src/test/init-git-repo.ts
src/tools/checkpoint/*
src/tools/git/git.test.ts
src/tools/git/git_checkout.ts
src/tools/integration.test.ts
src/tools/process/process.test.ts
src/tools/process/run_command.ts
src/tools/process/run_script.ts
src/tools/system/ask_user.ts
src/tools/system/discovery.test.ts
src/tools/system/open_project.test.ts
src/tools/system/* (test harness imports)
src/tools/workflow/execute_step.ts
src/tools/workflow/workflow.test.ts
```

---

*End of report. Feed this file to another agent as the canonical three-stage quality brief.*
