# Capability: `read_file` (Tier A)

Reads a workspace file. Files over ~300 lines return an outline + `fileId` instead of full content.

## Input Schema

```typescript
{ path: z.string() }
```

## Output Schema

```typescript
{
  success: boolean,
  content?: string,
  outline?: string,
  totalLines?: number,
  fileId?: string,
  truncated?: boolean,
  error?: string,
  reason?: string
}
```

## Failure Contract

- **`invalid_path`**: Path escapes workspace / resolve failure.
- **`file_not_found`**: Missing file.
- **`read_failed`**: I/O error.

## Changelog

- 2026-07-11: Aligned with remediation R6 code/docs honesty pass.
