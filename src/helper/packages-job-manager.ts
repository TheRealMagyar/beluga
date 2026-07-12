import { spawn, type ChildProcess } from "node:child_process";

interface ActiveJob {
  child: ChildProcess;
  cancelled: boolean;
}

const activeJobs = new Map<string, ActiveJob>();

export class JobCancelledError extends Error {
  readonly jobId: string;

  constructor(jobId: string) {
    super(`Job cancelled: ${jobId}`);
    this.name = "JobCancelledError";
    this.jobId = jobId;
  }
}

export function registerJob(jobId: string, child: ChildProcess) {
  activeJobs.set(jobId, { child, cancelled: false });
}

export function unregisterJob(jobId: string) {
  activeJobs.delete(jobId);
}

export function isJobCancelled(jobId: string): boolean {
  return activeJobs.get(jobId)?.cancelled ?? false;
}

export function isJobActive(jobId: string): boolean {
  return activeJobs.has(jobId);
}

export function listActiveJobs(): string[] {
  return [...activeJobs.keys()];
}

export function cancelJob(jobId: string): boolean {
  const entry = activeJobs.get(jobId);
  if (!entry) return false;

  entry.cancelled = true;
  killProcessTree(entry.child, true);
  return true;
}

function killProcessTree(child: ChildProcess, force = false) {
  const signal: NodeJS.Signals = force ? "SIGKILL" : "SIGTERM";

  if (!child.pid) {
    child.kill(signal);
    return;
  }

  if (process.platform === "win32") {
    spawn("taskkill", [
      "/pid",
      String(child.pid),
      "/T",
      force ? "/F" : "",
    ].filter(Boolean));
    return;
  }

  try {
    process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
  }
}