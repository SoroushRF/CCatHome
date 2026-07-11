import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Shared mutable globals (config.workspaceRoot, db singleton, permission
    // rules cache) are not yet isolated per file — disable file parallelism
    // to avoid cross-suite races (remediation Task R1.2.3; re-enable after R7.1).
    fileParallelism: false,
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
  },
});
