import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { getManagedSuiBinary, toolchainEnv, warmToolchainBinaries } from "./sui-toolchain";
import { getPlaygroundWorkspace } from "./playground-cli";

export interface TerminalSessionInfo {
  id: string;
  cwd: string;
  shell: string;
  createdAt: number;
}

type PtyProcess = {
  onData: (listener: (data: string) => void) => void;
  onExit: (listener: (event: { exitCode: number }) => void) => void;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
};

type PtyModule = {
  spawn: (
    file: string,
    args: string[] | string,
    options: {
      name: string;
      cols: number;
      rows: number;
      cwd: string;
      env: Record<string, string>;
    },
  ) => PtyProcess;
};

type TerminalOutputListener = (
  sessionId: string,
  data: string,
  stream: "stdout" | "stderr",
) => void;

type TerminalExitListener = (sessionId: string, code: number | null) => void;

const sessions = new Map<
  string,
  {
    proc: PtyProcess;
    info: TerminalSessionInfo;
  }
>();

let outputListener: TerminalOutputListener | null = null;
let exitListener: TerminalExitListener | null = null;
let ptyModule: PtyModule | null = null;
let ptyLoadError: string | null = null;

async function loadPty(): Promise<PtyModule> {
  if (ptyModule) return ptyModule;
  if (ptyLoadError) {
    throw new Error(
      `Terminal support is unavailable in this build (${ptyLoadError}). Rebuild with: npm run make`,
    );
  }

  try {
    const imported = (await import("node-pty")) as PtyModule;
    ptyModule = imported;
    return imported;
  } catch (err: unknown) {
    ptyLoadError =
      err instanceof Error ? err.message : "Could not load node-pty module.";
    throw new Error(
      `Terminal support is unavailable in this build (${ptyLoadError}). Rebuild with: npm run make`,
    );
  }
}

export function setTerminalListeners(options: {
  onOutput?: TerminalOutputListener | null;
  onExit?: TerminalExitListener | null;
}) {
  outputListener = options.onOutput ?? null;
  exitListener = options.onExit ?? null;
}

function resolveShell(): string {
  if (process.env.SHELL) return process.env.SHELL;
  return process.platform === "win32" ? "powershell.exe" : "/bin/zsh";
}

function buildTerminalEnv(shell: string): Record<string, string> {
  const toolchain = toolchainEnv();
  const home = toolchain.HOME || os.homedir();
  const user =
    toolchain.USER ||
    toolchain.LOGNAME ||
    toolchain.USERNAME ||
    os.userInfo().username;
  const pathEnv =
    toolchain.PATH ||
    process.env.PATH ||
    process.env.Path ||
    (process.platform === "win32"
      ? "C:\\Windows\\system32;C:\\Windows"
      : "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin");
  const tmpDir = toolchain.TMPDIR || toolchain.TEMP || os.tmpdir();

  // GUI-launched .app bundles often lack HOME/PATH — node-pty crashes without them.
  return {
    ...toolchain,
    HOME: home,
    USER: user,
    LOGNAME: user,
    USERNAME: toolchain.USERNAME || user,
    PATH: pathEnv,
    TMPDIR: tmpDir,
    TEMP: tmpDir,
    TMP: tmpDir,
    TERM: "xterm-256color",
    COLORTERM: "truecolor",
    BELUGA_CONSOLE: "1",
    ZSH_DISABLE_COMPFIX: "true",
    SHELL: shell,
  };
}

async function ensureWorkspaceDir(cwd: string): Promise<string> {
  await fs.mkdir(cwd, { recursive: true });
  return cwd;
}

function shellArgs(shell: string): string[] {
  const base = path.basename(shell).toLowerCase();
  if (base === "powershell.exe" || base === "pwsh" || base === "pwsh.exe") {
    return ["-NoLogo"];
  }
  if (base === "cmd.exe") return [];
  if (base === "zsh" || base === "bash") return ["-i"];
  return [];
}

export async function createTerminalSession(
  cwd?: string,
  size?: { cols: number; rows: number },
): Promise<TerminalSessionInfo> {
  try {
    await warmToolchainBinaries();
    const pty = await loadPty();
    const workspace = await ensureWorkspaceDir(
      cwd ?? (await getPlaygroundWorkspace()),
    );
    const shell = resolveShell();
    const id = randomUUID();
    const cols = Math.max(size?.cols ?? 120, 20);
    const rows = Math.max(size?.rows ?? 32, 5);

    const env = buildTerminalEnv(shell);
    if (!env.HOME?.trim()) {
      throw new Error("Terminal cannot start: HOME is not set.");
    }

    const proc = pty.spawn(shell, shellArgs(shell), {
      name: "xterm-256color",
      cols,
      rows,
      cwd: workspace,
      env,
    });

    const info: TerminalSessionInfo = {
      id,
      cwd: workspace,
      shell: path.basename(shell),
      createdAt: Date.now(),
    };

    proc.onData((data) => {
      outputListener?.(id, data, "stdout");
    });
    proc.onExit(({ exitCode }) => {
      sessions.delete(id);
      exitListener?.(id, exitCode);
    });

    sessions.set(id, { proc, info });

    const managedSui = await getManagedSuiBinary();
    if (managedSui.includes(path.sep)) {
      const managedDir = path.dirname(managedSui);
      proc.write(
        process.platform === "win32"
          ? `$env:Path = '${managedDir};' + $env:Path\r\n`
          : `export PATH='${managedDir}:$PATH'\n`,
      );
    }

    return info;
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Could not start terminal session.";
    throw new Error(message);
  }
}

export function writeTerminalInput(sessionId: string, data: string): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;
  try {
    session.proc.write(data);
    return true;
  } catch {
    return false;
  }
}

export function resizeTerminal(sessionId: string, cols: number, rows: number) {
  const session = sessions.get(sessionId);
  if (!session) return;
  try {
    session.proc.resize(
      Math.max(cols, 20),
      Math.max(rows, 5),
    );
  } catch {
    // ignore resize errors during teardown
  }
}

export function killTerminalSession(sessionId: string): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;
  try {
    session.proc.kill();
  } catch {
    // already dead
  }
  sessions.delete(sessionId);
  return true;
}

export function listTerminalSessions(): TerminalSessionInfo[] {
  return [...sessions.values()].map((entry) => entry.info);
}

export function getDefaultShellLabel(): string {
  return path.basename(resolveShell());
}