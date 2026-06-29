# Capability: `restore_checkpoint` (Tier B)

Restores the workspace git and file state to a previously saved checkpoint.

## Input Schema

```typescript
{
  checkpointId: z.string().describe("The ID of the checkpoint to restore")
}
```

## Output Schema

```typescript
{
  success: boolean,
  error?: string,
  reason?: string
}
```

## Failure Contract

- **`checkpoint_not_found`**: If the target checkpoint ID does not exist.
- **`git_reset_failed`**: If hard resetting to target SHA fails.
- **`git_clean_failed`**: If clearing untracked files fails.
