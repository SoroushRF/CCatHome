import * as child_process from "child_process";
import { classifyAndGate, RequiresConfirmationError } from "./permission-gate.js";
import { config } from "./config.js";
import { PermissionTier } from "./constants.js";
import { scrubEnv } from "./scrub-env.js";

export interface GatedRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Executes a shell command directly without passing through the Permission Gate.
 * Only to be used internally by trusted system components (like checkpoint/rollback).
 */
export async function runCommandUngated(command: string): Promise<GatedRunResult> {
  return new Promise((resolve) => {
    const child = child_process.spawn(command, {
      shell: true,
      cwd: config.workspaceRoot,
      env: scrubEnv(process.env),
      stdio: ["ignore", "pipe", "pipe"],
    });

    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    const killTimer = setTimeout(() => {
      child.kill("SIGKILL");
    }, 30_000);

    child.stdout.on("data", (data) => {
      stdoutChunks.push(data.toString());
    });
    child.stderr.on("data", (data) => {
      stderrChunks.push(data.toString());
    });

    child.on("close", (code) => {
      clearTimeout(killTimer);
      resolve({
        stdout: stdoutChunks.join("").trim(),
        stderr: stderrChunks.join("").trim(),
        exitCode: code ?? 0,
      });
    });

    child.on("error", (err) => {
      clearTimeout(killTimer);
      resolve({
        stdout: stdoutChunks.join("").trim(),
        stderr: (stderrChunks.join("") + "\n" + err.message).trim(),
        exitCode: 1,
      });
    });
  });
}

/**
 * Executes a shell command after running it through the central Permission Gate.
 * Throws a permission error if the command is blocked or requires confirmation.
 * Uses child_process.spawn to stream output and avoid buffer memory limit failures.
 */
export async function runCommandGated(command: string): Promise<GatedRunResult> {
  const gateResult = classifyAndGate(command);
  if (!gateResult.allowed) {
    if (gateResult.tier === PermissionTier.TIER_2) {
      throw new RequiresConfirmationError(command, gateResult.tier);
    }
    throw new Error(
      `Permission denied: Command '${command}' was rejected by the Permission Gate (Tier ${gateResult.tier})`,
    );
  }

  return runCommandUngated(command);
}

/**
 * Spawn a binary with argv array (no shell) after gating a display command string.
 */
export async function runArgvGated(
  displayCommand: string,
  file: string,
  argv: string[],
): Promise<GatedRunResult> {
  const gateResult = classifyAndGate(displayCommand);
  if (!gateResult.allowed) {
    if (gateResult.tier === PermissionTier.TIER_2) {
      throw new RequiresConfirmationError(displayCommand, gateResult.tier);
    }
    throw new Error(
      `Permission denied: Command '${displayCommand}' was rejected by the Permission Gate (Tier ${gateResult.tier})`,
    );
  }

  return new Promise((resolve) => {
    const child = child_process.spawn(file, argv, {
      shell: false,
      cwd: config.workspaceRoot,
      env: scrubEnv(process.env),
      stdio: ["ignore", "pipe", "pipe"],
    });

    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    const killTimer = setTimeout(() => {
      child.kill("SIGKILL");
    }, 30_000);

    child.stdout.on("data", (data) => {
      stdoutChunks.push(data.toString());
    });
    child.stderr.on("data", (data) => {
      stderrChunks.push(data.toString());
    });

    child.on("close", (code) => {
      clearTimeout(killTimer);
      resolve({
        stdout: stdoutChunks.join("").trim(),
        stderr: stderrChunks.join("").trim(),
        exitCode: code ?? 0,
      });
    });

    child.on("error", (err) => {
      clearTimeout(killTimer);
      resolve({
        stdout: stdoutChunks.join("").trim(),
        stderr: (stderrChunks.join("") + "\n" + err.message).trim(),
        exitCode: 1,
      });
    });
  });
}
