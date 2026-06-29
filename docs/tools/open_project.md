# Capability: `open_project` (Tier A)

Opens a target project directory, dynamically switching the active workspace root to the specified path and performing initial project structure discovery.

## Input Schema

```typescript
{
  path: z.string().describe("The absolute path of the local project directory to open")
}
```

## Output Schema

```typescript
{
  success: boolean,
  message?: string,
  projectInfo?: {
    language: string,
    runtime: string,
    packageManager: string,
    entryPoints: string[],
    dependencies: Record<string, string>
  },
  error?: string,
  reason?: string
}
```

## Failure Contract

- **`directory_not_found`**: If the target directory does not exist.
- **`not_a_directory`**: If the specified target path resolves to a file instead of a directory.
