#!/usr/bin/env node
/**
 * Lightweight secret scan for tracked source (remediation R7.6.1).
 * No new dependency — regex heuristics only. Wire into `npm run lint`.
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".git",
  "coverage",
  "temp_",
]);

const SKIP_FILES = new Set(["package-lock.json", "lint-no-secrets.js"]);

/** Patterns that strongly suggest committed secrets. */
const PATTERNS = [
  { name: "AWS access key", re: /AKIA[0-9A-Z]{16}/g },
  { name: "OpenAI-style key", re: /\bsk-[A-Za-z0-9]{20,}\b/g },
  { name: "Private key block", re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: "GitHub PAT", re: /\bghp_[A-Za-z0-9]{36}\b/g },
  { name: "Slack token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
];

/** Allowlisted substrings (docs/examples). */
const ALLOWLIST = [
  "test-approval-secret",
  "adv-hitl-secret",
  "CCATHOME_APPROVAL_TOKEN",
  "sk-example",
];

function shouldSkipDir(name) {
  if (SKIP_DIRS.has(name)) return true;
  if (name.startsWith("temp_")) return true;
  return false;
}

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) {
      if (shouldSkipDir(ent.name)) continue;
      walk(path.join(dir, ent.name), out);
    } else if (ent.isFile()) {
      if (SKIP_FILES.has(ent.name)) continue;
      const ext = path.extname(ent.name);
      if (![".ts", ".js", ".mjs", ".json", ".md", ".yml", ".yaml", ".env", ".sh"].includes(ext)) {
        continue;
      }
      out.push(path.join(dir, ent.name));
    }
  }
  return out;
}

const files = walk(root);
const hits = [];

for (const file of files) {
  const rel = path.relative(root, file);
  let text;
  try {
    text = fs.readFileSync(file, "utf-8");
  } catch {
    continue;
  }
  for (const { name, re } of PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      const snippet = m[0];
      if (ALLOWLIST.some((a) => text.includes(a) && rel.includes("test"))) {
        // still check — only skip if the match itself is allowlisted
      }
      if (ALLOWLIST.some((a) => snippet.includes(a) || a === snippet)) continue;
      const line = text.slice(0, m.index).split("\n").length;
      hits.push({ rel, name, line, snippet: snippet.slice(0, 24) + "…" });
    }
  }
}

if (hits.length) {
  console.error("lint-no-secrets: potential secrets found:");
  for (const h of hits) {
    console.error(`  ${h.rel}:${h.line} [${h.name}] ${h.snippet}`);
  }
  process.exit(1);
}

console.log("lint-no-secrets: ok");
