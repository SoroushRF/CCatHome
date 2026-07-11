import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { config } from "../../core/config.js";
import { clearRegistry, registerCapability } from "../../core/router.js";
import { invoke } from "../../core/dispatcher.js";
import { openProjectDefinition, openProjectHandler } from "./open_project.js";
import { approveCommandForTests } from "../../test/approve-command.js";
import { closeDb } from "../../core/db.js";
import { resetRulesCache } from "../../core/permission-gate.js";

const BASE = path.resolve(process.cwd(), "temp_open_project_test");

describe("open_project / workspace retarget", () => {
  const prevAllow = process.env.CCATHOME_WORKSPACE_ALLOWLIST;

  beforeEach(() => {
    resetRulesCache();
    clearRegistry();
    closeDb();
    if (fs.existsSync(BASE)) fs.rmSync(BASE, { recursive: true, force: true });
    fs.mkdirSync(BASE, { recursive: true });
    config.workspaceRoot = BASE;
    config.initialWorkspaceRoot = BASE;
    registerCapability(openProjectDefinition, openProjectHandler);
  });

  afterEach(() => {
    closeDb();
    if (prevAllow === undefined) delete process.env.CCATHOME_WORKSPACE_ALLOWLIST;
    else process.env.CCATHOME_WORKSPACE_ALLOWLIST = prevAllow;
    if (fs.existsSync(BASE)) fs.rmSync(BASE, { recursive: true, force: true });
    config.workspaceRoot = process.cwd();
    config.initialWorkspaceRoot = process.cwd();
    resetRulesCache();
  });

  it("returns directory_not_found for missing paths", async () => {
    const res = await invoke("open_project", { path: path.join(BASE, "missing") });
    expect(res.result.success).toBe(false);
    expect(res.result.error).toBe("directory_not_found");
  });

  it("returns not_a_directory for files", async () => {
    const file = path.join(BASE, "file.txt");
    fs.writeFileSync(file, "x");
    const res = await invoke("open_project", { path: file });
    expect(res.result.success).toBe(false);
    expect(res.result.error).toBe("not_a_directory");
  });

  it("allows retarget within initial tree", async () => {
    const child = path.join(BASE, "child");
    fs.mkdirSync(child);
    const res = await invoke("open_project", { path: child });
    expect(res.result.success).toBe(true);
    expect(config.workspaceRoot).toBe(fs.realpathSync(child));
  });

  it("requires confirmation outside allowed tree", async () => {
    const outside = path.resolve(process.cwd(), "temp_open_project_outside");
    fs.mkdirSync(outside, { recursive: true });
    try {
      const res = await invoke("open_project", { path: outside });
      expect(res.result.success).toBe(false);
      expect(res.result.error).toBe("requires_confirmation");
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  it("allows outside tree when approved", async () => {
    const outside = path.resolve(process.cwd(), "temp_open_project_outside2");
    fs.mkdirSync(outside, { recursive: true });
    try {
      const real = fs.realpathSync(outside);
      approveCommandForTests(`open_project ${real}`, null, 2);
      const res = await invoke("open_project", { path: outside });
      expect(res.result.success).toBe(true);
      expect(config.workspaceRoot).toBe(real);
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  it("respects CCATHOME_WORKSPACE_ALLOWLIST", async () => {
    const allowed = path.resolve(process.cwd(), "temp_open_project_allow");
    fs.mkdirSync(allowed, { recursive: true });
    process.env.CCATHOME_WORKSPACE_ALLOWLIST = allowed;
    try {
      const res = await invoke("open_project", { path: allowed });
      expect(res.result.success).toBe(true);
      expect(config.workspaceRoot).toBe(fs.realpathSync(allowed));
    } finally {
      fs.rmSync(allowed, { recursive: true, force: true });
    }
  });
});
