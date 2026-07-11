# CCatHome

Portable MCP TypeScript server that gives coding agents a gated execution layer:
workflow DAGs, checkpoints, permission-tiered shell/filesystem access, and HITL
approvals — without claiming hard sandbox isolation.

---

## Features

1. **DAG workflow engine** — `create_workflow` validates acyclic graphs; `execute_step` refuses unmet dependencies.
2. **Self-healing micro-loop** — caller-supplied `executionCommand` / `validationCommand` / optional `recoveryCommand`, with checkpoints, branch isolation (`ccathome/<workflowId>`), and `[ccathome-auto]` commits on success.
3. **Permission gate** — 4-tier classification (`permission-rules.json`); Tier 2 needs dashboard or `CCATHOME_APPROVAL_TOKEN`; Tier 3 blocked.
4. **VM script runner** — Node `vm` with timeout, frozen sandbox, and gated I/O. **Not a security boundary** (see ADR 0008); use alongside the gate and path containment.
5. **Local dashboard** — HTTP/SSE on port `3141` with a startup launch token; HITL approve/reject UI.

---

## Security Model

- **Path containment** — filesystem ops resolve realpaths under the workspace; sensitive paths (`.env`, `.git/hooks`, …) blocked.
- **Gate + chaining** — shell metacharacters escalate past safe Tier 0/1 prefixes; pipe-to-shell / `curl|…` patterns are Tier 3.
- **HITL** — agents cannot self-approve over MCP without `approvalToken`; approvals are single-use.
- **Dashboard auth** — HTML/SSE/API require `?token=` or cookie; unauthenticated → 401.
- **Residual risk** — Node `vm` can be escaped; treat as defense-in-depth only.

---

## Getting Started

### Prerequisites

- Node.js 18+
- Git

### Install & build

```bash
npm ci
npm run build
```

### Tests & lint

```bash
npm test
npm run lint
npm run typecheck
```

### Start the MCP server

```bash
npm start
# or during development:
npm run dev
```

Optional workspace root (argv or env):

```bash
npm start /path/to/workspace
# WORKSPACE_ROOT=/path/to/workspace npm start
```

On boot the server prints a dashboard URL with token, for example:

```text
Dashboard: http://localhost:3141/?token=<hex>
```

Open that URL to approve Tier 2 commands. For MCP-side approval mutations set:

```bash
export CCATHOME_APPROVAL_TOKEN='your-long-secret'
```

### MCP client sketch (Claude Code)

```json
{
  "mcpServers": {
    "ccathome": {
      "command": "node",
      "args": ["/absolute/path/to/CCatHome/dist/index.js", "/absolute/path/to/workspace"],
      "env": {
        "CCATHOME_APPROVAL_TOKEN": "your-long-secret"
      }
    }
  }
}
```

---

## Docs

- Product intent: [`PRD.md`](PRD.md) (v2.1)
- Remediation plan: [`docs/plans/REMEDIATION_TO_90.md`](docs/plans/REMEDIATION_TO_90.md)
- Tool contracts: [`docs/tools/`](docs/tools/)
- ADRs: [`docs/adr/`](docs/adr/)

---

## License

MIT — see [LICENSE](LICENSE).
