# Capability: `open_project` (Tier A)

Retargets `config.workspaceRoot` to an existing directory under allowlist / initial-tree policy (ADR 0004). Leaving the initial tree requires Tier 2 confirmation.

## Input Schema

```typescript
{ path: z.string() }
```

## Output Schema

```typescript
{ success: boolean, message?: string, projectInfo?: object, error?: string, reason?: string }
```

## Failure Contract

- Path must exist and resolve under policy; otherwise error/reason from workspace-retarget helper.

## Changelog

- 2026-07-11: Aligned with remediation R6 code/docs honesty pass.
