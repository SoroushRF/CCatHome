# Capability: `detect_workspace` (Tier A)

Orientates the agent layout by scanning for standard patterns (e.g. Node files, Python projects, Git configuration) inside the workspace root.

## Input Schema

```typescript
{}
```

## Output Schema

```typescript
{
  success: boolean,
  hasGit: boolean,
  hasNode: boolean,
  packageJsonPresent: boolean,
  hasPython: boolean,
  mainFiles: string[],
  error?: string,
  reason?: string
}
```

## Failure Contract

- Standard filesystem scan failures return success false with scan description.
