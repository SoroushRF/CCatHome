import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { resolveSafePath } from "./path-utils.js";

const TEST_DIR = path.resolve(process.cwd(), "temp_path_utils_test");
const WORKSPACE_DIR = path.join(TEST_DIR, "workspace");
const OUTSIDE_DIR = path.join(TEST_DIR, "outside");

describe("Symlink Path Containment Verification Suite (Finding #8)", () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      try {
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
      } catch (_e) {
        // ignore
      }
    }
    fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
    fs.mkdirSync(OUTSIDE_DIR, { recursive: true });

    // Create outside file
    fs.writeFileSync(path.join(OUTSIDE_DIR, "secrets.txt"), "sensitive payload\n", "utf-8");
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      try {
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
      } catch (_e) {
        // ignore
      }
    }
  });

  it("should block reading/accessing files escaping the workspace via symlinks", () => {
    // Create symlink escaping the workspace root
    const symlinkPath = path.join(WORKSPACE_DIR, "escape_link");
    
    try {
      fs.symlinkSync(OUTSIDE_DIR, symlinkPath, "dir");
    } catch (err: any) {
      // Symlinks might require admin privileges on some Windows machines.
      // If symlink creation fails due to permissions, skip the test gracefully.
      if (err.code === "EPERM") {
        return;
      }
      throw err;
    }

    // Attempting to resolve path through the symlink to read secrets.txt
    expect(() => {
      resolveSafePath(WORKSPACE_DIR, "escape_link/secrets.txt");
    }).toThrow(/path_traversal_detected/);
  });

  it("should allow safe relative paths inside workspace", () => {
    fs.writeFileSync(path.join(WORKSPACE_DIR, "safe.txt"), "hello", "utf-8");
    const resolved = resolveSafePath(WORKSPACE_DIR, "safe.txt");
    expect(resolved).toBe(path.join(WORKSPACE_DIR, "safe.txt"));
  });
});
