import { afterEach } from "vitest";
import { config } from "../core/config.js";
import { resetRulesCache } from "../core/permission-gate.js";

const ORIGINAL_WORKSPACE_ROOT = process.cwd();

/**
 * Global teardown: restore mutable config polluted by suites (R7.1.3).
 * Individual suites still own their temp dirs and DB close/reset.
 */
afterEach(() => {
  config.workspaceRoot = ORIGINAL_WORKSPACE_ROOT;
  resetRulesCache();
});
