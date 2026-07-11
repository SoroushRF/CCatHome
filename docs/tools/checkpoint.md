# Capability: `checkpoint` (Tier B)

Snapshots git HEAD + dirty/untracked files (including directories) for restore.

## Input Schema

```typescript
{ workflowStepId?: z.string() }
```

## Output Schema

```typescript
{ success: boolean, checkpointId?: string, gitSha?: string, error?: string, reason?: string }
```

## Failure Contract

- **`git_failed`**, **`checkpoint_failed`**.

## Changelog

- 2026-07-11: Aligned with remediation R6 code/docs honesty pass.
