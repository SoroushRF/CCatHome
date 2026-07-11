# Capability: `git_commit` (Tier B)

Commits staged files; rejects amending auto-commits.

## Input Schema

```typescript
{ message: z.string(), amend?: z.boolean() }
```

## Output Schema

```typescript
{ success: boolean, sha?: string, error?: string, reason?: string }
```

## Failure Contract

- **`amend_conflicts_with_autocommit`**, **`git_commit_failed`**, **`execution_failed`**.

## Changelog

- 2026-07-11: Aligned with remediation R6 code/docs honesty pass.
