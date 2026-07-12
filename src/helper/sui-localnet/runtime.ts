import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { broadcastLocalnetLogs } from "../localnet-log-broadcast";
import {
  createStreamLogEntry,
  streamLogMessages,
  type StreamLogEntry,
} from "../stream-log-entry";

export const suiLocalnetRuntime = {
  localNetworkProcess: null as ChildProcessWithoutNullStreams | null,
  localNetworkStartedAt: null as number | null,
  localNetworkLogs: [] as StreamLogEntry[],
  lastKnownRpcReady: false,
  activeSuiLocalnetForIka: false,
  warnedUnmanagedSuiLogs: false,
};

export function getSuiLocalnetLogSnapshot(): StreamLogEntry[] {
  return [...suiLocalnetRuntime.localNetworkLogs];
}

export function getSuiLocalnetLogMessages(): string[] {
  return streamLogMessages(suiLocalnetRuntime.localNetworkLogs);
}

export function warnUnmanagedSuiLogsOnce() {
  if (
    suiLocalnetRuntime.warnedUnmanagedSuiLogs ||
    suiLocalnetRuntime.localNetworkProcess
  ) {
    return;
  }
  suiLocalnetRuntime.warnedUnmanagedSuiLogs = true;
  pushLog(
    "Sui is running outside this Beluga session — live logs need Stop then Start.",
  );
}

export function pushLog(chunk: string) {
  let changed = false;
  for (const line of chunk.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    suiLocalnetRuntime.localNetworkLogs.push(createStreamLogEntry(trimmed));
    changed = true;
  }
  if (suiLocalnetRuntime.localNetworkLogs.length > 200) {
    suiLocalnetRuntime.localNetworkLogs =
      suiLocalnetRuntime.localNetworkLogs.slice(-200);
  }
  if (changed) {
    broadcastLocalnetLogs("sui", suiLocalnetRuntime.localNetworkLogs);
  }
}

export function appendLocalNetworkLog(message: string) {
  pushLog(message);
}