# Capability: `create_workflow` (Tier B)

Creates a multi-step workflow in the database state runner.

## Input Schema

```typescript
{
  name: z.string().describe("The human-readable name of the workflow"),
  steps: z.array(z.object({
    id: z.string().describe("The unique ID of the step"),
    title: z.string().describe("The descriptive title of the step"),
    depends_on: z.array(z.string()).optional().describe("Optional list of step dependencies")
  })).describe("The steps making up the DAG workflow")
}
```

## Output Schema

```typescript
{
  success: boolean,
  workflowId?: string,
  error?: string,
  reason?: string
}
```

## Failure Contract

- **`cyclic_dependency`**: If the steps contain circular dependencies and cannot form a valid DAG.
- **`step_creation_failed`**: If database insertion fails.
