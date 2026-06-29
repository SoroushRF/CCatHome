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

---

## Architectural Note on Self-Healing & Recovery

The `execute_step` auto-fix loop runs a **deterministic** retry sequence. If validation fails, it rolls back workspace changes, executes the `recoveryCommand` (if provided), and re-runs the `executionCommand`.

To execute dynamic code repair or intelligent self-healing based on compiler/test logs:
1. The calling agent client (e.g. LLM/Claude) is responsible for monitoring tool outputs.
2. If `execute_step` returns failure, the calling agent inspects the error logs, generates a target patch, and triggers a new `execute_step` call with a custom `recoveryCommand` containing the patch or repair action.
3. The internal engine loop does **not** generate code fixes dynamically; it acts as a robust state executor for the calling agent client's repair directives.
