# Capability: `checkpoint` (Tier B)

Registers a snapshot checkpoint of the current repository Git SHA state and uncommitted/untracked files.

## Input Schema

```typescript
{
  workflowStepId: z.string().describe("The active workflow step ID to associate with the checkpoint")
}
```

## Output Schema

```typescript
{
  success: boolean,
  checkpointId?: string,
  gitSha?: string,
  error?: string,
  reason?: string
}
```

## Failure Contract

- **`git_check_failed`**: If checking repository git state throws an error.
- **`backup_failed`**: If backing up uncommitted files fails.
