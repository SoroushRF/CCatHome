# Capability: `recall` (Tier B)

FTS5 BM25 recall with LIKE fallback (escaped wildcards).

## Input Schema

```typescript
{ query: z.string(), limit?: z.number() }
```

## Output Schema

```typescript
{ success: boolean, memories?: Array<{ id: string, content: string, tags: string[], score: number }>, error?: string, reason?: string }
```

## Failure Contract

- Empty query → empty `memories`; DB errors structured.

## Changelog

- 2026-07-11: Aligned with remediation R6 code/docs honesty pass.
