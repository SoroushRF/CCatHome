# AGENTS.md — CCatHome

This document governs how work is done in this repository. It has two
purposes: (1) keep the repo at a standard of engineering maturity consistent
with a production codebase, not a prototype, and (2) codify repetitive
procedures so they are executed the same way every time, by a human or an
agent.

---

## Part 1 — Engineering Maturity & Repo Hygiene

### 1.1 Documentation Management

- **Source of truth hierarchy:** `PRD.md` (product intent) → `IMPLEMENTATION_PLAN.md`
  (phased delivery) → `docs/adr/*.md` (point-in-time technical decisions) →
  inline code comments (local rationale only). If a decision in code
  contradicts the PRD, the PRD is updated in the same PR — it is never
  left silently stale.
- **ADRs are mandatory, not optional**, for any decision that:
  - introduces a new external dependency,
  - changes a tool's input/output contract,
  - changes the security/permission model,
  - reverses a previous ADR.
  ADRs are numbered sequentially (`0001-`, `0002-`...), never renumbered
  or deleted. A superseded ADR is marked `Status: Superseded by 00NN`,
  not removed.
- **No undocumented tool.** Every Tier A and Tier B capability has its
  input schema, output schema, and failure contract documented in
  `docs/tools/<name>.md` before merge. A tool without this file does not
  ship.
- **README currency check.** Before any release tag, confirm the README's
  setup instructions actually work against a clean checkout. This is a
  release checklist item, not assumed.

### 1.2 Versioning

- **Semantic versioning** for the server package itself (`major.minor.patch`).
  - `major`: breaking tool contract change (input/output shape, removed
    capability).
  - `minor`: new capability added, non-breaking enhancement.
  - `patch`: bug fix, no contract change.
- **PRD/Plan versioning is independent of code versioning.** The PRD has
  its own version number and changelog (see PRD §0.1 for the pattern to
  follow on every future revision). A code release does not imply a PRD
  revision and vice versa.
- **Database schema migrations are explicit and forward-only.** Every
  schema change ships as a numbered migration file in `db/migrations/`.
  Never edit a shipped migration after it has been merged — write a new
  one.
- **No silent breaking changes to tool schemas.** A breaking change to any
  Tier A or Tier B input/output shape requires: a major version bump, an
  entry in `CHANGELOG.md`, and a note in the relevant `docs/tools/<name>.md`
  file's own changelog section.

### 1.3 Code & Logic Clarity

- **One capability, one file.** Each capability implementation lives in
  its own file under `src/tools/<namespace>/<capability>.ts`. No file
  implements more than one capability, even when they're small.
- **No tool implementation bypasses the Permission Gate.** This is checked
  by `scripts/lint-gate-bypass.js` (wired into `npm run lint`), not just
  code review discipline — a capability file that calls `child_process` or
  filesystem write APIs directly, instead of through the gated execution
  helper, fails CI.
- **Failure paths are written before success paths get reviewed.** A PR
  implementing a new capability is not approved until its failure
  contract (PRD §4.1-style: what does the *caller* get back on every
  failure mode) is both implemented and tested.
- **No magic strings for tiers, statuses, or capability names.** These are
  enums/constants defined once, imported everywhere. A literal string
  like `"completed"` appearing outside the constants file is a lint
  violation. Enforced by `scripts/lint-no-magic-status.js` (wired into
  `npm run lint`).

### 1.4 Repo Hygiene (General)

- **Every PR is scoped to one phase-plan step or one ADR.** PRs that mix
  unrelated changes (e.g., a new capability + an unrelated refactor) are
  split before review.
- **CI must be green before merge, with no exceptions.** No "merge now,
  fix CI later."
- **Dead code is deleted, not commented out.** Git history is the
  changelog; commented-out blocks are not.
- **Dependencies are reviewed before being added**, not after. Adding any
  new package requires a one-line justification in the PR description:
  what it's for, and why an existing dependency or a small amount of
  in-house code wasn't sufficient.
- **No secrets, tokens, or local paths committed**, ever, including in
  test fixtures. `scripts/lint-no-secrets.js` (via `npm run lint` / CI)
  scans for common patterns. Husky is intentionally not required — CI
  lint is the enforced gate; review catches what the scan misses.

---

## Part 2 — Repetitive Task Rules

These are the standing procedures for recurring categories of work on
this project. Follow them exactly; do not improvise a variant per task
unless the rule itself is being revised (in which case, revise the rule
here, in the same PR).

### 2.1 Adding a new Tier A (directly registered) tool

1. Confirm it meets the bar from PRD §5.1: high call frequency, session-anchor
   status, or flagship/must-be-discoverable capability. If it doesn't meet
   one of these, it belongs in Tier B — do not register it directly by
   default.
2. Write `docs/tools/<name>.md` first: input schema, output schema, every
   failure mode and its payload shape.
3. Implement behind the Permission Gate (no direct execution path).
4. Add the tool to the Tier A count check in CI (`TIER_A_BUDGET` in
   `src/index.test.ts` / `TIER_A_BUDGET` in `src/core/dispatcher.ts` — currently 12; see PRD §8).
5. Update `CHANGELOG.md` with a `minor` version bump.

### 2.2 Adding a new Tier B (dispatcher-routed) capability

1. Write the same `docs/tools/<name>.md` doc — Tier B capabilities are
   documented identically to Tier A; the only difference is the
   registration mechanism.
2. Add it to the capability registry consumed by `list_capabilities`.
3. Confirm in a test that `list_capabilities` surfaces it for at least one
   sensible query string.
4. No change to registered MCP tool count — verify the CI check from §1.2
   still passes unchanged.

### 2.3 Modifying the Permission Tier ruleset

1. Open an ADR if the change adds or removes an entire tier behavior (rare).
   For ordinary additions of new command patterns to existing tiers, an
   ADR is not required, but the PR description must state which tier the
   pattern is being added to and why.
2. Add the new pattern to `permission-rules.json` (or equivalent), never
   inline in code.
3. Add a unit test asserting the new pattern classifies correctly.
4. Default to Tier 2 (confirm) for any pattern with genuine ambiguity —
   never default to Tier 0/1 "to reduce friction." This is a one-way
   door: it is always easier to loosen a confirmed-safe pattern later
   than to recover from a default-allow mistake.

### 2.4 Investigating a failed benchmark task

1. Pull the full step log from SQLite (`workflow_steps.full_log`) for the
   failed run — do not rely on the truncated context-manager summary for
   debugging.
2. Classify the failure: (a) capability bug, (b) classifier
   misclassification, (c) auto-fix loop insufficiency, (d) benchmark task
   itself ambiguous/wrong.
3. File the fix as a normal PR following §2.1/§2.2/§2.3 as applicable.
   Do not patch the benchmark task definition to make a failing case pass
   unless category (d) is confirmed — and if so, the benchmark doc change
   is reviewed separately from the code fix.
4. Re-run the full benchmark suite, not just the one previously-failing
   task, before closing out.

### 2.5 Preparing a release

1. Confirm `CHANGELOG.md` is current for every merged PR since the last tag.
2. Run the README setup steps against a clean checkout (§1.1).
3. Run the full adversarial security suite (path containment, sandbox
   escape) — a release does not ship on a green feature-test run alone.
4. Tag using semver (§1.2). Major version bumps require a one-paragraph
   migration note even if only one tool contract changed.

### 2.6 Reviewing any PR touching `core/permission-gate.ts`

1. Mandatory second reviewer (`IMPLEMENTATION_PLAN.md` Cross-Phase
   Practices / `docs/plans/REMEDIATION_TO_90.md` §0.2) — this is a
   hard gate, not a suggestion, given the file's role as the single
   security chokepoint for the entire system.
2. Reviewer explicitly checks: does every new or modified execution path
   (including from inside `run_script`) still route through this file?
   This is checked by tracing the call graph, not by trusting the diff's
   framing.
