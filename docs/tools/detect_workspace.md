# Capability: `detect_workspace` (Tier A)

Detects project metadata; optional `path` retargets workspace under policy (ADR 0004).

## Input Schema

```typescript
{ path?: z.string() }
```

## Output Schema

```typescript
{ success: boolean, language?: string, runtime?: string, packageManager?: string, entryPoints?: string[], dependencies?: any, error?: string, reason?: string }
```

## Failure Contract

- Retarget rejected outside allowlist / initial tree without confirmation path (`workspace-retarget` errors).

## Changelog

- 2026-07-11: Aligned with remediation R6 code/docs honesty pass.
