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
  path.resolve('src/tools/system/detect_workspace.ts')
]);

function isFsWhitelisted(filePath) {
  if (FS_WHITELIST_FILES.has(filePath)) {
    return true;
  }
  return FS_WHITELIST_DIRS.some(dir => filePath.startsWith(dir));
}

let hasErrors = false;

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      // Ignore test files as they are validation suites, not capability implementations
      if (entry.name.endsWith('.test.ts')) {
        continue;
      }

      const content = fs.readFileSync(fullPath, 'utf-8');
      
      // Simple regex checks for import or require statements
      const hasChildProcess = /import\s+.*\s+from\s+['"]child_process['"]|require\(['"]child_process['"]\)/.test(content);
      const hasFs = /import\s+.*\s+from\s+['"]fs['"]|import\s+.*\s+from\s+['"]fs\/promises['"]|require\(['"]fs['"]\)/.test(content);

      if (hasChildProcess && !CHILD_PROCESS_WHITELIST.has(fullPath)) {
        console.error(`Lint Error: Gated execution bypass detected in '${fullPath}'. Direct import of 'child_process' is forbidden. Use runCommandGated helper instead.`);
        hasErrors = true;
      }

      if (hasFs && !isFsWhitelisted(fullPath)) {
        console.error(`Lint Error: Gated execution bypass detected in '${fullPath}'. Direct import of 'fs' is forbidden outside whitelisted modules.`);
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
