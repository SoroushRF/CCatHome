# Capability: `git_checkout` (Tier B)

Switches branches or restores workspace files via Git checkout.

## Input Schema

```typescript
{
  target: z.string().describe("The branch name or path to checkout")
}
```

## Output Schema

```typescript
{
  success: boolean,
  error?: string,
  reason?: string
}
```

## Failure Contract

- **`git_checkout_failed`**: If target switch fails.
- **`requires_confirmation`**: If target checkout involves file discarding (`git checkout -- .` or `git checkout .`) under Tier 2.
