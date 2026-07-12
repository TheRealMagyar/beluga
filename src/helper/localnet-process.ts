import { spawn, type ChildProcessWithoutNullStreams, type SpawnOptions } from "node:child_process";

/** Spawn with a pseudo-TTY on macOS so Rust tracing flushes lines promptly. */
export function spawnWithLineBufferedLogs(
  command: string,
  args: string[],
  options: Omit<SpawnOptions, "stdio" | "detached">,
): ChildProcessWithoutNullStreams {
  const useScript = process.platform === "darwin";
  const runCommand = useScript ? "script" : command;
  const runArgs = useScript ? ["-q", "/dev/null", command, ...args] : args;

  return spawn(runCommand, runArgs, {
    ...options,
    detached: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
}