import * as child_process from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { z } from "zod";
import { PermissionTier, CapabilityName, StepStatus, CommandStatus } from "../../core/constants.js";
import { CapabilityDefinition } from "../../core/router.js";
import { classifyAndGate } from "../../core/permission-gate.js";
import { config } from "../../core/config.js";
import { registerProcess } from "../../core/process-registry.js";
import { scrubEnv } from "../../core/scrub-env.js";
import { tailLines } from "../../core/context-manager.js";
import { getDb } from "../../core/db.js";

export const runCommandDefinition: CapabilityDefinition = {
  name: CapabilityName.RUN_COMMAND,
  description:
    "Runs an ad-hoc shell command. Short-lived commands return output capped for context management. Long-running commands (like dev servers) run in the background and return process information.",
  inputSchema: z.object({
    command: z.string().describe("The shell command to execute"),
    timeoutMs: z
      .number()
      .optional()
      .describe(
        "Timeout in milliseconds before considering it a background process (default 10000)",
      ),
    readinessPattern: z
      .string()
      .optional()
      .describe(
        "Optional regex pattern. If matched in stdout, the command returns immediately with status 'ready'",
      ),
  }),
  tier: PermissionTier.TIER_1, // Tier 1: Workspace writes / executions
};

const MAX_READINESS_PATTERN_LENGTH = 200;

export async function runCommandHandler(args: {
  command: string;
  timeoutMs?: number;
  readinessPattern?: string;
}): Promise<{
  success: boolean;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  logId?: string;
  pid?: number;
  status?: "ready" | "timeout" | "exited";
  logPath?: string;
  recentOutput?: string;
  error?: string;
  reason?: string;
}> {
  // 1. Central Permission Gate Check
  const gateResult = classifyAndGate(args.command);
  if (!gateResult.allowed) {
    if (gateResult.tier === PermissionTier.TIER_3) {
      return {
        success: false,
        error: "permission_denied",
        reason: "Command contains Tier 3 blocked patterns",
      };
    }
    return {
      success: false,
      error: StepStatus.REQUIRES_CONFIRMATION,
      reason: "Command is classified as Tier 2 and requires approval",
    };
  }

  if (args.readinessPattern && args.readinessPattern.length > MAX_READINESS_PATTERN_LENGTH) {
    return {
      success: false,
      error: "invalid_readiness_pattern",
      reason: `readinessPattern exceeds max length of ${MAX_READINESS_PATTERN_LENGTH}`,
    };
  }

  const logsDir = path.join(config.workspaceRoot, ".ccathome", "logs");
  try {
    fs.mkdirSync(logsDir, { recursive: true });
  } catch (err: any) {
    return {
      success: false,
      error: "log_setup_failed",
      reason: err.message,
    };
  }

  const logId = crypto.randomBytes(8).toString("hex");
  const logPath = path.join(logsDir, `cmd_${logId}.log`);
  const logStream = fs.createWriteStream(logPath, { flags: "a" });

  const timeout = args.timeoutMs || 10000;
  const command = args.command;

  // Use shell options to invoke standard shell depending on OS (cmd.exe on Windows, sh on POSIX)
  const child = child_process.spawn(command, {
    shell: true,
    cwd: config.workspaceRoot,
    env: scrubEnv(process.env),
  });

  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  let didExit = false;

  child.stdout.on("data", (data) => {
    const chunk = data.toString();
    logStream.write(chunk);
    stdoutLines.push(chunk);
  });

  child.stderr.on("data", (data) => {
    const chunk = data.toString();
    logStream.write(chunk);
    stderrLines.push(chunk);
  });

  return new Promise((resolve) => {
    let resolved = false;
    let checkInterval: NodeJS.Timeout | null = null;

    const endLogStream = (): Promise<void> =>
      new Promise((resolveEnd) => {
        if (logStream.writableEnded) {
          // end() already called; wait for finish if needed
          if (logStream.writableFinished) {
            resolveEnd();
          } else {
            logStream.once("finish", () => resolveEnd());
          }
          return;
        }
        logStream.end(() => resolveEnd());
      });

    const getCappedOutput = (arr: string[]) => tailLines(arr.join(""), 20);

    const upsertCommandLog = (status: string, pid?: number) => {
      try {
        const db = getDb();
        db.prepare(
          `
          INSERT INTO command_log (id, pid, log_path, status)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET pid = excluded.pid, status = excluded.status
        `,
        ).run(logId, pid ?? null, logPath, status);
      } catch {
        // DB optional in early tests
      }
    };

    // Prefer 'close' over 'exit' so all stdio 'data' events are delivered first
    child.on("close", (code) => {
      didExit = true;
      if (checkInterval) clearInterval(checkInterval);

      void endLogStream().then(() => {
        if (!resolved) {
          resolved = true;
          upsertCommandLog(CommandStatus.EXITED, child.pid);
          resolve({
            success: (code ?? 0) === 0,
            status: "exited",
            stdout: getCappedOutput(stdoutLines),
            stderr: getCappedOutput(stderrLines),
            exitCode: code ?? 0,
            logId,
          });
        }
      });
    });

    child.on("error", (err) => {
      void endLogStream().then(() => {
        if (!resolved) {
          resolved = true;
          resolve({
            success: false,
            error: "spawn_failed",
            reason: err.message,
          });
        }
      });
    });

    // Check readiness pattern if provided
    if (args.readinessPattern) {
      const regex = new RegExp(args.readinessPattern);
      checkInterval = setInterval(() => {
        const currentStdout = stdoutLines.join("");
        if (regex.test(currentStdout)) {
          if (checkInterval) clearInterval(checkInterval);
          if (!resolved) {
            resolved = true;
            // Register active background process
            const activeProc = {
              pid: child.pid!,
              process: child,
              logPath,
              command,
              startedAt: new Date(),
            };
            registerProcess(child.pid!, activeProc);
            upsertCommandLog(CommandStatus.READY, child.pid);
            resolve({
              success: true,
              pid: child.pid,
              status: "ready",
              logId,
              logPath,
              recentOutput: getCappedOutput(stdoutLines),
            });
          }
        }
      }, 100);
    }

    // Timeout fallback for background consideration
    setTimeout(() => {
      if (checkInterval) clearInterval(checkInterval);
      if (!didExit && !resolved) {
        resolved = true;
        // Register active background process
        const activeProc = {
          pid: child.pid!,
          process: child,
          logPath,
          command,
          startedAt: new Date(),
        };
        registerProcess(child.pid!, activeProc);
        upsertCommandLog(CommandStatus.RUNNING, child.pid);
        resolve({
          success: true,
          pid: child.pid,
          status: "timeout",
          logId,
          logPath,
          recentOutput: getCappedOutput(stdoutLines),
        });
      }
    }, timeout);
  });
}
