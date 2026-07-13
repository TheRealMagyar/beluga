import type { StreamLogEntry } from "./stream-log-entry";

export type LocalnetLogSource = "sui" | "ika";

export interface LocalnetLogPayload {
  source: LocalnetLogSource;
  lines: StreamLogEntry[];
}

type LocalnetLogSink = (payload: LocalnetLogPayload) => void;

let sink: LocalnetLogSink | null = null;

const BROADCAST_THROTTLE_MS =
  process.platform === "win32" ? 250 : 120;

const pending = new Map<LocalnetLogSource, StreamLogEntry[]>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export function setLocalnetLogSink(next: LocalnetLogSink | null) {
  sink = next;
  if (!next) {
    pending.clear();
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
  }
}

function flushLocalnetLogBroadcast() {
  flushTimer = null;
  if (!sink) {
    pending.clear();
    return;
  }
  for (const [source, lines] of pending.entries()) {
    sink({ source, lines: lines.map((line) => ({ ...line })) });
  }
  pending.clear();
}

export function broadcastLocalnetLogs(
  source: LocalnetLogSource,
  lines: StreamLogEntry[],
) {
  pending.set(source, lines);
  if (flushTimer) return;
  flushTimer = setTimeout(flushLocalnetLogBroadcast, BROADCAST_THROTTLE_MS);
}

export function flushLocalnetLogsNow() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  flushLocalnetLogBroadcast();
}