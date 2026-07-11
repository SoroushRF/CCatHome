#!/usr/bin/env node
/**
 * lint-no-magic-status.js
 *
 * AGENTS.md section 1.3 — no magic strings for workflow/step/confirmation statuses.
 * Fails if quoted literals matching known status values appear outside the
 * allowlisted files.
 *
 * Allowlist:
 *   - src/core/constants.ts (canonical enum definitions)
 *   - any file ending in .test.ts (assertions may use literal expected values)
 *   - src/core/dashboard-server.ts (HTML/CSS class names must match enum
 *     string values; TS comparisons interpolate enums at render time)
 *
 * Status tokens checked: pending, running, completed, failed,
 * requires_confirmation, approved, rejected
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");

const STATUS_RE =
  /(['"])(pending|running|completed|failed|requires_confirmation|approved|rejected)\1/g;

const ALLOWLIST = new Set([
  path.join(SRC, "core", "constants.ts"),
  path.join(SRC, "core", "dashboard-server.ts"),
]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

const violations = [];
for (const file of walk(SRC)) {
  if (ALLOWLIST.has(file)) continue;
  if (file.endsWith(".test.ts")) continue;

  const content = fs.readFileSync(file, "utf8");
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip obvious comments
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
      continue;
    }
    STATUS_RE.lastIndex = 0;
    let match;
    while ((match = STATUS_RE.exec(line)) !== null) {
      violations.push({
        file: path.relative(ROOT, file),
        line: i + 1,
        token: match[2],
        text: trimmed.slice(0, 120),
      });
    }
  }
}

if (violations.length > 0) {
  console.error("Magic status string literals found (use enums from src/core/constants.ts):\n");
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  "${v.token}"  →  ${v.text}`);
  }
  console.error(`\n${violations.length} violation(s).`);
  process.exit(1);
}

console.log("lint-no-magic-status: ok");
