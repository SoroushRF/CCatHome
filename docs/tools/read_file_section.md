# Capability: `read_file_section` (Tier B)

Reads a line range from a workspace file.

## Input Schema

```typescript
{ path: z.string(), start: z.number(), end: z.number() }
```

## Output Schema

```typescript
{ success: boolean, lines?: string[], error?: string, reason?: string }
```

## Failure Contract

- **`invalid_path`**, **`file_not_found`**, range errors via `reason`.

## Changelog

- 2026-07-11: Aligned with remediation R6 code/docs honesty pass.
