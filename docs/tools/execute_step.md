# Capability: `execute_step` (Tier A)

Executes a workflow step using an auto-fix micro-loop with checkpointing, validation, and recovery commands.

## Input Schema

```typescript
{
  workflowId: z.string().describe("The ID of the workflow"),
  stepId: z.string().describe("The ID of the step to execute"),
  executionCommand: z.string().describe("The command to run to execute the step"),
  validationCommand: z.string().describe("The command to run to validate if the step succeeded"),
  maxRetries: z.number().default(3).describe("Maximum number of retry/recovery attempts"),
  recoveryCommand: z.string().optional().describe("Optional recovery command to run after restoring checkpoint and before retrying")
}
```

## Output Schema

```typescript
{
  success: boolean,
  status?: "completed" | "failed" | "requires_confirmation",
  retryCount?: number,
  error?: string,
  reason?: string
}
```

## Failure Contract

- **`step_not_found`**: If the specified step ID does not exist in the workflow.
- **`requires_confirmation`**: If execution/validation/recovery commands trigger confirmation pause.
- Returns `{ success: false, status: "failed" }` if validation fails after all retry attempts are exhausted.
