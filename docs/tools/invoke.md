# Capability: `invoke` (Tier B)

Routes capability execution requests to registered Tier B capability handlers, validating schemas and suggesting matches for typos.

## Input Schema

```typescript
{
  capability: z.string().describe("The name of the Tier B capability to invoke"),
  arguments: z.any().describe("The arguments object to pass to the capability")
}
```

## Output Schema

```typescript
{
  success: boolean,
  result?: any,
  error?: string,
  reason?: string
}
```

## Failure Contract

- **`capability_not_found`**: If no Tier B capability exists with matching name. Includes typo suggestions in the reason message if any close match exists.
- **`validation_failed`**: If arguments do not conform to capability input schema.
- **`forbidden_invocation`**: If attempting to direct-invoke a Tier A registered capability.
