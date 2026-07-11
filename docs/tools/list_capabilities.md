# Capability: `list_capabilities` (Tier A)

Lists Tier B capabilities matching an optional query. Never includes Tier A names. Returns at most **5** matches (name-prefix preferred).

## Input Schema

```typescript
{ query?: z.string() }
```

## Output Schema

```typescript
{ matches: Array<{ name: string, description: string, schema: any }> }
```

## Failure Contract

- None beyond empty `matches` for non-matching queries.

## Changelog

- 2026-07-11: Aligned with remediation R6 code/docs honesty pass.
