# Post-remediation quality scorecard (updated after security audit fixes)

**Date:** 2026-07-11  
**Plan:** `docs/plans/REMEDIATION_TO_90.md` + security audit follow-up  
**Package:** `2.1.0` (+ Unreleased hardening on branch)  
**Baseline (2026-07-11 audit):** ~52/100  
**Independent audit (pre-fix):** ~70/100  
**This pass (post security fixes):** ~86/100  

| Dimension | Pre-fix audit | Now | Evidence |
|---|---:|---:|---|
| Structure & conventions | 86 | **90** | ADRs incl. 0010 enforcement; AGENTS path fixed; engines; CI smoke |
| Logic / product contracts | 62 | **84** | Double-gate fixed; dispatcher Tier 2 consume; clarification answers; maxRetries cap; nonzero exit |
| Security | 58 | **86** | Redirect/$VAR escalate; git config demoted; ADR 0010 un-register; argv restore; rules cwd; scrubEnv |
| Testing | 74 | **88** | open_project, scrubEnv, adversarial gate expansions, failure contracts |
| Docs / honesty | 78 | **88** | CHANGELOG Unreleased; tool docs; ADR 0010 updated; scorecard revised |
| **Overall** | **70** | **86** | Residual: Node `vm` escapable (ADR 0008); soft coverage thresholds |

## Residual accepted risks

- **ADR 0008:** Node `vm` remains escapable in principle; not marketed as a hard sandbox.
- **Shell:true for Tier 0/1:** Still used for ad-hoc `run_command`; mitigated by meta escalation (redirect/env/chain). Prefer argv tools where possible.
- **Coverage thresholds:** Package averages; file-local gaps may remain.

## Verification commands

```bash
npm ci && npm run build && npm run lint && npm run typecheck
npm test && npm run test:adversarial && npm run coverage
npm run benchmark:v1
npm run format:check
./scripts/smoke-readme.sh
```
