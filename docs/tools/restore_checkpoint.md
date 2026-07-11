# Capability: `restore_checkpoint` (engine-internal)

Hard-resets to checkpoint SHA and restores backups via **argv ungated** git
(ADR 0010). **Not registered** for agent `invoke` / `list_capabilities`.
Only `execute_step` (and tests) call the handler directly.

## Input Schema

```typescript
{ checkpointId: z.string() }
```

## Output Schema

```typescript
{ success: boolean, error?: string, reason?: string }
```

## Failure Contract

- **`checkpoint_not_found`**: unknown id.
- **`invalid_git_sha`**: stored SHA fails `assertSafeGitRef`.
- **`git_reset_failed`** / **`git_clean_failed`**: git argv exit nonzero.
- **`backup_path_escape`**: `backupPath` fails `resolveSafePath`.
- **`backup_missing`**: backup file/dir absent.
- **`restore_failed`**: unexpected exception.

## Changelog

- 2026-07-11: Aligned with remediation R6 code/docs honesty pass.
- 2026-07-11: Un-registered from Tier B; argv ungated; path-contained backups.
