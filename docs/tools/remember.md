# Capability: `remember` (Tier B)

Stores a key project detail or instruction in the persistent memory store with keyword indices.

## Input Schema

```typescript
{
  key: z.string().describe("The memory key descriptor"),
  value: z.string().describe("The text content value to store"),
  category: z.string().default("general").describe("Optional category to group memories")
}
```

## Output Schema

```typescript
{
  success: boolean,
  memoryId?: string,
  error?: string,
  reason?: string
}
```

## Failure Contract

- **`storage_failed`**: If database write execution fails.
