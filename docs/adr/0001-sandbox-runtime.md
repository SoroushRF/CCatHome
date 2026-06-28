# ADR 0001: Sandbox Runtime Selection (`vm` vs `isolated-vm`)

* **Status**: Accepted
* **Deciders**: Soroush, Engineering Review
* **Date**: 2026-06-28

## Context

The `run_script(code: string)` capability allows the agent to execute arbitrary JavaScript code to coordinate complex workflows (e.g., parsing files, custom validations, looping logic) directly on the server side without making multiple round-trips. However, executing arbitrary code poses a significant security risk if the script runner can bypass the Permission Gate and execute system commands or access unauthorized filesystem paths directly.

We need to choose a JavaScript runtime/sandboxing solution. The two primary candidates are:
1. **Node.js Built-in `vm` Module**: Allows compiling and running code within a V8 Context.
2. **`isolated-vm` NPM Package**: A library that runs code in separate V8 Isolates.

## Decision Drivers

* **Portability and Ease of Setup**: The project must run locally on developer machines across macOS, Linux, and Windows without requiring complex C++ build toolchains (like Python, Visual Studio Build Tools, or gcc) to install.
* **Security & Sandboxing**: The runtime must not allow scripts to easily access the outer Node process or bypass the Permission Gate.
* **Resource Control**: The runtime should ideally allow timing out or restricting memory usage to prevent CPU starvation.

## Options Considered

### Option 1: Node.js Built-in `vm` Module

* **Pros**:
  * Included out of the box in Node.js. Zero external dependencies, meaning zero installation or compilation failures on Windows.
  * Very lightweight and fast.
  * Simple API for exposing gated helper functions (`readFile`, `runCommand`, etc.) into the context.
* **Cons**:
  * **Not a security sandbox**: Code running in a `vm` context can escape to the main process via prototype chain traversal (e.g., `this.constructor.constructor('return process')()`).
  * Runs on the main V8 thread, meaning infinite loops block the server process (unless managed via `timeout` options, which only partially protect against CPU lockups).

### Option 2: `isolated-vm` Package

* **Pros**:
  * Highly secure. Runs code in a completely separate V8 isolate with its own memory heap and thread.
  * Robust protection against sandbox escape.
  * Native support for strict memory limits, execution time limits, and CPU interrupts.
* **Cons**:
  * **Native C++ dependency**: Requires compilation via `node-gyp`. Frequently fails to compile on Windows machines lacking C++ build tools, creating significant setup friction.
  * More complex serialization when marshalling values across the boundary.

## Trade-off Analysis & Mitigation

Because `CCatHome` is a local developer tool that runs on the user's local machine with their explicit permissions, the threat model differs from a hosted multi-tenant platform:
1. The user drives the agent, and the agent runs commands on behalf of the user.
2. The agent is already allowed to run shell commands (gated by user approval).
3. The main security boundary is preventing the LLM from executing malicious commands *without the user realizing it* (e.g., path traversal or unauthorized commands).

The critical mitigation is **individual capability gating**:
* Every function exposed to the sandbox (like `runCommand`, `writeFile`) is NOT a direct wrapper to a syscall. Instead, it routes through the central `classifyAndGate(command)` function of the **Permission Tier Gate**.
* Even if a script escapes the `vm` context and gets access to the outer Node process, the core MCP server will still route any execution through the same gated handlers.
* We will use the `vm` module's `timeout` option to prevent basic infinite loops.

## Decision

We decide to use **Option 1: Node.js Built-in `vm` Module** for the sandbox runtime in v1.

### Rationale
Using the built-in `vm` module avoids the heavy compilation dependencies of `isolated-vm`, ensuring a seamless "npm install" experience on Windows. Security is enforced not by isolating V8 memory, but by **mandatory gate interception** at the boundary of every capability injected into the context, preventing scripts from performing unauthorized execution regardless of how they access those capabilities.

## Consequences

* **Portability**: Developers can install and run the server immediately without compiling native binaries.
* **Security Model**: The `core/permission-gate.ts` remains the single, critical point of failure. It must wrap all capability callbacks exposed to the sandbox runtime.
* **Upgradability**: If a production deployment requires strict multi-tenant isolation in the future, the sandbox runner interface can be swapped to use `isolated-vm` without modifying the capability implementation layers.
