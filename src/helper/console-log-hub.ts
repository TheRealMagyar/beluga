import type { BrowserWindow } from "electron";
import {
  normalizeStreamLogInput,
  type StreamLogEntry,
} from "./stream-log-entry";

export type PlaygroundLogLevel = "info" | "success" | "warn" | "error";

export interface PlaygroundLogEntry {
  id: string;
  level: PlaygroundLogLevel;
  message: string;
  timestamp: number;
}

export interface ConsoleLogSnapshot {
  playground: PlaygroundLogEntry[];
  sui: StreamLogEntry[];
  ika: StreamLogEntry[];
}

const MAX_PLAYGROUND = 2000;
const MAX_LOCALNET = 4000;

let playgroundLogs: PlaygroundLogEntry[] = [];
let suiLogs: StreamLogEntry[] = [];
let ikaLogs: StreamLogEntry[] = [];

type ConsoleLogListener = (snapshot: ConsoleLogSnapshot) => void;
const listeners = new Set<ConsoleLogListener>();

function trim<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  return items.slice(items.length - max);
}

function snapshot(): ConsoleLogSnapshot {
  return {
    playground: [...playgroundLogs],
    sui: [...suiLogs],
    ika: [...ikaLogs],
  };
}

function notify() {
  const current = snapshot();
  for (const listener of listeners) {
    listener(current);
  }
}

export function subscribeConsoleLogs(listener: ConsoleLogListener) {
  listeners.add(listener);
  listener(snapshot());
  return () => listeners.delete(listener);
}

export function getConsoleLogSnapshot(): ConsoleLogSnapshot {
  return snapshot();
}

export function appendPlaygroundLog(
  entry: Omit<PlaygroundLogEntry, "id"> & { id?: string },
) {
  playgroundLogs = trim(
    [
      ...playgroundLogs,
      {
        id: entry.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        level: entry.level,
        message: entry.message,
        timestamp: entry.timestamp,
      },
    ],
    MAX_PLAYGROUND,
  );
  notify();
}

export function setLocalnetLogs(
  source: "sui" | "ika",
  lines: Array<string | StreamLogEntry>,
) {
  const next = trim(normalizeStreamLogInput(lines, source), MAX_LOCALNET);
  if (source === "sui") suiLogs = next;
  else ikaLogs = next;
  notify();
}

export function clearConsoleLogs(
  target: "all" | "playground" | "sui" | "ika" = "all",
) {
  if (target === "all" || target === "playground") playgroundLogs = [];
  if (target === "all" || target === "sui") suiLogs = [];
  if (target === "all" || target === "ika") ikaLogs = [];
  notify();
}

export function attachConsoleLogBroadcaster(getWindows: () => BrowserWindow[]) {
  return subscribeConsoleLogs((state) => {
    const payload = { type: "snapshot" as const, ...state };
    for (const win of getWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send("console:logs-updated", payload);
      }
    }
  });
}

export type { StreamLogEntry };