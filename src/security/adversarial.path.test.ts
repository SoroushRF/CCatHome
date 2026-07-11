import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { config } from "../core/config.js";
import { clearRegistry, registerCapability } from "../core/router.js";
import { invoke } from "../core/dispatcher.js";
import { applyPatchDefinition, applyPatchHandler } from "../tools/filesystem/apply_patch.js";
import { readFileDefinition, readFileHandler } from "../tools/filesystem/read_file.js";

const TEST_DIR = path.resolve(process.cwd(), "temp_adv_path");

describe("adversarial path containment (R7.3.1)", () => {
  beforeEach(() => {
    clearRegistry();
    config.workspaceRoot = TEST_DIR;
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
    fs.mkdirSync(TEST_DIR, { recursive: true });
    registerCapability(applyPatchDefinition, applyPatchHandler);
    registerCapability(readFileDefinition, readFileHandler);
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
    config.workspaceRoot = process.cwd();
  });

  it("rejects relative ../ traversal on read and write", async () => {
    const read = await invoke("read_file", { path: "../outside.txt" });
    expect(read.result.error).toBe("invalid_path");
    const write = await invoke("apply_patch", {
      path: "../../etc/passwd",
      patch: "@@ -1 +1 @@\n-a\n+b\n",
    });
    expect(write.result.error).toBe("invalid_path");
  });

  it("rejects absolute /etc/passwd", async () => {
    const read = await invoke("read_file", { path: "/etc/passwd" });
    expect(read.result.error).toBe("invalid_path");
  });

  it("rejects null-byte injection in paths", async () => {
    const read = await invoke("read_file", { path: "safe.txt\0../../etc/passwd" });
    // Either invalid_path or filesystem error — never reads /etc/passwd content
    if (read.result.success) {
      expect(String(read.result.content || "")).not.toMatch(/root:/);
    } else {
      expect(["invalid_path", "read_failed", "file_not_found"]).toContain(
        read.result.error
      );
    }
  });

  it("rejects symlink escape when link points outside workspace", async () => {
    const outside = path.resolve(process.cwd(), "temp_adv_path_outside");
    fs.mkdirSync(outside, { recursive: true });
    fs.writeFileSync(path.join(outside, "secret.txt"), "SECRET\n", "utf-8");
    try {
      fs.symlinkSync(path.join(outside, "secret.txt"), path.join(TEST_DIR, "link.txt"));
    } catch (err: any) {
      // Some environments block symlink creation — fail loudly, never silent pass
      expect.fail(`symlink setup failed: ${err.message}`);
    }
    const read = await invoke("read_file", { path: "link.txt" });
    expect(read.result.success).toBe(false);
    expect(read.result.error).toBe("invalid_path");
    fs.rmSync(outside, { recursive: true, force: true });
  });
});
