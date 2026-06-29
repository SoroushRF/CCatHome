# Capability: `read_process_output` (Tier B)

Reads the recent tail stdout/stderr contents of a running process log.

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
  output?: string,
  status?: string,
  error?: string,
  reason?: string
}
```

## Failure Contract

- **`process_not_found`**: If target process log file does not exist.
