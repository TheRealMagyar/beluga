import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type KillPidResult = "killed" | "eperm" | "missing";

function uniquePids(values: number[]): number[] {
  return [
    ...new Set(
      values.filter((pid) => Number.isFinite(pid) && pid > 0),
    ),
  ];
}

function parsePidLines(output: string): number[] {
  return uniquePids(
    output
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => Number(line.trim())),
  );
}

/** Regex fragment that matches both / and \\ in process command lines. */
export function pathRegexFragment(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[/\\]/g, "[/\\\\]");
}

type WindowsProcessRow = {
  pid: number;
  commandLine: string;
};

const WIN_PROCESS_CACHE_MS = 8_000;
let windowsProcessCache: {
  at: number;
  rows: WindowsProcessRow[];
} | null = null;
let windowsProcessScan: Promise<WindowsProcessRow[]> | null = null;

export function invalidateWindowsProcessCache() {
  windowsProcessCache = null;
  windowsProcessScan = null;
}

function readWindowsProcessRowsSync(): WindowsProcessRow[] {
  const script = [
    "Get-CimInstance Win32_Process -ErrorAction SilentlyContinue",
    "| Where-Object { $_.CommandLine }",
    "| Select-Object ProcessId, CommandLine",
    "| ConvertTo-Json -Compress -Depth 2",
  ].join(" ");

  try {
    const stdout = execFileSync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { timeout: 15_000, maxBuffer: 12 * 1024 * 1024, encoding: "utf-8" },
    );
    if (!stdout.trim()) return [];
    const parsed = JSON.parse(stdout.trim()) as
      | { ProcessId?: number; CommandLine?: string }
      | Array<{ ProcessId?: number; CommandLine?: string }>;
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    return rows
      .map((row) => ({
        pid: Number(row.ProcessId),
        commandLine: String(row.CommandLine ?? ""),
      }))
      .filter((row) => row.pid > 0 && row.commandLine.length > 0);
  } catch {
    return [];
  }
}

async function readWindowsProcessRows(force = false): Promise<WindowsProcessRow[]> {
  if (
    !force &&
    windowsProcessCache &&
    Date.now() - windowsProcessCache.at < WIN_PROCESS_CACHE_MS
  ) {
    return windowsProcessCache.rows;
  }

  if (!force && windowsProcessScan) {
    return windowsProcessScan;
  }

  const script = [
    "Get-CimInstance Win32_Process -ErrorAction SilentlyContinue",
    "| Where-Object { $_.CommandLine }",
    "| Select-Object ProcessId, CommandLine",
    "| ConvertTo-Json -Compress -Depth 2",
  ].join(" ");

  windowsProcessScan = (async () => {
    try {
      const { stdout } = await execFileAsync(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", script],
        { timeout: 15_000, maxBuffer: 12 * 1024 * 1024 },
      );
      if (!stdout.trim()) return [];
      const parsed = JSON.parse(stdout.trim()) as
        | { ProcessId?: number; CommandLine?: string }
        | Array<{ ProcessId?: number; CommandLine?: string }>;
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      const normalized = rows
        .map((row) => ({
          pid: Number(row.ProcessId),
          commandLine: String(row.CommandLine ?? ""),
        }))
        .filter((row) => row.pid > 0 && row.commandLine.length > 0);
      windowsProcessCache = { at: Date.now(), rows: normalized };
      return normalized;
    } catch {
      return windowsProcessCache?.rows ?? [];
    } finally {
      windowsProcessScan = null;
    }
  })();

  return windowsProcessScan;
}

function matchCommandLinePattern(commandLine: string, pattern: string): boolean {
  try {
    return new RegExp(pattern, "i").test(commandLine);
  } catch {
    return commandLine.toLowerCase().includes(pattern.toLowerCase());
  }
}

async function pgrepByPatternUnix(pattern: string): Promise<number[]> {
  try {
    const { stdout } = await execFileAsync("pgrep", ["-f", pattern], {
      timeout: 10_000,
    });
    return parsePidLines(stdout);
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      err.code === 1
    ) {
      return [];
    }
    return [];
  }
}

function pgrepByPatternUnixSync(pattern: string): number[] {
  try {
    const stdout = execFileSync("pgrep", ["-f", pattern], {
      encoding: "utf-8",
      timeout: 10_000,
    });
    return parsePidLines(stdout);
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      err.code === 1
    ) {
      return [];
    }
    return [];
  }
}

function filterWindowsProcessesByPatterns(
  processes: WindowsProcessRow[],
  patterns: string[],
): number[] {
  const found = new Set<number>();
  for (const pattern of patterns) {
    for (const entry of processes) {
      if (matchCommandLinePattern(entry.commandLine, pattern)) {
        found.add(entry.pid);
      }
    }
  }
  return uniquePids([...found]);
}

async function pgrepByPatternWindows(pattern: string): Promise<number[]> {
  const processes = await readWindowsProcessRows();
  return filterWindowsProcessesByPatterns(processes, [pattern]);
}

function pgrepByPatternWindowsSync(pattern: string): number[] {
  const processes = readWindowsProcessRowsSync();
  return filterWindowsProcessesByPatterns(processes, [pattern]);
}

/** One PowerShell scan for many patterns (Windows only). */
export async function pgrepByPatterns(patterns: string[]): Promise<number[]> {
  if (process.platform !== "win32") {
    const found = new Set<number>();
    for (const pattern of patterns) {
      for (const pid of await pgrepByPatternUnix(pattern)) {
        found.add(pid);
      }
    }
    return uniquePids([...found]);
  }
  const processes = await readWindowsProcessRows();
  return filterWindowsProcessesByPatterns(processes, patterns);
}

export function pgrepByPatternsSync(patterns: string[]): number[] {
  if (process.platform !== "win32") {
    const found = new Set<number>();
    for (const pattern of patterns) {
      for (const pid of pgrepByPatternUnixSync(pattern)) {
        found.add(pid);
      }
    }
    return uniquePids([...found]);
  }
  const processes = readWindowsProcessRowsSync();
  return filterWindowsProcessesByPatterns(processes, patterns);
}

export async function pgrepByPattern(pattern: string): Promise<number[]> {
  if (process.platform === "win32") {
    return pgrepByPatternWindows(pattern);
  }
  return pgrepByPatternUnix(pattern);
}

export function pgrepByPatternSync(pattern: string): number[] {
  if (process.platform === "win32") {
    return pgrepByPatternWindowsSync(pattern);
  }
  return pgrepByPatternUnixSync(pattern);
}

async function findListenerPidsOnPortUnix(port: number): Promise<number[]> {
  try {
    const { stdout } = await execFileAsync(
      "lsof",
      ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"],
      { timeout: 5_000 },
    );
    return parsePidLines(stdout);
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      err.code === 1
    ) {
      return [];
    }
    return [];
  }
}

function parseNetstatListeningPids(output: string, port: number): number[] {
  const pids = new Set<number>();
  const portSuffix = `:${port}`;

  for (const line of output.split(/\r?\n/)) {
    if (!/LISTENING/i.test(line)) continue;
    const normalized = line.trim();
    const localEndpoint = normalized.split(/\s+/)[1] ?? "";
    if (!localEndpoint.endsWith(portSuffix)) continue;
    const pid = Number(normalized.split(/\s+/).at(-1));
    if (pid > 0) pids.add(pid);
  }

  return [...pids];
}

async function findListenerPidsOnPortWindows(port: number): Promise<number[]> {
  try {
    const { stdout } = await execFileAsync("netstat", ["-ano"], {
      timeout: 10_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    return parseNetstatListeningPids(stdout, port);
  } catch {
    return [];
  }
}

export async function findListenerPidsOnPort(port: number): Promise<number[]> {
  if (process.platform === "win32") {
    return findListenerPidsOnPortWindows(port);
  }
  return findListenerPidsOnPortUnix(port);
}

export async function getProcessOwner(pid: number): Promise<string | null> {
  if (process.platform === "win32") {
    try {
      const { stdout } = await execFileAsync(
        "tasklist",
        ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"],
        { timeout: 5_000 },
      );
      const line = stdout.trim().split(/\r?\n/)[0] ?? "";
      const match = line.match(/^"([^"]+)"/);
      return match?.[1] ?? null;
    } catch {
      return null;
    }
  }

  try {
    const { stdout } = await execFileAsync(
      "ps",
      ["-p", String(pid), "-o", "user="],
      { timeout: 5_000 },
    );
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

function classifyTaskkillError(stderr: string, message: string): KillPidResult {
  const blob = `${stderr}\n${message}`.toLowerCase();
  if (/not found|no running|no tasks running/.test(blob)) {
    return "missing";
  }
  if (/access is denied|elevated|administrator/.test(blob)) {
    return "eperm";
  }
  return "missing";
}

export async function killProcessTree(
  pid: number,
  force = true,
): Promise<KillPidResult> {
  if (process.platform === "win32") {
    try {
      await execFileAsync(
        "taskkill",
        ["/PID", String(pid), "/T", ...(force ? ["/F"] : [])],
        { timeout: 10_000 },
      );
      return "killed";
    } catch (err: unknown) {
      const stderr =
        err &&
        typeof err === "object" &&
        "stderr" in err &&
        typeof err.stderr === "string"
          ? err.stderr
          : "";
      const message =
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : "";
      return classifyTaskkillError(stderr, message);
    }
  }

  const signal: NodeJS.Signals = force ? "SIGKILL" : "SIGTERM";
  try {
    process.kill(-pid, signal);
    return "killed";
  } catch {
    try {
      process.kill(pid, signal);
      return "killed";
    } catch (killErr: unknown) {
      if (
        killErr &&
        typeof killErr === "object" &&
        "code" in killErr &&
        killErr.code === "EPERM"
      ) {
        return "eperm";
      }
      return "missing";
    }
  }
}

export function killProcessTreeSync(pid: number, force = true): void {
  if (process.platform === "win32") {
    try {
      execFileSync(
        "taskkill",
        ["/PID", String(pid), "/T", ...(force ? ["/F"] : [])],
        { timeout: 10_000 },
      );
    } catch {
      // already exited
    }
    return;
  }

  const signal: NodeJS.Signals = force ? "SIGKILL" : "SIGTERM";
  try {
    process.kill(-pid, signal);
  } catch {
    try {
      process.kill(pid, signal);
    } catch {
      // already exited
    }
  }
}

export async function killPid(pid: number): Promise<KillPidResult> {
  return killProcessTree(pid, true);
}

export function formatElevatedKillHint(
  pids: number[],
  serviceLabel: string,
): string {
  const pidList = pids.join(" ");
  if (process.platform === "win32") {
    return (
      `${serviceLabel} is still running. Beluga could not stop PID ${pidList}. ` +
      `Run in PowerShell as Administrator: taskkill /PID ${pidList} /T /F — then press Start again.`
    );
  }

  return (
    `${serviceLabel} is still running. Beluga cannot stop PID ${pidList} without elevated permissions. ` +
    `Run in Terminal: sudo kill ${pidList} — then press Start again.`
  );
}