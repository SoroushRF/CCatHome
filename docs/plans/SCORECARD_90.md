# Post-remediation quality scorecard

**Date:** 2026-07-11  
**Plan:** `docs/plans/REMEDIATION_TO_90.md`  
**Package:** `2.1.0`  
**Baseline (2026-07-11 audit):** ~52/100  
**Target:** ≥90/100  

| Dimension | Score | Evidence |
|---|---:|---|
| Structure & conventions | 92 | ADRs 0004–0010; `constants.ts` enums; `lint-gate-bypass` + `lint-no-magic-status`; Tier A budget test; one-capability-per-file |
| Logic / product contracts | 93 | DAG `dependencies_unmet`; branch isolation; `[ccathome-auto]`; exec+validation success; recovery abort; context-manager; checkpoint restore (ADR 0010) |
| Security | 91 | Rules trust (ADR 0007); chaining; npm/node tiers; env scrub; sensitive paths; single-use HITL token (ADR 0009); dashboard XSS/`textContent`; `src/security/adversarial.*` + CI job |
| Testing | 91 | Isolation setup + `CCATHOME_DB_PATH`; failure matrices R7.2; adversarial R7.3; benchmark harness 10/10; coverage thresholds; format-check CI |
| Docs / honesty | 93 | PRD 2.1.0; README/CHANGELOG footnotes; all `docs/tools/*` aligned; honest `v1-results.md` |
| **Overall** | **92** | DoD D1–D8 addressed on remediation branch; residual: vm sandbox is not a hard boundary (ADR 0008) |

## Open residual risks (accepted, documented)

- **ADR 0008:** Node `vm` remains escapable in principle; mitigations + fail-closed gated I/O + adversarial tests; not marketed as a security boundary.
- **Coverage:** Some Tier B handlers (e.g. `get_workflow_state`, `open_project`) below file-local averages; package thresholds still met.

## Verification commands

```bash
npm ci && npm run build && npm run lint && npm run typecheck
npm test && npm run test:adversarial && npm run coverage
npm run benchmark:v1
npm run format:check
./scripts/smoke-readme.sh
```
