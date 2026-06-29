# Capability: `ask_user` (Tier A)

Handles human clarification questions or approves pending Tier 2 gated permission execution checks.

## Input Schema

```typescript
{
  type: z.enum(["clarification", "permission"]).describe("The type of request: clarification or permission approval"),
  question: z.string().optional().describe("Clarification question for the user"),
  options: z.array(z.string()).optional().describe("Optional list of choices for clarification"),
  command: z.string().optional().describe("The Tier 2 command requiring confirmation"),
  risk: z.string().optional().describe("The associated risk description of running the command"),
  response: z.string().optional().describe("The user's response or approval ('approved' or 'rejected')")
}
```

## Output Schema

```typescript
{
  success: boolean,
  response?: string,
  error?: string,
  reason?: string
}
```

## Failure Contract

- **`missing_command`**: If command parameter is omitted on permission request checks.
- **`invalid_response`**: If response is not `'approved'` or `'rejected'`.
- **`no_pending_confirmation`**: If no matching pending confirmation request is located in database.
