# Capability: `run_script` (Tier A)

Runs JavaScript in Node `vm` with gated bound I/O. **Not a hard security boundary** (ADR 0008).

## Input Schema

```typescript
{
  code: z.string(),
  timeoutMs?: z.number().int().positive().max(60000) // default 5000
}
```

## Output Schema

```typescript
{ success: boolean, result?: any, log?: string[], error?: string, reason?: string }
```

## Failure Contract

- **`script_execution_failed`**: Timeout, throw, or VM error (`reason` message). Bound gate denials surface as thrown errors caught into this code.
- `log` is capped (max 200 entries).

## Changelog

- 2026-07-11: Aligned with remediation R6 code/docs honesty pass.
