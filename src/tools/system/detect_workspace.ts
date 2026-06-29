import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { PermissionTier, CapabilityName } from "../../core/constants.js";
import { CapabilityDefinition } from "../../core/router.js";
import { config } from "../../core/config.js";

export const detectWorkspaceDefinition: CapabilityDefinition = {
  name: CapabilityName.DETECT_WORKSPACE,
  description: "Detects the project structure of the workspace, dynamically switching target workspace if path is specified.",
  inputSchema: z.object({
    path: z.string().optional().describe("Optional absolute path to dynamically switch the workspace target root to"),
  }),
  tier: PermissionTier.TIER_0, // Tier 0: allowed (read-only inspect)
};

export async function detectWorkspaceHandler(args: {
  path?: string;
}): Promise<{
  success: boolean;
  language: string;
  runtime: string;
  packageManager: string;
  entryPoints: string[];
  dependencies: Record<string, string>;
}> {
  if (args.path) {
    config.workspaceRoot = path.resolve(args.path);
  }
  const root = config.workspaceRoot;
  let language = "unknown";
  let runtime = "unknown";
  let packageManager = "unknown";
  const entryPoints: string[] = [];
  let dependencies: Record<string, string> = {};

  try {
    // 1. Detect Node/JS/TS Project
    const packageJsonPath = path.join(root, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      runtime = "node";
      language = "javascript";
      
      const pkgData = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
      dependencies = {
        ...(pkgData.dependencies || {}),
        ...(pkgData.devDependencies || {}),
      };

      if (pkgData.main) {
        entryPoints.push(pkgData.main);
      }

      if (fs.existsSync(path.join(root, "tsconfig.json"))) {
        language = "typescript";
      }

      // Check package manager lockfiles
      if (fs.existsSync(path.join(root, "package-lock.json"))) {
        packageManager = "npm";
      } else if (fs.existsSync(path.join(root, "yarn.lock"))) {
        packageManager = "yarn";
      } else if (fs.existsSync(path.join(root, "pnpm-lock.yaml"))) {
        packageManager = "pnpm";
      } else {
        packageManager = "npm"; // Default fallback
      }
    }

    // 2. Detect Rust Project
    const cargoTomlPath = path.join(root, "Cargo.toml");
    if (fs.existsSync(cargoTomlPath)) {
      language = "rust";
      runtime = "rust";
      packageManager = "cargo";
      if (fs.existsSync(path.join(root, "src", "main.rs"))) {
        entryPoints.push("src/main.rs");
      }
      if (fs.existsSync(path.join(root, "src", "lib.rs"))) {
        entryPoints.push("src/lib.rs");
      }
    }

    // 3. Detect Python Project
    const reqTxtPath = path.join(root, "requirements.txt");
    const pyprojectPath = path.join(root, "pyproject.toml");
    const setupPyPath = path.join(root, "setup.py");
    if (fs.existsSync(reqTxtPath) || fs.existsSync(pyprojectPath) || fs.existsSync(setupPyPath)) {
      language = "python";
      runtime = "python";
      packageManager = fs.existsSync(pyprojectPath) ? "poetry/pip" : "pip";
      
      if (fs.existsSync(path.join(root, "main.py"))) {
        entryPoints.push("main.py");
      } else if (fs.existsSync(path.join(root, "app.py"))) {
        entryPoints.push("app.py");
      }
    }

    // Fallback search for common files in src/ if entryPoints is empty
    if (entryPoints.length === 0) {
      const commonSrc = path.join(root, "src");
      if (fs.existsSync(commonSrc)) {
        const files = fs.readdirSync(commonSrc);
        for (const file of files) {
          if (file.match(/^(index|main|app)\.(ts|js|py|rs)$/)) {
            entryPoints.push(path.join("src", file));
          }
        }
      }
    }
  } catch (_e) {
    // ignore errors, return fallback
  }

  return {
    success: true,
    language,
    runtime,
    packageManager,
    entryPoints,
    dependencies,
  };
}
