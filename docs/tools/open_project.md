# Capability: `open_project` (Tier A)

Retargets `config.workspaceRoot` to an existing directory under allowlist /
initial-tree policy (ADR 0004). Leaving the initial tree requires Tier 2
confirmation via synthetic command `open_project <realpath>`.

## Input Schema

```typescript
{ path: z.string() }
```

## Output Schema

```typescript
{ success: boolean, message?: string, projectInfo?: object, error?: string, reason?: string }
```

## Failure Contract

- **`directory_not_found`**: path does not exist.
- **`not_a_directory`**: path is a file.
- **`realpath_failed`**: cannot resolve real path.
- **`requires_confirmation`**: outside allowed tree and no Tier 2 approval.
- **`permission_denied`**: gate returns Tier 3.

Allowlist: set `CCATHOME_WORKSPACE_ALLOWLIST` to colon-separated absolute prefixes.

## Changelog

- 2026-07-11: Aligned with remediation R6 code/docs honesty pass.
- 2026-07-11: Documented full failure modes; tests added.
