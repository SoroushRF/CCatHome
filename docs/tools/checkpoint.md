# Capability: `checkpoint` (engine-internal)

Snapshots git HEAD + dirty/untracked files for restore. **Not registered** for
agent `invoke` / `list_capabilities` (ADR 0010). `execute_step` calls the
handler directly.

## Input Schema

```typescript
{ workflowStepId?: z.string() }
```

## Output Schema

```typescript
{ success: boolean, checkpointId?: string, gitSha?: string, error?: string, reason?: string }
```

## Failure Contract

- **`git_failed`**: `git rev-parse` / `git status` argv failed.
- **`checkpoint_failed`**: unexpected exception.

## Changelog

- 2026-07-11: Aligned with remediation R6 code/docs honesty pass.
- 2026-07-11: Un-registered from Tier B; uses `runArgvUngated`.
