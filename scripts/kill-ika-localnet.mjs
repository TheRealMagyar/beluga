import { execSync } from "node:child_process";

const isWin = process.platform === "win32";

console.log(
  isWin
    ? "Stopping Ika localnet processes…"
    : "Stopping Ika localnet processes (sudo password may be required)…",
);
console.log("");

const unixCommands = [
  'sudo pkill -f "target/release/ika start" || true',
  'sudo pkill -f "target/debug/ika start" || true',
  'sudo pkill -f "cargo run.*--bin.*ika" || true',
];

const windowsScript = [
  "$patterns = @('target\\\\release\\\\ika','target\\\\debug\\\\ika','cargo run','--bin ika')",
  "Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {",
  "  $cmd = $_.CommandLine",
  "  if (-not $cmd) { return $false }",
  "  if ($cmd -match 'ika(\\.exe)? start' -or ($cmd -like '*cargo*' -and $cmd -like '*--bin*ika*')) { return $true }",
  "  return $false",
  "} | ForEach-Object { taskkill /PID $_.ProcessId /T /F 2>$null }",
].join("; ");

try {
  if (isWin) {
    execSync(`powershell.exe -NoProfile -NonInteractive -Command "${windowsScript}"`, {
      stdio: "inherit",
    });
  } else {
    for (const command of unixCommands) {
      execSync(command, { stdio: "inherit" });
    }
  }
  console.log("");
  console.log("Done. Restart Beluga with: npm start");
} catch {
  process.exit(1);
}