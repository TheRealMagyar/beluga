import { randomUUID } from "node:crypto";

export interface StreamLogEntry {
  id: string;
  message: string;
  timestamp: number;
}

export function createStreamLogEntry(message: string): StreamLogEntry {
  return {
    id: randomUUID(),
    message,
    timestamp: Date.now(),
  };
}

export function streamLogMessages(entries: StreamLogEntry[]): string[] {
  return entries.map((entry) => entry.message);
}

export function normalizeStreamLogInput(
  lines: Array<string | StreamLogEntry>,
  source: string,
): StreamLogEntry[] {
  const base = Date.now();
  return lines.map((line, index) => {
    if (typeof line !== "string") {
      return { ...line };
    }
    return {
      id: `${source}-legacy-${index}-${base}`,
      message: line,
      timestamp: base - (lines.length - 1 - index),
    };
  });
}