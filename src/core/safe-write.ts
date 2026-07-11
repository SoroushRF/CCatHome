import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { assertNotSensitiveWorkspacePath } from "./sensitive-paths.js";

/**
 * Atomic temp-write + rename helper for workspace files.
 */
export function safeWriteFile(absPath: string, content: string): void {
  assertNotSensitiveWorkspacePath(absPath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  const tmp = path.join(
    path.dirname(absPath),
    `.ccathome-tmp-${crypto.randomBytes(8).toString("hex")}`,
  );
  fs.writeFileSync(tmp, content, "utf-8");
  fs.renameSync(tmp, absPath);
}
