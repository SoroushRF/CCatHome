# Capability: `search_files` (Tier B)

Workspace content search.

## Input Schema

```typescript
{ query: z.string() }
```

## Output Schema

```typescript
{ success: boolean, matches?: Array<{ path: string, content?: string }>, error?: string, reason?: string }
```

## Failure Contract

- Path / I/O errors as structured `error`/`reason`.

## Changelog

- 2026-07-11: Aligned with remediation R6 code/docs honesty pass.
