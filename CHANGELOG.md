# Changelog

All notable changes to the `CCatHome` server will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Notes
- **Version skew:** `package.json` / MCP server still report `1.0.0` while this file’s latest release section is `[2.0.0]`. Package bump is deferred to remediation Phase R7 (`docs/plans/REMEDIATION_TO_90.md` Task R7.7.2).
- Active engineering track: Phases R0–R7 in `docs/plans/REMEDIATION_TO_90.md` (ADRs 0004–0009 accepted in R0).

### Fixed
- `detect_workspace` discovery test now uses a platform-absolute temp path (Linux CI).
- `run_command` flushes/closes the log write stream on child `close` so `expand_log` sees stderr.

---

## [2.0.0] - 2026-06-29

### Added
- Stdio Model Context Protocol (MCP) server integration using `@modelcontextprotocol/sdk`.
- Static capability bootstrap registration module registering 26 Tier A and Tier B capabilities.
- Live glassmorphic web dashboard with Server-Sent Events (SSE) server on port 3141.
- Authentication tokens and security cookies protecting local dashboard server requests.
- Gated filesystem VM sandbox interface intercepting `readFile` and `writeFile` statements.
- Cycle-detection check validating diamond-shaped DAG workflow configurations.
- Levenshtein-distance tool typo suggestions when executing dispatch invoke.
- Static gate bypass validator script checks inside `npm run lint`.
- Copy-on-write `apply_patch` atomic modifications supporting diff patch workflows.

### Changed
- Refactored `runCommandGated` to run command operations via `child_process.spawn` instead of `exec`, resolving the 1MB buffer cap issue.
- Updated path containment checks (`resolveSafePath`) to validate fully resolved real paths via `fs.realpathSync` to block symlink escapes.
- Moved `npm install` utility commands to Tier 0 (auto-allowed).
- Moved `git checkout`, `git reset`, and `git clean` commands to Tier 2 (requires confirmation).
- Modified Tier 3 blocked patterns to run unanchored regexes preventing chaining bypasses.

### Fixed
- Fixed typo `node-node` to `node-version: '20'` in the GitHub actions CI pipeline script.
- Added `npm run build` compilation step to CI checklist.
