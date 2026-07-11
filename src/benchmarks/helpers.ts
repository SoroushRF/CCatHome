import * as fs from "fs";
import * as path from "path";
import { config } from "../core/config.js";
import { closeDb } from "../core/db.js";
import { clearRegistry } from "../core/router.js";
import { runCommandGated } from "../core/process-runner.js";

export function makeTempWorkspace(name: string): string {
  return path.resolve(process.cwd(), `temp_bench_${name}`);
}

export async function resetGitWorkspace(dir: string): Promise<void> {
  clearRegistry();
  closeDb();
  config.workspaceRoot = dir;
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  await runCommandGated("git init");
  await runCommandGated('git config user.email "bench@ccathome.com"');
  await runCommandGated('git config user.name "Bench"');
  await runCommandGated("git checkout -b main");
}

export function cleanupWorkspace(dir: string): void {
  closeDb();
  if (fs.existsSync(dir)) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
  config.workspaceRoot = process.cwd();
}
