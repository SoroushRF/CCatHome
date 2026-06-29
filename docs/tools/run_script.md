# Capability: `run_script` (Tier A)

Executes Javascript code inside Node's native sandboxed `vm` module context, routing resource accesses through the Permission Gate.

## Input Schema

```typescript
{
  code: z.string().describe("The Javascript code to execute in the sandboxed VM context")
}
```

## Output Schema

```typescript
{
  success: boolean,
  result?: any,
  error?: string,
  reason?: string
}
```

## Failure Contract

- **`script_execution_failed`**: If syntax checks or VM script execution throws error, or if sandbox `gated` calls violate Permission Gate rules.
