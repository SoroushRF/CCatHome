# Capability: `apply_patch` (Tier A)

Applies a unified diff with backup + atomic temp rename.

## Input Schema

```typescript
{ path: z.string(), patch: z.string(), expectedSha?: z.string() }
```

## Output Schema

```typescript
{ success: boolean, appliedHunks?: number, newSha?: string, currentSha?: string, error?: string, reason?: string }
```

## Failure Contract

- **`invalid_path`**: Path containment failure.
- **`sensitive_path_blocked`**: `.env`, `.git/hooks`, etc.
- **`sha_mismatch`**: `expectedSha` does not match current content.
- **`patch_failed`**: Hunks do not apply; target untouched.
- **`backup_failed`** / **`write_failed`**: Backup or rename errors.

## Changelog

- 2026-07-11: Aligned with remediation R6 code/docs honesty pass.
