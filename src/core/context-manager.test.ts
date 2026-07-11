import { describe, it, expect } from "vitest";
import {
  truncateChars,
  truncateLines,
  outlineSource,
  summarizeCommandOutput,
  summarizeAttemptLog,
} from "./context-manager.js";

describe("context-manager", () => {
  it("truncates chars and lines", () => {
    expect(truncateChars("abcdefghij", 5)).toContain("...[truncated]");
    expect(truncateLines("a\nb\nc\nd", 2)).toContain("more lines");
  });

  it("outlines source signatures", () => {
    const src = `import x from 'y';\nexport function foo() {}\nconst bar = 1;\n`;
    const outline = outlineSource(src);
    expect(outline).toContain("export function foo");
    expect(outline).toContain("const bar");
  });

  it("summarizes command output and attempt logs", () => {
    const summary = summarizeCommandOutput({
      stdout: "ok",
      stderr: "warn",
      exitCode: 0,
    });
    expect(summary).toContain("exit=0");
    expect(summary).toContain("stdout");
    expect(summarizeAttemptLog("x".repeat(5000), 100).length).toBeLessThan(120);
  });
});
