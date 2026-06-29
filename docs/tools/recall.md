# Capability: `recall` (Tier B)

Queries the persistent memory store utilizing BM25 text ranking over SQLite FTS5 search index.

## Input Schema

```typescript
{
  query: z.string().describe("The text search query to locate related project memories"),
  category: z.string().optional().describe("Optional category to filter results")
}
```

## Output Schema

```typescript
{
  success: boolean,
  memories?: Array<{
    id: string,
    key: string,
    value: string,
    category: string,
    createdAt: string
  }>,
  error?: string,
  reason?: string
}
```

## Failure Contract

- Standard search failures return empty memories list.
