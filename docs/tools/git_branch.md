# Capability: `git_branch` (Tier B)

Creates a new git branch or lists active branches in the repository.

## Input Schema

```typescript
{
  name: z.string().optional().describe("Optional branch name to create. If omitted, lists branches")
}
```

## Output Schema

```typescript
{
  success: boolean,
  branches?: string[],
  error?: string,
  reason?: string
}
```

## Failure Contract

- **`git_branch_failed`**: If running git branch fails.
