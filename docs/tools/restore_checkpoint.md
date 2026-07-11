# Capability: `restore_checkpoint` (Tier B)

Hard-resets to checkpoint SHA and restores backups (ADR 0010 ungated reset).

## Input Schema

```typescript
{ checkpointId: z.string() }
```

## Output Schema

```typescript
{ success: boolean, error?: string, reason?: string }
```

## Failure Contract

- **`checkpoint_not_found`**, **`git_reset_failed`**, **`git_clean_failed`**, **`backup_missing`**, **`restore_failed`**.

## Changelog

- 2026-07-11: Aligned with remediation R6 code/docs honesty pass.
