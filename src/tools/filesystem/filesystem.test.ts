import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { registerCapability, clearRegistry } from "../../core/router.js";
import { invoke } from "../../core/dispatcher.js";
import { config } from "../../core/config.js";
import { applyPatchDefinition, applyPatchHandler } from "./apply_patch.js";
import { readFileDefinition, readFileHandler } from "./read_file.js";
import { readFileSectionDefinition, readFileSectionHandler } from "./read_file_section.js";
import { searchFilesDefinition, searchFilesHandler } from "./search_files.js";
import { listDirectoryDefinition, listDirectoryHandler } from "./list_directory.js";
import { moveFileDefinition, moveFileHandler } from "./move_file.js";

const TEST_DIR = path.resolve(config.workspaceRoot, "temp_fs_test");

describe("Filesystem Capabilities Suite", () => {
  beforeEach(() => {
    clearRegistry();
    // Set config.workspaceRoot to TEST_DIR
    config.workspaceRoot = TEST_DIR;

    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_DIR, { recursive: true });

    // Register all definitions and handlers
    registerCapability(applyPatchDefinition, applyPatchHandler);
    registerCapability(readFileDefinition, readFileHandler);
    registerCapability(readFileSectionDefinition, readFileSectionHandler);
    registerCapability(searchFilesDefinition, searchFilesHandler);
    registerCapability(listDirectoryDefinition, listDirectoryHandler);
    registerCapability(moveFileDefinition, moveFileHandler);
  });

  afterEach(() => {
    // Clean up
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
    // Restore workspaceRoot
    config.workspaceRoot = process.cwd();
  });

  it("should read and patch files successfully", async () => {
    // 1. Create a dummy file
    const filePath = "hello.txt";
    const fullPath = path.join(TEST_DIR, filePath);
    fs.writeFileSync(fullPath, "line1\nline2\nline3", "utf-8");

    // 2. Read the file
    const readRes = await invoke("read_file", { path: filePath });
    expect(readRes.success).toBe(true);
    expect(readRes.result.content).toBe("line1\nline2\nline3");

    // 3. Patch the file
    const patch = `
@@ -1,3 +1,3 @@
 line1
-line2
+lineTwo
 line3
`;
    const patchRes = await invoke("apply_patch", {
      path: filePath,
      patch,
    });
    expect(patchRes.success).toBe(true);
    expect(patchRes.result.appliedHunks).toBe(1);

    // Verify content
    const updatedContent = fs.readFileSync(fullPath, "utf-8");
    expect(updatedContent).toBe("line1\nlineTwo\nline3");
  });

  it("should fail patch on expectedSha mismatch", async () => {
    const filePath = "sha_test.txt";
    fs.writeFileSync(path.join(TEST_DIR, filePath), "content", "utf-8");

    const badSha = crypto.createHash("sha256").update("other content").digest("hex");
    const patch = `
@@ -1 +1 @@
-content
+new content
`;

    const res = await invoke("apply_patch", {
      path: filePath,
      patch,
      expectedSha: badSha,
    });

    expect(res.result.success).toBe(false);
    expect(res.result.error).toBe("sha_mismatch");
  });

  it("should reject path traversal in apply_patch and read_file", async () => {
    const patch = `@@ -1 +1 @@\n-content\n+new content`;
    
    const patchRes = await invoke("apply_patch", {
      path: "../../escaped.txt",
      patch,
    });
    expect(patchRes.result.success).toBe(false);
    expect(patchRes.result.error).toBe("invalid_path");
    expect(patchRes.result.reason).toContain("escapes the workspace root");

    const readRes = await invoke("read_file", {
      path: "../../escaped.txt",
    });
    expect(readRes.result.success).toBe(false);
    expect(readRes.result.error).toBe("invalid_path");
  });

  it("should generate outline for files over 300 lines", async () => {
    const filePath = "large.txt";
    const lines: string[] = [];
    for (let i = 0; i < 350; i++) {
      if (i === 10) {
        lines.push("class LargeClass {");
      } else if (i === 50) {
        lines.push("function testFunc() {");
      } else {
        lines.push(`line ${i + 1}`);
      }
    }
    fs.writeFileSync(path.join(TEST_DIR, filePath), lines.join("\n"), "utf-8");

    const res = await invoke("read_file", { path: filePath });
    expect(res.success).toBe(true);
    expect(res.result.truncated).toBe(true);
    expect(res.result.outline).toContain("Line 11: class LargeClass {");
    expect(res.result.outline).toContain("Line 51: function testFunc() {");
    expect(res.result.totalLines).toBe(350);
  });

  it("should read a specific line range via read_file_section", async () => {
    const filePath = "range.txt";
    fs.writeFileSync(path.join(TEST_DIR, filePath), "1\n2\n3\n4\n5\n6\n7\n8", "utf-8");

    const res = await invoke("read_file_section", {
      path: filePath,
      start: 3,
      end: 5,
    });

    expect(res.success).toBe(true);
    expect(res.result.lines).toEqual(["3", "4", "5"]);
  });

  it("should recursively search files in the workspace", async () => {
    const subDir = path.join(TEST_DIR, "subdir");
    fs.mkdirSync(subDir);
    fs.writeFileSync(path.join(TEST_DIR, "f1.txt"), "apple pie recipe", "utf-8");
    fs.writeFileSync(path.join(subDir, "f2.txt"), "banana split recipe", "utf-8");

    const res = await invoke("search_files", { query: "recipe" });
    expect(res.success).toBe(true);
    const paths = res.result.matches.map((m: any) => m.path);
    expect(paths).toContain("f1.txt");
    expect(paths).toContain(path.join("subdir", "f2.txt"));
  });

  it("should list directories and move files correctly", async () => {
    fs.writeFileSync(path.join(TEST_DIR, "move_me.txt"), "hello", "utf-8");

    const listBefore = await invoke("list_directory", {});
    expect(listBefore.success).toBe(true);
    const namesBefore = listBefore.result.items.map((i: any) => i.name);
    expect(namesBefore).toContain("move_me.txt");

    const moveRes = await invoke("move_file", {
      source: "move_me.txt",
      destination: "moved.txt",
    });
    expect(moveRes.success).toBe(true);

    const listAfter = await invoke("list_directory", {});
    const namesAfter = listAfter.result.items.map((i: any) => i.name);
    expect(namesAfter).not.toContain("move_me.txt");
    expect(namesAfter).toContain("moved.txt");
  });

  it("should block apply_patch to sensitive paths like .env", async () => {
    const patch = `--- a/.env
+++ b/.env
@@ -0,0 +1 @@
+SECRET=1
`;
    const patchRes = await invoke("apply_patch", {
      path: ".env",
      patch,
    });
    expect(patchRes.result.success).toBe(false);
    expect(patchRes.result.error).toBe("sensitive_path_blocked");
  });
});
