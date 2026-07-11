# Capability: `remember` (Tier B)

Stores a memory (ADR 0006).

## Input Schema

```typescript
{ content: z.string(), tags?: z.array(z.string()) }
```

## Output Schema

```typescript
{ success: boolean, memoryId?: string, error?: string, reason?: string }
```

## Failure Contract

- Insert failures as `error`/`reason`.

## Changelog

- 2026-07-11: Aligned with remediation R6 code/docs honesty pass.
