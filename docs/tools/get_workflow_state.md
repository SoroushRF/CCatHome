# Capability: `get_workflow_state` (Tier B)

Fetches the execution status and history of steps in a workflow.

## Input Schema

```typescript
{
  workflowId: z.string().describe("The ID of the workflow")
}
```

## Output Schema

```typescript
{
  success: boolean,
  workflow?: {
    id: string,
    name: string,
    status: string
  },
  steps?: Array<{
    id: string,
    title: string,
    status: string,
    retryCount: number,
    dependsOn: string[]
  }>,
  error?: string,
  reason?: string
}
```

## Failure Contract

- **`workflow_not_found`**: If the workflow ID does not exist in the database.
