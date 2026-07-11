# Capability: `kill_process` (Tier B)

SIGKILLs a tracked background process and updates `command_log` status to `killed`.

## Input Schema

```typescript
{ pid: z.number().int() }
```

## Output Schema

```typescript
{ success: boolean, error?: string, reason?: string }
```

## Failure Contract

- **`process_not_found`**, **`kill_failed`**.

## Changelog

- 2026-07-11: Aligned with remediation R6 code/docs honesty pass.
