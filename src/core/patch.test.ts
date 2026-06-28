import { describe, it, expect } from "vitest";
import { parsePatch, applyPatchToContent } from "./patch.js";

describe("Unified Diff Patch Applier", () => {
  it("should parse unified diff hunks correctly", () => {
    const patch = `
--- a/file.txt
+++ b/file.txt
@@ -1,4 +1,5 @@
-hello
+hello world
 coding
+is
 is
 fun
`;
    const hunks = parsePatch(patch);
    expect(hunks.length).toBe(1);
    expect(hunks[0].oldStart).toBe(1);
    expect(hunks[0].oldCount).toBe(4);
    expect(hunks[0].newStart).toBe(1);
    expect(hunks[0].newCount).toBe(5);
  });

  it("should apply simple patches correctly", () => {
    const original = "hello\ncoding\nis\nfun";
    const patch = `
@@ -1,4 +1,5 @@
-hello
+hello world
 coding
+is
 is
 fun
`;
    const hunks = parsePatch(patch);
    const result = applyPatchToContent(original, hunks);
    expect(result).toBe("hello world\ncoding\nis\nis\nfun");
  });

  it("should apply multiple non-contiguous hunks bottom-up successfully", () => {
    const original = "line1\nline2\nline3\nline4\nline5\nline6";
    const patch = `
@@ -2,2 +2,2 @@
-line2
+lineTwo
 line3
@@ -5,2 +5,2 @@
-line5
+lineFive
 line6
`;
    const hunks = parsePatch(patch);
    const result = applyPatchToContent(original, hunks);
    expect(result).toBe("line1\nlineTwo\nline3\nline4\nlineFive\nline6");
  });

  it("should throw an error on context line mismatch", () => {
    const original = "line1\nline2\nline3\nline4";
    const patch = `
@@ -2,2 +2,2 @@
-lineWrong
+lineTwo
 line3
`;
    const hunks = parsePatch(patch);
    expect(() => applyPatchToContent(original, hunks)).toThrow("Mismatch at line 2");
  });
});
