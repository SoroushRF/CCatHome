import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    setupFiles: ["src/test/setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Shared mutable globals (config.workspaceRoot, db singleton, permission
    // rules cache) use shared singletons; fileParallelism stays off (R1.2.3) even with
    // setup restore (R7.1.3) because DB/process registry still need serial runs.
    fileParallelism: false,
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/core/**/*.ts", "src/tools/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/test/**", "src/benchmarks/**", "src/security/**"],
      thresholds: {
        lines: 70,
        functions: 65,
        statements: 70,
        branches: 55,
      },
    },
  },
});
