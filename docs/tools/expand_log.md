# Capability: `expand_log` (Tier B)

Reads the full content of a background process log file.

## Input Schema

```typescript
{
  pid: z.number().describe("The PID of the background process")
}
```

## Output Schema

```typescript
{
  success: boolean,
  content?: string,
  error?: string,
  reason?: string
}
```

## Failure Contract

- **`process_not_found`**: If target process log file does not exist.
