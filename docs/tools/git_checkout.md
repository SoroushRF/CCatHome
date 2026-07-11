# Capability: `git_checkout` (Tier B)

Checks out or creates a branch (safe ref validation).

## Input Schema

```typescript
{ branch: z.string(), create?: z.boolean() }
```

## Output Schema

```typescript
{ success: boolean, error?: string, reason?: string }
```

## Failure Contract

- Unsafe ref characters rejected; git failures structured.

## Changelog

- 2026-07-11: Aligned with remediation R6 code/docs honesty pass.
