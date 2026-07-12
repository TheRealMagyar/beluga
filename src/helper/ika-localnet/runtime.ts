import type { ChildProcessWithoutNullStreams } from "node:child_process";

export const ikaLocalnetRuntime = {
  ikaProcess: null as ChildProcessWithoutNullStreams | null,
  ikaStartedAt: null as number | null,
  ikaLogs: [] as import("../stream-log-entry").StreamLogEntry[],
  ikaLogSessionStart: 0,
};