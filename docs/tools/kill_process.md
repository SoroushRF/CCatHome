# Capability: `kill_process` (Tier B)

Terminates a running background process.

## Input Schema

```typescript
{
  pid: z.number().describe("The process PID to terminate")
}
```

## Output Schema

```typescript
{
  success: boolean,
  error?: string,
  reason?: string
}
```

## Failure Contract

- **`process_not_found`**: If no process exists with the matching PID.
- **`kill_failed`**: If terminating the process fails.
