# CCatHome

`CCatHome` is a highly secure, portable, multi-step agentic execution engine that implements the Model Context Protocol (MCP). It allows LLMs to run commands, apply patches, track workflows, manage memory, and self-heal from failures within a sandboxed local environment.

---

## Features

1. **Topological DAG Workflow Engine**: Schedules and runs workflow steps in topological order with cycle detection.
2. **Gated Self-Healing Loop**: The `execute_step` capability utilizes copy-on-write checkpoints and Git reverts to recover workspace states and attempt auto-fixes on compilation/test failures.
3. **VM Script Sandbox**: Executes ad-hoc scripts inside Node's native `vm` module. System calls (`runCommand`, `readFile`, `writeFile`) are routed back through the Permission Gate.
4. **4-Tier Permission Gate**: Command classification prevents execution of blocked scripts (Tier 3) or requests explicit confirmation (Tier 2) using database state persistence.
5. **Real-time SSE Dashboard**: Zero-dependency local web server on port `3141` streaming real-time workflow statuses, console log streams, checkpoints, and active background processes.

---

## Security Model

CCatHome implements strict path containment and execution gating:
- **Workspace Isolation**: Filesystem operations resolve target realpaths via `fs.realpathSync`, catching symlink traversal escape attempts.
- **Unanchored Gating**: Intercepts command chaining bypasses (e.g. `npm install && rm -rf /`) at the central gate.
- **Dashboard Authorization**: Serves HTTP pages and Server-Sent Event (SSE) streams only when authenticated with a secure launch token or cookie.

---

## Getting Started

### Prerequisites

- Node.js 18+
- Git

### Installation

```bash
npm install
```

### Build

```bash
npm run build
```

### Running Tests

```bash
npm run test
```

### Starting the Server

```bash
npm run dev
```

---

## License

This project is licensed under the terms of the MIT License. See the [LICENSE](LICENSE) file for details.
