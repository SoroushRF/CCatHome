/**
 * Benchmark task runner CLI (remediation R7.4.1).
 *
 * Executed via: `npm run benchmark:v1 -- --task <id>`
 * Implementation lives in `src/benchmarks/` and is driven by Vitest
 * (no new runtime dependency — same stack as unit tests).
 */
import { spawnSync } from "node:child_process";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function parseTask(argv: string[]): string | undefined {
  const idx = argv.indexOf("--task");
  if (idx >= 0 && argv[idx + 1]) return argv[idx + 1];
  const eq = argv.find((a) => a.startsWith("--task="));
  if (eq) return eq.slice("--task=".length);
  return undefined;
}

const task = parseTask(process.argv.slice(2));
const vitestArgs = ["vitest", "run", "src/benchmarks"];
if (task) {
  vitestArgs.push("-t", `task ${task}`);
}

const result = spawnSync("npx", vitestArgs, {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
  env: process.env,
});

process.exit(result.status ?? 1);
