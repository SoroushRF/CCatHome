# Capability: `move_file` (Tier B)

Moves or renames a file or directory within the workspace.

## Input Schema

```typescript
{
  sourcePath: z.string().describe("The source path relative to the workspace root"),
  destinationPath: z.string().describe("The destination path relative to the workspace root")
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

- **`path_traversal_detected`**: If source or destination path escapes target workspace.
- **`file_not_found`**: If source path does not exist.
- **`move_failed`**: If renaming fails.
