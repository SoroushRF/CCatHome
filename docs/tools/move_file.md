# Capability: `move_file` (Tier B)

Moves/renames within the workspace; blocks sensitive destinations.

## Input Schema

```typescript
{ source: z.string(), destination: z.string() }
```

## Output Schema

```typescript
{ success: boolean, error?: string, reason?: string }
```

## Failure Contract

- **`invalid_path`**, **`sensitive_path_blocked`**, missing source.

## Changelog

- 2026-07-11: Aligned with remediation R6 code/docs honesty pass.
