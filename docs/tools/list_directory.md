# Capability: `list_directory` (Tier B)

Lists directory entries.

## Input Schema

```typescript
{ path?: z.string() }
```

## Output Schema

```typescript
{ success: boolean, items?: Array<{ name: string, type: string }>, error?: string, reason?: string }
```

## Failure Contract

- **`invalid_path`** / listing failures.

## Changelog

- 2026-07-11: Aligned with remediation R6 code/docs honesty pass.
