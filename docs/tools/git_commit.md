# Capability: `git_commit` (Tier B)

Creates a Git commit with the specified commit message.

## Input Schema

```typescript
{
  message: z.string().describe("The commit message")
}
```

## Output Schema

```typescript
{
  success: boolean,
  sha?: string,
  error?: string,
  reason?: string
}
```

## Failure Contract

- **`git_commit_failed`**: If committing staged changes fails.
