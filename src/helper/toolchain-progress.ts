import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import {
  isJobCancelled,
  JobCancelledError,
  registerJob,
  unregisterJob,
} from "./packages-job-manager";

export type ToolchainProgressPhase =
  | "starting"
  | "downloading"
  | "compiling"
  | "linking"
  | "packaging"
  | "extracting"
  | "running"
  | "done"
  | "error";

export interface ToolchainProgressEvent {
  job: string;
  phase: ToolchainProgressPhase;
  percent: number | null;
  message: string;
  detail?: string;
  recentLogs: string[];
}

export type ToolchainProgressEmitter = (event: ToolchainProgressEvent) => void;

const MAX_LOG_LINES = 200;
const MAX_RECENT_LOGS = 40;
const EMIT_THROTTLE_MS = 200;

function createThrottledEmitter(emit: ToolchainProgressEmitter) {
  let lastEmitAt = 0;
  let pending: ToolchainProgressEvent | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (!pending) return;
    const event = pending;
    pending = null;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    lastEmitAt = Date.now();
    emit(event);
  };

  const throttledEmit: ToolchainProgressEmitter = (event) => {
    const immediate =
      event.phase === "starting" ||
      event.phase === "done" ||
      event.phase === "error";

    if (immediate) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      pending = null;
      lastEmitAt = Date.now();
      emit(event);
      return;
    }

    pending = event;
    const elapsed = Date.now() - lastEmitAt;
    if (elapsed >= EMIT_THROTTLE_MS) {
      flush();
      return;
    }

    if (!timer) {
      timer = setTimeout(flush, EMIT_THROTTLE_MS - elapsed);
    }
  };

  return { emit: throttledEmit, flush };
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function isCargoNoiseLine(line: string): boolean {
  return /MallocStackLogging|can't turn off malloc stack logging/i.test(line);
}

export function parseCargoProgressLine(line: string): Partial<ToolchainProgressEvent> {
  const trimmed = line.trim();
  if (!trimmed) return {};
  if (isCargoNoiseLine(trimmed)) return {};

  const building = trimmed.match(/Building\s+\[[^\]]*\]\s+(\d+)\/(\d+)/i);
  if (building) {
    const current = Number(building[1]);
    const total = Number(building[2]);
    if (total > 0) {
      const linkingIkaBin = /ika\(bin\)/i.test(trimmed);
      const linking = current >= total || linkingIkaBin;
      return {
        phase: linking ? "linking" : "compiling",
        percent: clampPercent((current / total) * 100),
        message: trimmed,
        detail: linkingIkaBin
          ? process.platform === "win32"
            ? "Linking ika.exe (final step — can take 5–15 min on Windows)"
            : "Linking ika CLI binary (final step — can take 2–10 min on macOS)"
          : linking
            ? `Linking ${current} of ${total} crates`
            : `Compiled ${current} of ${total} crates`,
      };
    }
  }

  if (/Blocking waiting for file lock/i.test(trimmed)) {
    return {
      phase: "running",
      percent: null,
      message: trimmed,
      detail:
        "Another cargo build is using the artifact directory. Cancel, wait, or stale processes will be cleaned up on retry.",
    };
  }

  const gitProgress = trimmed.match(
    /^\s*(Fetch|Checkout)\s+\[[#=>.\s-]+\]\s+(\d+(?:\.\d+)?)%/i,
  );
  if (gitProgress) {
    const action = gitProgress[1];
    const percent = clampPercent(Number(gitProgress[2]));
    return {
      phase: "downloading",
      percent,
      message: trimmed,
      detail:
        action.toLowerCase() === "checkout"
          ? "Checking out a large git dependency (e.g. MystenLabs/sui). First Ika build can take 30–60 min on Windows — keep Beluga open."
          : "Downloading git dependencies for Ika. Large repos are normal on the first build.",
    };
  }

  if (/Updating git (repository|submodule)/i.test(trimmed)) {
    return {
      phase: "downloading",
      percent: null,
      message: trimmed,
      detail:
        "Fetching git dependencies (MystenLabs/sui and others). This phase is slow but expected — do not cancel.",
    };
  }

  if (/Downloading|Updating crates\.io/i.test(trimmed)) {
    return {
      phase: "downloading",
      percent: null,
      message: trimmed,
    };
  }

  if (/Compiling/i.test(trimmed)) {
    const crate = trimmed.replace(/^Compiling\s+/i, "");
    return {
      phase: "compiling",
      percent: null,
      message: trimmed,
      detail: crate,
    };
  }

  if (/Finished\s+(release|dev)/i.test(trimmed)) {
    return {
      phase: "linking",
      percent: 98,
      message: trimmed,
    };
  }

  if (/error(\[E\d+\]|:)/i.test(trimmed) || /^failed to compile/i.test(trimmed)) {
    return {
      phase: "error",
      percent: null,
      message: trimmed,
    };
  }

  return {
    phase: "running",
    percent: null,
    message: trimmed,
  };
}

export function parseGitProgressLine(line: string): Partial<ToolchainProgressEvent> {
  const trimmed = line.trim();
  if (!trimmed) return {};

  const percentMatch = trimmed.match(/(\d+)%/);
  if (percentMatch) {
    return {
      phase: "downloading",
      percent: clampPercent(Number(percentMatch[1])),
      message: trimmed,
    };
  }

  if (/Cloning into|Receiving objects|Resolving deltas|Checking out/i.test(trimmed)) {
    return {
      phase: "downloading",
      percent: null,
      message: trimmed,
    };
  }

  return {
    phase: "running",
    percent: null,
    message: trimmed,
  };
}

export function parseGenericProgressLine(line: string): Partial<ToolchainProgressEvent> {
  const trimmed = line.trim();
  if (!trimmed) return {};
  return {
    phase: "running",
    percent: null,
    message: trimmed,
  };
}

interface RunProcessOptions {
  job: string;
  command: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  parseLine?: (line: string) => Partial<ToolchainProgressEvent>;
  startMessage: string;
}

export async function runProcessWithProgress(
  options: RunProcessOptions,
  emit: ToolchainProgressEmitter,
): Promise<{ code: number | null; stdout: string; stderr: string; logs: string[] }> {
  const logs: string[] = [];
  let stdout = "";
  let stderr = "";
  const { emit: throttledEmit, flush: flushProgress } = createThrottledEmitter(emit);

  const push = (chunk: string, stream: "stdout" | "stderr") => {
    if (stream === "stdout") stdout += chunk;
    else stderr += chunk;

    const lines = chunk.split(/\r|\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      logs.push(line);
      if (logs.length > MAX_LOG_LINES) logs.splice(0, logs.length - MAX_LOG_LINES);

      const parsed = (options.parseLine ?? parseGenericProgressLine)(line);
      if (Object.keys(parsed).length === 0) continue;

      throttledEmit({
        job: options.job,
        phase: parsed.phase ?? "running",
        percent: parsed.percent ?? null,
        message: parsed.message ?? line,
        detail: parsed.detail,
        recentLogs: logs.slice(-MAX_RECENT_LOGS),
      });
    }
  };

  throttledEmit({
    job: options.job,
    phase: "starting",
    percent: 0,
    message: options.startMessage,
    recentLogs: [],
  });

  const useDetached = process.platform !== "win32";
  const child: ChildProcessWithoutNullStreams = spawn(options.command, options.args, {
    cwd: options.cwd,
    env: options.env,
    detached: useDetached,
    stdio: ["ignore", "pipe", "pipe"],
  });

  registerJob(options.job, child);

  child.stdout.on("data", (chunk) => push(chunk.toString(), "stdout"));
  child.stderr.on("data", (chunk) => push(chunk.toString(), "stderr"));

  const code = await new Promise<number | null>((resolve, reject) => {
    child.on("error", (err) => {
      unregisterJob(options.job);
      reject(err);
    });
    child.on("close", (exitCode) => {
      unregisterJob(options.job);
      flushProgress();
      resolve(exitCode);
    });
  });

  if (isJobCancelled(options.job)) {
    emit({
      job: options.job,
      phase: "error",
      percent: null,
      message: "Cancelled by user",
      recentLogs: logs.slice(-MAX_RECENT_LOGS),
    });
    throw new JobCancelledError(options.job);
  }

  return { code, stdout, stderr, logs };
}

export function emitDone(
  emit: ToolchainProgressEmitter,
  job: string,
  success: boolean,
  message: string,
  logs: string[],
) {
  emit({
    job,
    phase: success ? "done" : "error",
    percent: success ? 100 : null,
    message,
    recentLogs: logs.slice(-MAX_RECENT_LOGS),
  });
}