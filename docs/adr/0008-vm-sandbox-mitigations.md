# ADR 0008 — `vm` Sandbox Residual Risk and Required Mitigations

* **Status**: Accepted
* **Deciders**: Engineering (remediation track R0)
* **Date**: 2026-07-11
* **Does not supersede**: ADR 0001 (still `vm` for v1)
* **Relates to**: audit finding S6; PRD §4.7 / §9; `src/tools/process/run_script.ts`

## Context

ADR 0001 chose Node’s built-in `vm` module and acknowledged it is **not a security sandbox** (prototype escapes such as `this.constructor.constructor('return process')()`). It required:

* Gating every bound capability
* Using `vm` `timeout` to limit runaway scripts

Shipped `run_script` does **not** pass `timeout`, exposes the host `console`, and does not freeze the sandbox object. ADR 0001’s claim that escape is mitigated because “gated handlers still apply” is **false** for a full process escape: escape yields direct `fs` / `child_process`, bypassing the gate.

## Decision

1. **Keep `vm` for v1** (ADR 0001 stands) for portability.
2. **Stop calling it a security boundary** in README/PRD marketing. Residual escape risk is accepted for local single-user threat model **only if** mitigations below ship.
3. **Required mitigations (Phase R2)**:
   * Pass a `timeout` (default e.g. 5000ms; optional capped `timeoutMs` input).
   * Replace host `console` with an in-sandbox buffer returned as `log: string[]`.
   * `Object.freeze` the sandbox object after construction.
   * Dedicated adversarial tests for known escape payloads (fail closed / assert no usable `process` / `require`).
4. **Optional future**: opt-in `isolated-vm` behind a separate ADR if portability trade-off is accepted.

## Consequences

* Phase R2 implements mitigations; Phase R6 documents residual risk honestly.
* PRD §9 open decision on `vm` vs `isolated-vm` is closed in favor of `vm` + mitigations for v1.
* Escape tests that cannot fully prevent escape must still document residual risk; release does not claim “sandbox escape impossible.”
