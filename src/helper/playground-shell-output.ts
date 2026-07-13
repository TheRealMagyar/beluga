/** Clap/Rust CLIs print usage to stderr and exit non-zero when invoked without a subcommand. */
export function isCliHelpOrUsageOutput(text: string): boolean {
  const blob = text.trim();
  if (!blob) return false;

  const hasUsage = /^Usage:\s/m.test(blob);
  const hasHelpMenu =
    /\bCommands:\b/m.test(blob) ||
    /\bSubcommands:\b/m.test(blob) ||
    /\bOptions:\b/m.test(blob);
  const hasHelpHints =
    /\bPrint help\b/m.test(blob) ||
    /\bFor more information, try\b/i.test(blob) ||
    /--help\b/.test(blob);

  return (hasUsage && hasHelpMenu) || (hasUsage && hasHelpHints);
}

export type PlaygroundShellLogLevel = "info" | "warn" | "error" | "success";

export function shellCommandOutputLogLevel(
  exitCode: number,
  stream: "stdout" | "stderr",
  combinedOutput: string,
): PlaygroundShellLogLevel {
  if (exitCode === 0) return "info";
  if (isCliHelpOrUsageOutput(combinedOutput)) return "info";
  return stream === "stderr" ? "error" : "info";
}