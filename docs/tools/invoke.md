# Capability: `invoke` (Tier A)

Invokes a dispatcher-routed (Tier B) capability by name.

## Input Schema

```typescript
{
  capability: z.string(),
  args: z.record(z.any())
}
```

## Output Schema

```typescript
{
  success: boolean,
  result?: any,
  error?: string,
  suggestion?: string,
  confirmationId?: string,
  tier?: number
}
```

## Failure Contract

- **`unknown_capability`**: Unknown name; optional `suggestion` closest match.
- **`validation_failed`**: Args fail the target capability Zod schema.
- **`requires_confirmation`**: Target is Tier 2; pending confirmation may be created.
- **`permission_denied`**: Tier 3 blocked.

## Changelog

- 2026-07-11: Aligned with remediation R6 code/docs honesty pass.
