# Capability: `expand_log` (Tier B)

Reads a command/step log by hex `logId` under `.ccathome/logs/`.

## Input Schema

```typescript
{ logId: z.string() }
```

## Output Schema

```typescript
{ success: boolean, content?: string, error?: string, reason?: string }
```

## Failure Contract

- Non-hex `logId` rejected; path must resolve via `resolveSafePath`.

## Changelog

- 2026-07-11: Aligned with remediation R6 code/docs honesty pass.
