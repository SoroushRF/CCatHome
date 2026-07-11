# Capability: `ask_user` (Tier A)

Clarification or permission HITL (ADR 0009). MCP mutations require `approvalToken === CCATHOME_APPROVAL_TOKEN`.

## Input Schema

```typescript
{
  type: z.enum(["clarification", "permission"]),
  question?: z.string(),
  options?: z.array(z.string()),
  command?: z.string(),
  risk?: z.string(),
  response?: z.string(), // "approved" | "rejected"
  approvalToken?: z.string()
}
```

## Output Schema

```typescript
{ success: boolean, response?: string, error?: string, reason?: string }
```

## Failure Contract

- **`missing_command`**: Permission type without command.
- **`approval_token_required`**: `response` without valid secret.
- **`invalid_response`**: Not approved/rejected.
- **`timeout`**: Poll exceeded 60s waiting for dashboard/secret resolution.

## Changelog

- 2026-07-11: Aligned with remediation R6 code/docs honesty pass.
