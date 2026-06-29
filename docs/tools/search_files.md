# Capability: `search_files` (Tier A)

Searches for files matching a textual query or regex pattern within the workspace.

## Input Schema

```typescript
{
  query: z.string().describe("The search query or regex pattern to look for"),
  extension: z.string().optional().describe("Optional file extension to restrict search (e.g. '.ts')")
}
```

## Output Schema

```typescript
{
  success: boolean,
  results?: Array<{
    path: string,
    line: number,
    text: string
  }>,
  error?: string,
  reason?: string
}
```

## Failure Contract

- **`search_failed`**: If directory traversal or pattern matching throws an error.
