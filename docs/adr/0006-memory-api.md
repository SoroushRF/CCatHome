# ADR 0006 — Memory API Shape (`content` / `tags`)

* **Status**: Accepted
* **Deciders**: Engineering (remediation track R0)
* **Date**: 2026-07-11
* **Relates to**: PRD §4.6; `docs/tools/remember.md` / `recall.md` drift

## Context

PRD §4.6 specifies `remember(key, value, category)` and `recall(query, category?)`.

Shipped handlers use:

* `remember({ content, tags? })` → stores FTS row with auto-generated id
* `recall({ query, limit? })` → returns `{ id, content, tags, score }[]`

The FTS5 table columns remain `key`, `value`, `category`, `embedding UNINDEXED` per migration `0001-init.sql`.

## Decision

**Canonical public API is the shipped code shape** (`content` / `tags` / `limit`). Update PRD §4.6 and tool docs in Phase R6.

### Column mapping

| FTS5 column | API field | Notes |
|---|---|---|
| `key` | memory id (auto) | Not caller-supplied in v1 |
| `value` | `content` | Primary text body |
| `category` | `tags` JSON string | Array serialized to JSON text |
| `embedding` | unused in v1 | Reserved for v2 / sqlite-vec |

## Consequences

* No breaking runtime change in R0–R5 for memory tools.
* Tool docs that still show `key`/`value`/`category` are wrong until R6.
* LIKE-wildcard escaping in recall fallback remains a Phase R5 fix, not an API change.
