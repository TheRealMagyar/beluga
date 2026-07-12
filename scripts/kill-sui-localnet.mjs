import { execSync } from "node:child_process";

const isWin = process.platform === "win32";

console.log(
  isWin
    ? "Stopping Sui localnet processes…"
    : "Stopping Sui localnet processes (sudo password may be required)…",
);
console.log("");

const unixCommands = [
  'sudo pkill -f "sui start" || true',
  'sudo pkill -f "sui-node" || true',
  'sudo pkill -f "sui-faucet" || true',
];

const windowsScript = [
  "$patterns = @('sui start','sui-node','sui-faucet','sui faucet')",
  "Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {",
  "  $cmd = $_.CommandLine",
  "  if (-not $cmd) { return $false }",
  "  foreach ($pattern in $patterns) { if ($cmd -like \"*$pattern*\") { return $true } }",
  "  return $false",
  "} | ForEach-Object { taskkill /PID $_.ProcessId /T /F 2>$null }",
  "netstat -ano | Select-String ':9000.*LISTENING' | ForEach-Object {",
  "  $pid = ($_ -split '\\s+')[-1]",
  "  if ($pid -match '^\\d+$') { taskkill /PID $pid /T /F 2>$null }",
  "}",
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
  console.log("Done. Verify port 9000 is free, then run: npm start");
} catch {
  process.exit(1);
}