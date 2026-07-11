import { describe, it, expect, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { registerCapability } from "../core/router.js";
import { invoke } from "../core/dispatcher.js";
import { applyPatchDefinition, applyPatchHandler } from "../tools/filesystem/apply_patch.js";
import { readFileDefinition, readFileHandler } from "../tools/filesystem/read_file.js";
import { cleanupWorkspace, makeTempWorkspace, resetGitWorkspace } from "./helpers.js";

const DIR = makeTempWorkspace("task7");

describe("benchmark task 7 containment", () => {
  afterEach(() => cleanupWorkspace(DIR));

  it("rejects traversal and absolute escapes without touching host files", async () => {
    await resetGitWorkspace(DIR);
    registerCapability(applyPatchDefinition, applyPatchHandler);
    registerCapability(readFileDefinition, readFileHandler);

    const outside = path.resolve(process.cwd(), "temp_bench_task7_outside.txt");
    fs.writeFileSync(outside, "host-secret\n", "utf-8");
    try {
      const read = await invoke("read_file", { path: "../../temp_bench_task7_outside.txt" });
      expect(read.result.success).toBe(false);
      expect(read.result.error).toBe("invalid_path");

      const abs = await invoke("apply_patch", {
        path: "/etc/passwd",
        patch: "@@ -1 +1 @@\n-a\n+b\n",
      });
      expect(abs.result.error).toBe("invalid_path");
      expect(fs.readFileSync(outside, "utf-8")).toBe("host-secret\n");
    } finally {
      fs.rmSync(outside, { force: true });
    }
  });
});
