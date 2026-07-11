# Capability: `git_branch` (Tier B)

Create or list branches via argv `runGit`.

## Input Schema

```typescript
{ name?: z.string(), list?: z.boolean() }
```

## Output Schema

```typescript
{ success: boolean, branches?: string[], error?: string, reason?: string }
```

## Failure Contract

- Invalid refs / git failures as structured errors.

## Changelog

- 2026-07-11: Aligned with remediation R6 code/docs honesty pass.
