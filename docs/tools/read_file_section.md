# Capability: `read_file_section` (Tier A)

Reads a specific line range section of a file located within the workspace.

## Input Schema

```typescript
{
  path: z.string().describe("The path of the file to read relative to the workspace root"),
  startLine: z.number().describe("The starting line number, 1-indexed (inclusive)"),
  endLine: z.number().describe("The ending line number, 1-indexed (inclusive)")
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
- **`invalid_line_range`**: If startLine/endLine are out of bounds or invalid.
