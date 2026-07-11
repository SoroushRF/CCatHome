import fs from 'fs';
import path from 'path';

const TOOLS_DIR = path.resolve('src/tools');

// Whitelisted files that are allowed to import 'child_process'
const CHILD_PROCESS_WHITELIST = new Set([
  path.resolve('src/tools/process/run_command.ts'),
  path.resolve('src/tools/process/run_script.ts')
]);

// Whitelisted files/directories that are allowed to import 'fs' or 'fs/promises'
const FS_WHITELIST_DIRS = [
  path.resolve('src/tools/filesystem'),
  path.resolve('src/tools/checkpoint')
];
const FS_WHITELIST_FILES = new Set([
  path.resolve('src/tools/process/run_command.ts'),
  path.resolve('src/tools/process/run_script.ts'),
  path.resolve('src/tools/process/expand_log.ts'),
  path.resolve('src/tools/process/read_process_output.ts'),
  path.resolve('src/tools/system/detect_workspace.ts'),
  path.resolve('src/tools/system/open_project.ts')
]);

/** Whitelisted files must reference at least one of these safety markers. */
const SAFETY_MARKERS = [
  'classifyAndGate',
  'runCommandGated',
  'runArgvGated',
  'runGit',
  'resolveSafePath',
  'safeWriteFile',
  'assertNotSensitiveWorkspacePath',
  'prepareWorkspaceRetarget',
];

/** Only these tool files may call runCommandUngated (temporary until ADR 0010). */
const UNGATED_ALLOWLIST = new Set([
  path.resolve('src/tools/checkpoint/checkpoint.ts'),
  path.resolve('src/tools/checkpoint/restore_checkpoint.ts'),
]);

function isFsWhitelisted(filePath) {
  if (FS_WHITELIST_FILES.has(filePath)) {
    return true;
  }
  return FS_WHITELIST_DIRS.some(dir => filePath.startsWith(dir + path.sep) || filePath.startsWith(dir));
}

let hasErrors = false;

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      if (entry.name.endsWith('.test.ts')) {
        continue;
      }

      const content = fs.readFileSync(fullPath, 'utf-8');

      const hasChildProcess =
        /import\s+.*\s+from\s+['"]child_process['"]|import\s+.*\s+from\s+['"]node:child_process['"]|require\(['"](?:node:)?child_process['"]\)/.test(content);
      const hasFs =
        /import\s+.*\s+from\s+['"]fs['"]|import\s+.*\s+from\s+['"]fs\/promises['"]|import\s+.*\s+from\s+['"]node:fs['"]|import\s+.*\s+from\s+['"]node:fs\/promises['"]|require\(['"](?:node:)?fs(?:\/promises)?['"]\)/.test(content);

      if (hasChildProcess && !CHILD_PROCESS_WHITELIST.has(fullPath)) {
        console.error(`Lint Error: Gated execution bypass detected in '${fullPath}'. Direct import of 'child_process' is forbidden. Use runCommandGated helper instead.`);
        hasErrors = true;
      }

      if (hasFs && !isFsWhitelisted(fullPath)) {
        console.error(`Lint Error: Gated execution bypass detected in '${fullPath}'. Direct import of 'fs' is forbidden outside whitelisted modules.`);
        hasErrors = true;
      }

      const isWhitelisted =
        CHILD_PROCESS_WHITELIST.has(fullPath) || isFsWhitelisted(fullPath);
      if (isWhitelisted) {
        const hasMarker = SAFETY_MARKERS.some((m) => content.includes(m));
        if (!hasMarker) {
          console.error(
            `Lint Error: Whitelisted tool '${fullPath}' must reference a gate/safe helper (${SAFETY_MARKERS.join(', ')}).`
          );
          hasErrors = true;
        }
      }

      if (content.includes('runCommandUngated') && !UNGATED_ALLOWLIST.has(fullPath)) {
        console.error(
          `Lint Error: runCommandUngated call site not allowlisted in '${fullPath}'. Only checkpoint/restore may use it temporarily.`
        );
        hasErrors = true;
      }
    }
  }
}

console.log('Running static gate bypass analysis...');
scanDir(TOOLS_DIR);

if (hasErrors) {
  console.log('Static gate bypass analysis failed.');
  process.exit(1);
} else {
  console.log('Static gate bypass analysis passed cleanly.');
}
