# Capability: `apply_patch` (Tier A)

Applies standard unified diff format patches atomic-style (copy-on-write) to target files in workspace.

## Input Schema

```typescript
{
  filePath: z.string().describe("The workspace path of the file to patch"),
  patchContent: z.string().describe("The unified diff formatted patch content to apply"),
  expectedSha: z.string().optional().describe("Optional expected current Git SHA to verify consistency")
}
```

## Output Schema

```typescript
{
  success: boolean,
  hunksApplied: number,
  newSha?: string,
  error?: string,
  reason?: string
}
```

## Failure Contract

- **`path_traversal_detected`**: If file path escapes target workspace.
- **`sha_mismatch`**: If the target workspace current SHA doesn't match the expected SHA.
- **`patch_failed`**: If patch hunks fail to match original file content cleanly.
