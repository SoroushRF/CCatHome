# Capability: `git_diff` (Tier B)

Returns uncommitted diff (`--no-pager` argv; Tier-0 display command).

## Input Schema

```typescript
{ staged?: z.boolean() }
```

## Output Schema

```typescript
{ success: boolean, diff?: string, error?: string, reason?: string }
```

## Failure Contract

- **`git_diff_failed`**, **`execution_failed`**.

## Changelog

- 2026-07-11: Aligned with remediation R6 code/docs honesty pass.
