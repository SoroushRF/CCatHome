# ADR 0003 — execute_step Self-Healing Auto-Fix Architecture

**Status:** Approved  
**Date:** 2026-06-29  
**Author:** Antigravity AI  

---

## Context

Phase 2 introduces the `execute_step` compound loop capability. According to PRD §4.5, if a step's execution fails to validate, the engine should perform a self-healing loop: roll back to the pre-step checkpoint, run recovery commands, and re-attempt execution.

We need to define the boundaries of the auto-fix loop in the v1 engine vs. client-layer orchestration:
1. Should the recovery step dynamically request LLM code repair reasoning (e.g. prompt-based context loops) inside the local engine core?
2. Or should the engine maintain a deterministic, caller-supplied recovery command contract, deferring dynamic model generation and code repair loops to the calling agent shell?

## Considered Alternatives

1. **Inline LLM Code Repair Generation (Self-Healing in Core)**:
   - *Pros*: Completely autonomous self-healing inside a single tool execution.
   - *Cons*: Requires binding LLM API client credentials and prompt configuration into the core executor layer. This violates the model-agnostic, protocol-driven design of the Model Context Protocol (MCP) server, adding heavy external client dependencies and context management into the runtime engine.

2. **Deterministic Caller-Supplied Recovery Command (V1 Engine Boundary)**:
   - *Pros*: Model-agnostic, zero extra dependencies, secure, and fully aligned with standard MCP tool contracts. The client agent can dynamically construct the `recoveryCommand` (e.g., using output logs or repair code templates) before invoking the tool, keeping all LLM logic inside the client loop.
   - *Cons*: Rerunning a static recovery command will fail identically if the underlying source code bug is not resolved outside the loop.

## Decision

We select **Alternative 2: Deterministic Caller-Supplied Recovery Command** for the V1 Engine boundary. Rerunning/auto-fixing loops are knowingly deferred to the client orchestration layer (the agent shell that manages the tool calls).

## Rationale

* **Model Context Protocol Separation**: Keeping LLM client APIs, tokens, and system prompts out of the engine ensures CCatHome remains a clean, generic MCP server that can hook into any external client (Claude, Gemini, ChatGPT).
* **Dynamic Client-Generated Repairs**: The calling agent is responsible for diagnosing failures. If an E2E step fails, the client agent inspects the exit code and logs, generates a target patch, and passes it as a `recoveryCommand` (or sequential `apply_patch` call) to correct the workspace.
* **Deterministic Engine Contracts**: The engine focuses on state management: checkpoint rollback, atomic step updates, process streaming, and clean execution state persistence.

## Consequences

* The `execute_step` capability accepts a static `recoveryCommand` parameter.
* If a step fails validation, the engine rolls back files, runs the `recoveryCommand` (if supplied), and re-runs the step's `executionCommand`.
* Dynamic LLM context feedback loops (code repair generation) are fully orchestrated by the calling agent client rather than the engine itself.
