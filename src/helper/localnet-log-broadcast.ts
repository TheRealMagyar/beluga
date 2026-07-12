import type { StreamLogEntry } from "./stream-log-entry";

export type LocalnetLogSource = "sui" | "ika";

export interface LocalnetLogPayload {
  source: LocalnetLogSource;
  lines: StreamLogEntry[];
}

type LocalnetLogSink = (payload: LocalnetLogPayload) => void;

let sink: LocalnetLogSink | null = null;

export function setLocalnetLogSink(next: LocalnetLogSink | null) {
  sink = next;
}

export function broadcastLocalnetLogs(
  source: LocalnetLogSource,
  lines: StreamLogEntry[],
) {
  sink?.({ source, lines: lines.map((line) => ({ ...line })) });
}