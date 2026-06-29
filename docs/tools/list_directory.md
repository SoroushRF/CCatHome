# Capability: `list_directory` (Tier B)

Lists files and subdirectories located within a target folder.

## Input Schema

```typescript
{
  path: z.string().default("").describe("The path of the directory to list relative to the workspace root")
}
```

## Output Schema

```typescript
{
  success: boolean,
  entries?: Array<{
    name: string,
    isDirectory: boolean,
    size?: number
  }>,
  error?: string,
  reason?: string
}
```

## Failure Contract

- **`path_traversal_detected`**: If target path resolves outside workspace root.
- **`directory_not_found`**: If the target directory does not exist or is a file.
