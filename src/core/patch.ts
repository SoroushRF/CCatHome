interface Hunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: string[];
}

/**
 * Parses a unified diff patch string into structured hunks.
 */
export function parsePatch(patchText: string): Hunk[] {
  const lines = patchText.split(/\r?\n/);
  const hunks: Hunk[] = [];
  let currentHunk: Hunk | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for hunk header e.g., @@ -1,4 +1,4 @@
    const headerMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (headerMatch) {
      if (currentHunk) {
        hunks.push(currentHunk);
      }
      const oldStart = parseInt(headerMatch[1], 10);
      const oldCount = headerMatch[2] ? parseInt(headerMatch[2], 10) : 1;
      const newStart = parseInt(headerMatch[3], 10);
      const newCount = headerMatch[4] ? parseInt(headerMatch[4], 10) : 1;

      currentHunk = {
        oldStart,
        oldCount,
        newStart,
        newCount,
        lines: [],
      };
    } else if (currentHunk) {
      // Only process lines that are part of a hunk
      if (line.startsWith("-") || line.startsWith("+") || line.startsWith(" ")) {
        currentHunk.lines.push(line);
      } else {
        // Header info, extra metadata, or blank separator - stop current hunk parsing
        hunks.push(currentHunk);
        currentHunk = null;
      }
    }
  }

  if (currentHunk) {
    hunks.push(currentHunk);
  }

  return hunks;
}

/**
 * Applies structured hunks to the original file content.
 * Throws an error with a reason if the patch fails to apply.
 */
export function applyPatchToContent(originalContent: string, hunks: Hunk[]): string {
  const fileLines = originalContent.split(/\r?\n/);

  // Sort hunks by oldStart descending to apply changes from bottom-up.
  // This keeps preceding line numbers stable.
  const sortedHunks = [...hunks].sort((a, b) => b.oldStart - a.oldStart);

  for (const hunk of sortedHunks) {
    const hunkStartIdx = hunk.oldStart - 1;
    let fileLineIdx = hunkStartIdx;

    const replacementLines: string[] = [];
    let matchedOldCount = 0;

    for (const hunkLine of hunk.lines) {
      const type = hunkLine[0];
      const content = hunkLine.slice(1);

      if (type === "-") {
        // Verify the line to be deleted matches the original file
        if (fileLineIdx >= fileLines.length) {
          throw new Error(`Line ${fileLineIdx + 1} exceeds file length`);
        }
        if (fileLines[fileLineIdx] !== content) {
          throw new Error(
            `Mismatch at line ${fileLineIdx + 1}: expected '${content}', found '${fileLines[fileLineIdx]}'`,
          );
        }
        fileLineIdx++;
        matchedOldCount++;
      } else if (type === "+") {
        // Insert new line
        replacementLines.push(content);
      } else {
        // Context line (' ' or empty)
        // Verify context matches the original file
        const expectedContext = hunkLine.startsWith(" ") ? content : hunkLine;
        if (fileLineIdx >= fileLines.length) {
          throw new Error(`Context line ${fileLineIdx + 1} exceeds file length`);
        }
        if (fileLines[fileLineIdx] !== expectedContext) {
          throw new Error(
            `Context mismatch at line ${fileLineIdx + 1}: expected '${expectedContext}', found '${fileLines[fileLineIdx]}'`,
          );
        }
        replacementLines.push(fileLines[fileLineIdx]);
        fileLineIdx++;
        matchedOldCount++;
      }
    }

    // Replace the affected range in fileLines
    fileLines.splice(hunkStartIdx, matchedOldCount, ...replacementLines);
  }

  return fileLines.join("\n");
}
