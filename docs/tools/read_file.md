# Capability: `read_file` (Tier A)

Reads the entire content of a file located within the workspace.

## Input Schema

```typescript
{
  path: z.string().describe("The path of the file to read relative to the workspace root")
}
```

## Output Schema

```typescript
{
  success: boolean,
  content?: string,
  error?: string,
  reason?: string
}
```

## Failure Contract

- **`path_traversal_detected`**: If target path resolves outside workspace root.
- **`file_not_found`**: If the target file does not exist.
- **`read_failed`**: If filesystem reading throws an system/permission error.
