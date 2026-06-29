# Capability: `run_command` (Tier A)

Runs ad-hoc shell commands, capturing outputs and handling long-running background processes.

## Input Schema

```typescript
{
  command: z.string().describe("The shell command to execute"),
  timeoutMs: z.number().optional().describe("Timeout in milliseconds before considering it a background process (default 10000)"),
  readinessPattern: z.string().optional().describe("Optional regex pattern. If matched in stdout, the command returns immediately with status 'ready'")
}
```

## Output Schema

```typescript
{
  success: boolean,
  stdout?: string,
  stderr?: string,
  exitCode?: number,
  logId?: string,
  pid?: number,
  status?: "ready" | "timeout" | "exited",
  logPath?: string,
  recentOutput?: string,
  error?: string,
  reason?: string
}
```

## Failure Contract

- **`permission_denied`**: If command matches Tier 3 patterns (blocked).
- **`requires_confirmation`**: If command matches Tier 2 patterns (requires approval).
- **`log_setup_failed`**: If logs directory creation fails.
- **`spawn_failed`**: If child process spawn throws an error.
