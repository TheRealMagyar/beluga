import { ipcMain } from "electron";
import {
  appendPlaygroundLog,
  clearConsoleLogs,
  getConsoleLogSnapshot,
} from "../helper/console-log-hub";
import {
  createTerminalSession,
  killTerminalSession,
  listTerminalSessions,
  resizeTerminal,
  writeTerminalInput,
} from "../helper/console-terminal";
import { getIkaLocalnetLogSnapshot } from "../helper/ika-localnet";
import { getPlaygroundWorkspace } from "../helper/playground-cli";
import { getSuiLocalnetLogSnapshot } from "../helper/sui-client-manager";
import { setLocalnetLogs } from "../helper/console-log-hub";
import { getConsoleWindow, openConsoleWindow } from "../main/console-window";
import { getMainWindow } from "../main/app-state";

export function registerConsoleIpc() {
  ipcMain.handle("console:open", async () => {
    setLocalnetLogs("sui", getSuiLocalnetLogSnapshot());
    setLocalnetLogs("ika", getIkaLocalnetLogSnapshot());
    openConsoleWindow();
    return { ok: true };
  });

  ipcMain.handle("console:get-snapshot", async () => getConsoleLogSnapshot());

  ipcMain.handle(
    "console:append-playground-log",
    async (
      _event,
      entry: {
        id?: string;
        level: "info" | "success" | "warn" | "error";
        message: string;
        timestamp: number;
      },
    ) => {
      appendPlaygroundLog(entry);
      return { ok: true };
    },
  );

  ipcMain.handle(
    "console:clear-logs",
    async (_event, { target }: { target?: "all" | "playground" | "sui" | "ika" }) => {
      clearConsoleLogs(target ?? "all");
      return { ok: true };
    },
  );

  ipcMain.handle("console:get-workspace", async () => getPlaygroundWorkspace());

  ipcMain.handle(
    "console:terminal-create",
    async (
      _event,
      size?: { cols: number; rows: number },
    ) => {
      try {
        return await createTerminalSession(undefined, size);
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "Terminal session could not be started.";
        throw new Error(message);
      }
    },
  );

  ipcMain.handle("console:terminal-list", async () => listTerminalSessions());

  ipcMain.handle(
    "console:terminal-write",
    async (_event, { sessionId, data }: { sessionId: string; data: string }) => {
      const ok = writeTerminalInput(sessionId, data);
      if (!ok) throw new Error("Terminal session not found or not writable.");
      return { ok: true };
    },
  );

  ipcMain.handle(
    "console:terminal-kill",
    async (_event, { sessionId }: { sessionId: string }) => {
      killTerminalSession(sessionId);
      return { ok: true };
    },
  );

  ipcMain.handle(
    "console:terminal-resize",
    async (
      _event,
      {
        sessionId,
        cols,
        rows,
      }: { sessionId: string; cols: number; rows: number },
    ) => {
      resizeTerminal(sessionId, cols, rows);
      return { ok: true };
    },
  );

  ipcMain.handle("console-window-minimize", () => {
    getConsoleWindow()?.minimize();
  });
  ipcMain.handle("console-window-maximize", () => {
    const win = getConsoleWindow();
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.handle("console-window-close", () => {
    getConsoleWindow()?.close();
  });
  ipcMain.handle(
    "console-window-is-maximized",
    () => getConsoleWindow()?.isMaximized() ?? false,
  );
}

const TERMINAL_BATCH_MS = process.platform === "win32" ? 40 : 24;
const terminalBatch = new Map<
  string,
  { stdout: string; stderr: string; timer: ReturnType<typeof setTimeout> | null }
>();

function flushTerminalBatch(sessionId: string) {
  const entry = terminalBatch.get(sessionId);
  if (!entry) return;
  if (entry.timer) {
    clearTimeout(entry.timer);
    entry.timer = null;
  }
  const { stdout, stderr } = entry;
  entry.stdout = "";
  entry.stderr = "";
  for (const win of [getMainWindow(), getConsoleWindow()]) {
    if (win && !win.isDestroyed()) {
      if (stdout) {
        win.webContents.send("console:terminal-data", {
          sessionId,
          data: stdout,
          stream: "stdout",
        });
      }
      if (stderr) {
        win.webContents.send("console:terminal-data", {
          sessionId,
          data: stderr,
          stream: "stderr",
        });
      }
    }
  }
}

export function broadcastTerminalOutput(
  sessionId: string,
  data: string,
  stream: "stdout" | "stderr",
) {
  let entry = terminalBatch.get(sessionId);
  if (!entry) {
    entry = { stdout: "", stderr: "", timer: null };
    terminalBatch.set(sessionId, entry);
  }
  if (stream === "stderr") entry.stderr += data;
  else entry.stdout += data;
  if (entry.timer) return;
  entry.timer = setTimeout(() => flushTerminalBatch(sessionId), TERMINAL_BATCH_MS);
}

export function broadcastTerminalExit(sessionId: string, code: number | null) {
  for (const win of [getMainWindow(), getConsoleWindow()]) {
    if (win && !win.isDestroyed()) {
      win.webContents.send("console:terminal-exit", { sessionId, code });
    }
  }
}