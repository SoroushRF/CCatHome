# Capability: `create_workflow` (Tier A)

Creates a DAG workflow; rejects cycles and duplicate step ids.

## Input Schema

```typescript
{ name: z.string(), steps: Array<{ id: string, title: string, depends_on?: string[] }> }
```

## Output Schema

```typescript
{ success: boolean, workflowId?: string, error?: string, reason?: string }
```

## Failure Contract

- **`invalid_workflow`**: Cycles, missing deps, or duplicate step ids (`reason` details).

## Changelog

- 2026-07-11: Aligned with remediation R6 code/docs honesty pass.
