# Capability: `list_capabilities` (Tier A)

Lists all available Tier B dispatcher capabilities matching query filters, preventing direct discovery of Tier A tools.

## Input Schema

```typescript
{
  query: z.string().optional().describe("Optional query string to search capability names and descriptions")
}
```

## Output Schema

```typescript
{
  success: boolean,
  matches: Array<{
    name: string,
    description: string,
    schema: any
  }>
}
```

## Failure Contract

- Standard handlers return empty matches array if query doesn't match any registered elements.
