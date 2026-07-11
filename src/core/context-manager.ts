/**
 * Context manager helpers for truncating model-facing outputs (PRD §4.3).
 */

const DEFAULT_MAX_CHARS = 2000;
const DEFAULT_MAX_LINES = 80;

export function truncateChars(text: string, maxChars = DEFAULT_MAX_CHARS): string {
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars)}\n...[truncated]`;
}

export function truncateLines(text: string, maxLines = DEFAULT_MAX_LINES): string {
  const lines = text.split("\n");
  if (lines.length <= maxLines) {
    return text;
  }
  return `${lines.slice(0, maxLines).join("\n")}\n...[${lines.length - maxLines} more lines]`;
}

/** Keep the trailing N lines (useful for live command tails). */
export function tailLines(text: string, maxLines = 20): string {
  const lines = text.split(/\r?\n/);
  if (lines.length <= maxLines) {
    return text;
  }
  return (
    `... (truncated ${lines.length - maxLines} lines) ...\n` + lines.slice(-maxLines).join("\n")
  );
}

/**
 * Produce a lightweight outline of source content (exports / headings / signatures).
 */
export function outlineSource(content: string, maxLines = 40): string {
  const lines = content.split("\n");
  const outline: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      /^(export\s+)?(async\s+)?function\b/.test(trimmed) ||
      /^(export\s+)?class\b/.test(trimmed) ||
      /^(export\s+)?(const|let|var)\s+\w+\s*=/.test(trimmed) ||
      /^#{1,6}\s/.test(trimmed) ||
      /^interface\b|^type\b/.test(trimmed)
    ) {
      outline.push(trimmed);
    }
    if (outline.length >= maxLines) {
      break;
    }
  }
  if (outline.length === 0) {
    return truncateLines(content, Math.min(maxLines, 20));
  }
  return outline.join("\n");
}

export function summarizeCommandOutput(opts: {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  maxChars?: number;
}): string {
  const parts: string[] = [];
  if (opts.exitCode !== undefined) {
    parts.push(`exit=${opts.exitCode}`);
  }
  if (opts.stdout?.trim()) {
    parts.push(`stdout:\n${truncateChars(opts.stdout.trim(), opts.maxChars ?? 800)}`);
  }
  if (opts.stderr?.trim()) {
    parts.push(`stderr:\n${truncateChars(opts.stderr.trim(), opts.maxChars ?? 800)}`);
  }
  return truncateChars(parts.join("\n\n") || "(no output)", opts.maxChars ?? DEFAULT_MAX_CHARS);
}

export function summarizeAttemptLog(fullLog: string, maxChars = DEFAULT_MAX_CHARS): string {
  return truncateChars(fullLog, maxChars);
}
