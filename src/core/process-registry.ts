import { ChildProcess } from "child_process";

export interface ActiveProcess {
  pid: number;
  process: ChildProcess;
  logPath: string;
  command: string;
  startedAt: Date;
}

const activeProcesses = new Map<number, ActiveProcess>();

export function registerProcess(pid: number, proc: ActiveProcess): void {
  activeProcesses.set(pid, proc);
}

export function getProcess(pid: number): ActiveProcess | undefined {
  return activeProcesses.get(pid);
}

export function removeProcess(pid: number): void {
  activeProcesses.delete(pid);
}

export function getAllProcesses(): ActiveProcess[] {
  return Array.from(activeProcesses.values());
}

export function killAllProcesses(): void {
  for (const proc of activeProcesses.values()) {
    try {
      proc.process.kill("SIGKILL");
    } catch (_err) {
      // Ignore kill errors on teardown
    }
  }
  activeProcesses.clear();
}
