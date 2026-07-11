# Capability: `read_process_output` (Tier B)

Tails a tracked background process log.

## Input Schema

```typescript
{ pid: z.number(), fromLine?: z.number() }
```

## Output Schema

```typescript
{ success: boolean, lines?: string[], nextLineOffset?: number, error?: string, reason?: string }
```

## Failure Contract

- **`process_not_found`** when pid is not tracked.

## Changelog

- 2026-07-11: Aligned with remediation R6 code/docs honesty pass.
