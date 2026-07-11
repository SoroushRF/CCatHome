# Capability: `get_workflow_state` (Tier A)

Reads workflow/step state. Step views default to `summary`; pass `includeFullLog: true` for `fullLog`.

## Input Schema

```typescript
{ workflowId?: z.string(), stepId?: z.string(), includeFullLog?: z.boolean() }
```

## Output Schema

```typescript
{ success: boolean, workflow?: object, step?: object, workflows?: object[], error?: string, reason?: string }
```

## Failure Contract

- **`step_not_found`** / **`workflow_not_found`** / **`query_failed`**.

## Changelog

- 2026-07-11: Aligned with remediation R6 code/docs honesty pass.
