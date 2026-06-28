# ADR 0002 — Relational & Search Database Engine Selection

**Status:** Approved  
**Date:** 2026-06-28  
**Author:** Antigravity AI  

---

## Context

Phase 2 requires a persistent storage engine to hold:
1. Workflow structures and topological step execution states.
2. Checkpoint metadata (associated file backup trees and git commits).
3. Process command execution logs.
4. Fast keyword-based project memories (architecture decisions, preferences).

Per PRD §3.2 (Design Principles) and §4.6 (Memory Subsystem), the database must persist data across execution sessions, support relational queries, and provide a text indexing engine (specifically SQLite FTS5) with a clean migration path to vector embeddings.

## Considered Alternatives

1. **JSON Files / In-Memory State**:
   - *Pros*: Zero external dependencies, no build step.
   - *Cons*: No native relational query support, lacks transactions/isolation, no native full-text search indexing (requiring custom JS search algorithms), and highly prone to state corruption during crashes.
2. **PostgreSQL / MySQL**:
   - *Pros*: Highly robust, production-grade.
   - *Cons*: Requires running an external service container/daemon, contradicting the zero-setup, local desktop CLI utility user experience goal.
3. **SQLite (`better-sqlite3`)**:
   - *Pros*: Single-file database, synchronous API execution (matching CLI execution flow without async concurrency overhead), compiled FTS5 enabled by default, zero daemon dependency, fast read/write times (< 5ms).
   - *Cons*: Requires native C++ build compilation on install, though prebuilt binaries are widely distributed for target platforms.

## Decision

We select **SQLite (`better-sqlite3`)** as the CCatHome database engine.

## Rationale

* **Local Portability**: SQLite runs fully in-process, storing the state in `.ccathome/ccathome.db`.
* **FTS5 Support**: Built-in support for full-text search indexing with BM25 ranking perfectly satisfies the keyword-heavy Project Memory subsystem requirements without adding a separate Elasticsearch or OpenSearch dependency.
* **Synchronous API (`better-sqlite3`)**: Node's asynchronous DB drivers (like `sqlite3`) introduce callback/promise overhead that is unnecessary for a local single-user CLI executor. `better-sqlite3` runs synchronously, which prevents event-loop delay bugs and simplifies lock/transaction handling during step checkpoint rollbacks.

## Consequences

* Node 18+ must be available.
* All schema migrations must be written as forward-only SQL scripts under `db/migrations/` and run on startup.
