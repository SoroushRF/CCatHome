# Capability: `run_command` (Tier A)

Runs an ad-hoc shell command through the Permission Gate. Persists `command_log` and returns `logId` on exited/ready/timeout paths.

## Input Schema

```typescript
{ command: z.string(), timeoutMs?: z.number(), readinessPattern?: z.string() }
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

- **`requires_confirmation`**: Tier 2 command not approved.
- **`permission_denied`**: Tier 3.
- **`invalid_readiness_pattern`**: Pattern too long.
- **`log_setup_failed`** / **`spawn_failed`**: Setup/spawn errors.

## Changelog

- 2026-07-11: Aligned with remediation R6 code/docs honesty pass.
