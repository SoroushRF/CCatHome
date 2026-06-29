# Capability: `git_diff` (Tier B)

Shows the uncommitted diff of files in the workspace.

## Input Schema

```typescript
{
  paths: z.array(z.string()).optional().describe("Optional path patterns to show diff for")
}
```

## Output Schema

```typescript
{
  success: boolean,
  diff?: string,
  error?: string,
  reason?: string
}
```

## Failure Contract

- **`git_diff_failed`**: If running git diff command fails.
