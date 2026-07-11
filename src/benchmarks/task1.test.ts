import { describe, it, expect, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { registerCapability } from "../core/router.js";
import { invoke } from "../core/dispatcher.js";
import { applyPatchDefinition, applyPatchHandler } from "../tools/filesystem/apply_patch.js";
import { cleanupWorkspace, makeTempWorkspace, resetGitWorkspace } from "./helpers.js";

const DIR = makeTempWorkspace("task1");

describe("benchmark task 1 apply_patch", () => {
  afterEach(() => cleanupWorkspace(DIR));

  it("applies a clean patch with backup and newSha", async () => {
    await resetGitWorkspace(DIR);
    registerCapability(applyPatchDefinition, applyPatchHandler);
    fs.writeFileSync(
      path.join(DIR, "sum.js"),
      "export function sum(a, b) { return a + b; }\n",
      "utf-8",
    );

    const patch = `@@ -1,1 +1,3 @@
-export function sum(a, b) { return a + b; }
+export function sum(...args) {
+  return args.reduce((acc, n) => acc + Number(n), 0);
+}
`;
    const res = await invoke("apply_patch", { path: "sum.js", patch });
    expect(res.result.success).toBe(true);
    expect(res.result.appliedHunks).toBeGreaterThanOrEqual(1);
    expect(res.result.newSha).toMatch(/^[a-f0-9]{64}$/);
    const backups = path.join(DIR, ".ccathome", "backups");
    expect(fs.existsSync(backups)).toBe(true);
    expect(fs.readdirSync(backups).some((f) => f.endsWith(".bak"))).toBe(true);
    expect(fs.readFileSync(path.join(DIR, "sum.js"), "utf-8")).toContain("...args");
  });
});
