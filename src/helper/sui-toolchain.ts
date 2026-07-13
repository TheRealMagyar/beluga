import fsSync from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getNodeInstallPaths } from "./command-binary";
import {
  getBelugaMoveHomeDir,
  getBelugaToolchainRoot,
  getBelugaToolchainTmpDir,
  withBelugaTmpEnv,
} from "./beluga-toolchain-path";

const execFileAsync = promisify(execFile);

export interface ToolchainComponentStatus {
  installed: boolean;
  version: string | null;
  path: string | null;
}

export interface ToolchainStatus {
  rust: ToolchainComponentStatus;
  cargo: ToolchainComponentStatus;
  suiup: ToolchainComponentStatus;
  sui: ToolchainComponentStatus;
  platform: NodeJS.Platform;
}

export interface InstallResult {
  success: boolean;
  message: string;
  stdout: string;
  stderr: string;
}

export type SuiInstallMethod = "suiup" | "brew";

function getWindowsLocalBinDir() {
  const localAppData =
    process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local");
  return path.join(localAppData, "bin");
}

function resolveCargoBinDir(): string {
  return path.join(resolveCargoHome(), "bin");
}

export function augmentedPath() {
  const home = os.homedir();
  const cargoBin = resolveCargoBinDir();
  const defaultCargoBin = path.join(home, ".cargo", "bin");
  const extra =
    process.platform === "win32"
      ? [
          cargoBin,
          ...(cargoBin !== defaultCargoBin ? [defaultCargoBin] : []),
          getWindowsLocalBinDir(),
        ]
      : [
          cargoBin,
          ...(cargoBin !== defaultCargoBin ? [defaultCargoBin] : []),
          path.join(home, ".local", "bin"),
          ...getNodeInstallPaths(),
        ];
  return [...extra, ...getNodeInstallPaths(), process.env.PATH ?? ""]
    .filter(Boolean)
    .join(path.delimiter);
}

function probeWritableDir(dir: string): boolean {
  try {
    fsSync.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, `.write-probe-${process.pid}`);
    fsSync.writeFileSync(probe, "ok");
    fsSync.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

function resolveRustupHome(): string {
  const defaultHome = path.join(os.homedir(), ".rustup");
  const candidates = [process.env.RUSTUP_HOME, defaultHome].filter(
    (value): value is string => Boolean(value?.trim()),
  );

  for (const home of candidates) {
    if (probeWritableDir(home)) return home;
  }

  return path.join(getBelugaToolchainRoot(), "rustup");
}

function resolveCargoHome(): string {
  const defaultHome = path.join(os.homedir(), ".cargo");
  const candidates = [process.env.CARGO_HOME, defaultHome].filter(
    (value): value is string => Boolean(value?.trim()),
  );

  for (const home of candidates) {
    if (probeWritableDir(home)) return home;
  }

  return path.join(getBelugaToolchainRoot(), "cargo");
}

function isUsingRustFallback(): boolean {
  const home = os.homedir();
  return (
    resolveRustupHome() !== path.join(home, ".rustup") ||
    resolveCargoHome() !== path.join(home, ".cargo")
  );
}

function resolveXdgCacheHome(): string {
  const defaultHome =
    process.env.XDG_CACHE_HOME?.trim() ||
    path.join(os.homedir(), ".cache");
  if (probeWritableDir(defaultHome)) return defaultHome;
  return path.join(getBelugaToolchainRoot(), "cache");
}

export function toolchainEnv() {
  const rustupHome = resolveRustupHome();
  const cargoHome = resolveCargoHome();
  const xdgCacheHome = resolveXdgCacheHome();
  try {
    fsSync.mkdirSync(rustupHome, { recursive: true });
    fsSync.mkdirSync(cargoHome, { recursive: true });
    fsSync.mkdirSync(xdgCacheHome, { recursive: true });
  } catch {
    // runCommand will surface permission errors
  }

  return withBelugaTmpEnv({
    ...process.env,
    PATH: augmentedPath(),
    CARGO_HOME: cargoHome,
    RUSTUP_HOME: rustupHome,
    XDG_CACHE_HOME: xdgCacheHome,
    MOVE_HOME: process.env.MOVE_HOME ?? getBelugaMoveHomeDir(),
  }, getBelugaToolchainTmpDir());
}

function rustPermissionFixHint(): string {
  const rustupHome = resolveRustupHome();
  const cargoHome = resolveCargoHome();
  return (
    "Your ~/.rustup or ~/.cargo folders are owned by root (usually from running installs with sudo). " +
    "Run in Terminal:\n\nnpm run fix-permissions\n\n" +
    "Or use Beluga's writable Rust home:\n\n" +
    `RUSTUP_HOME="${rustupHome}" CARGO_HOME="${cargoHome}" rustup update\n\n` +
    "Then restart Beluga without sudo."
  );
}

let cachedManagedSuiBin: string | null = null;

export function invalidateManagedSuiBinaryCache() {
  cachedManagedSuiBin = null;
}

function managedSuiCandidatePaths(): string[] {
  const candidates: string[] = [];
  if (process.platform === "win32") {
    candidates.push(path.join(getWindowsLocalBinDir(), "sui.exe"));
  } else {
    candidates.push(path.join(os.homedir(), ".local", "bin", "sui"));
  }
  return candidates;
}

function parseSuiupWhichPaths(stdout: string): string[] {
  const paths: string[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/[\\/]sui(\.exe)?$/i.test(trimmed)) {
      paths.push(trimmed);
      continue;
    }
    paths.push(
      process.platform === "win32"
        ? path.join(trimmed, "sui.exe")
        : path.join(trimmed, "sui"),
    );
  }
  return paths;
}

/** Prefer suiup-managed binaries over stale PATH copies (common on Windows). */
export async function getManagedSuiBinary(): Promise<string> {
  if (process.env.SUI_BIN?.trim()) {
    return process.env.SUI_BIN.trim();
  }
  if (cachedManagedSuiBin) {
    return cachedManagedSuiBin;
  }

  const candidates: string[] = [];

  try {
    const { stdout } = await execFileAsync("suiup", ["which"], {
      timeout: 15_000,
      env: toolchainEnv(),
    });
    candidates.push(...parseSuiupWhichPaths(stdout));
  } catch {
    // suiup not installed yet
  }

  candidates.push(...managedSuiCandidatePaths());

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      cachedManagedSuiBin = candidate;
      return candidate;
    } catch {
      // try next candidate
    }
  }

  cachedManagedSuiBin = "sui";
  return "sui";
}

async function suiupHasSuiBinary(): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync("suiup", ["show"], {
      timeout: 15_000,
      maxBuffer: 1024 * 1024,
      env: toolchainEnv(),
    });
    const normalized = stdout.toLowerCase();
    if (/binary sui not found|no installed binaries/i.test(normalized)) {
      return false;
    }
    return /\bsui\b/.test(normalized);
  } catch {
    return false;
  }
}

function installSuiViaSuiup(label = "Sui CLI (suiup)") {
  return runCommand("suiup", ["install", "sui@testnet", "-y"], label);
}

export async function installSuiForIkaPin(
  pinnedTag: string,
): Promise<InstallResult> {
  const { parseSuiTagVersion, suiupInstallSpecForTag } = await import(
    "./ika-sui-version"
  );
  const version = parseSuiTagVersion(pinnedTag);
  const specs = [
    suiupInstallSpecForTag(pinnedTag),
    version ? `sui@mainnet-v${version}` : null,
    version ? `sui@mainnet-${version}` : null,
    "sui@mainnet",
  ].filter((value, index, all): value is string => {
    return Boolean(value) && all.indexOf(value) === index;
  });

  let lastResult: InstallResult | null = null;
  for (const spec of specs) {
    const result = await runCommand(
      "suiup",
      ["install", spec, "-y"],
      `Sui CLI (${spec})`,
    );
    lastResult = result;
    if (!result.success) continue;

    await runCommand("suiup", ["default", "set", spec], "Sui default version");
    invalidateManagedSuiBinaryCache();
    return result;
  }

  return (
    lastResult ?? {
      success: false,
      message: "Could not install a Sui CLI matching Ika's pinned version.",
      stdout: "",
      stderr: "",
    }
  );
}

async function probeBinary(
  binary: string,
  args: string[] = ["--version"],
): Promise<ToolchainComponentStatus> {
  try {
    const { stdout } = await execFileAsync(binary, args, {
      timeout: 15_000,
      env: toolchainEnv(),
    });
    return {
      installed: true,
      version: stdout.trim().split("\n")[0],
      path: binary,
    };
  } catch {
    return { installed: false, version: null, path: null };
  }
}

async function runShellInstall(
  label: string,
  command: string,
  timeoutMs = 1_800_000,
): Promise<InstallResult> {
  try {
    const { stdout, stderr } = await execFileAsync("sh", ["-c", command], {
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
      env: toolchainEnv(),
    });
    return {
      success: true,
      message: `${label} finished successfully.`,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    };
  } catch (err: any) {
    const stdout = err?.stdout?.toString?.() ?? "";
    const stderr = err?.stderr?.toString?.() ?? "";
    return {
      success: false,
      message:
        [err?.message, stderr, stdout].filter(Boolean).join("\n").trim() ||
        `${label} failed.`,
      stdout,
      stderr,
    };
  }
}

async function runCommand(
  binary: string,
  args: string[],
  label: string,
  timeoutMs = 1_800_000,
): Promise<InstallResult> {
  try {
    const { stdout, stderr } = await execFileAsync(binary, args, {
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
      env: toolchainEnv(),
    });
    return {
      success: true,
      message: `${label} finished successfully.`,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    };
  } catch (err: any) {
    const stdout = err?.stdout?.toString?.() ?? "";
    const stderr = err?.stderr?.toString?.() ?? "";
    return {
      success: false,
      message:
        [err?.message, stderr, stdout].filter(Boolean).join("\n").trim() ||
        `${label} failed.`,
      stdout,
      stderr,
    };
  }
}

export async function getToolchainStatus(): Promise<ToolchainStatus> {
  const managedSui = await getManagedSuiBinary();
  const [rust, cargo, suiup, suiProbe] = await Promise.all([
    probeBinary("rustc"),
    probeBinary("cargo"),
    probeBinary("suiup"),
    probeBinary(managedSui),
  ]);

  let sui = suiProbe;
  if (suiup.installed && !(await suiupHasSuiBinary())) {
    sui = { installed: false, version: null, path: null };
  }

  return {
    rust,
    cargo,
    suiup,
    sui,
    platform: process.platform,
  };
}

async function runPowerShell(
  script: string,
  label: string,
  timeoutMs = 1_800_000,
): Promise<InstallResult> {
  try {
    const { stdout, stderr } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      {
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
        env: toolchainEnv(),
      },
    );
    return {
      success: true,
      message: `${label} finished successfully.`,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    };
  } catch (err: any) {
    const stdout = err?.stdout?.toString?.() ?? "";
    const stderr = err?.stderr?.toString?.() ?? "";
    return {
      success: false,
      message:
        [err?.message, stderr, stdout].filter(Boolean).join("\n").trim() ||
        `${label} failed.`,
      stdout,
      stderr,
    };
  }
}

async function installRustWindows(): Promise<InstallResult> {
  // rustup-init must keep this exact name — other names are treated as proxy commands.
  const installer = path.join(os.tmpdir(), "rustup-init.exe");
  const download = await runPowerShell(
    `Invoke-WebRequest -Uri https://win.rustup.rs/x86_64 -OutFile '${installer.replace(/'/g, "''")}'`,
    "Rust toolchain download",
    300_000,
  );
  if (!download.success) {
    return download;
  }
  return runCommand(
    installer,
    ["-y", "--default-toolchain", "stable"],
    "Rust toolchain",
  );
}

async function installSuiupWindows(): Promise<InstallResult> {
  const binDir = getWindowsLocalBinDir();
  await fs.mkdir(binDir, { recursive: true });

  const arch = process.arch === "arm64" ? "arm64" : "x86_64";
  const assetName = `suiup-Windows-msvc-${arch}.zip`;
  const script = [
    `$release = Invoke-RestMethod -Uri 'https://api.github.com/repos/MystenLabs/suiup/releases/latest'`,
    `$asset = $release.assets | Where-Object { $_.name -eq '${assetName}' } | Select-Object -First 1`,
    `if (-not $asset) { throw "Could not find ${assetName} in latest suiup release." }`,
    `$zip = Join-Path $env:TEMP 'beluga-suiup.zip'`,
    `$extract = Join-Path $env:TEMP 'beluga-suiup-extract'`,
    `Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zip`,
    `if (Test-Path $extract) { Remove-Item -Recurse -Force $extract }`,
    `Expand-Archive -Path $zip -DestinationPath $extract -Force`,
    `$binary = Get-ChildItem -Path $extract -Recurse -Filter 'suiup.exe' | Select-Object -First 1`,
    `if (-not $binary) { throw 'suiup.exe not found in release archive.' }`,
    `Copy-Item -Path $binary.FullName -Destination '${binDir.replace(/\\/g, "\\\\")}\\suiup.exe' -Force`,
  ].join("; ");

  return runPowerShell(script, "suiup");
}

export async function installRust(): Promise<InstallResult> {
  if (process.platform === "win32") {
    return installRustWindows();
  }
  return runShellInstall(
    "Rust toolchain",
    `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y`,
  );
}

export async function installSuiup(): Promise<InstallResult> {
  if (process.platform === "win32") {
    return installSuiupWindows();
  }
  return runShellInstall(
    "suiup",
    `curl -sSfL https://raw.githubusercontent.com/Mystenlabs/suiup/main/install.sh | sh`,
  );
}

export async function installSuiCli(
  method: SuiInstallMethod = "suiup",
): Promise<InstallResult> {
  const status = await getToolchainStatus();

  if (method === "brew") {
    if (process.platform !== "darwin") {
      return {
        success: false,
        message: "Homebrew install is only available on macOS.",
        stdout: "",
        stderr: "",
      };
    }
    return runCommand("brew", ["install", "sui"], "Sui CLI (Homebrew)");
  }

  if (!status.suiup.installed) {
    const suiupResult = await installSuiup();
    if (!suiupResult.success) {
      return {
        ...suiupResult,
        message: `suiup install failed: ${suiupResult.message}`,
      };
    }
  }

  return installSuiViaSuiup();
}

export async function updateRust(): Promise<InstallResult> {
  const usingFallback = isUsingRustFallback();
  const result = await runCommand("rustup", ["update"], "Rust toolchain update");

  if (result.success) {
    if (!usingFallback) return result;
    return {
      ...result,
      message:
        `${result.message}\n\n` +
        `Rust was updated under ${resolveRustupHome()} because ~/.rustup is not writable. ` +
        `Run "npm run fix-permissions" to restore the default Rust install location.`,
    };
  }

  if (/could not create temp file|permission denied/i.test(result.message)) {
    return {
      ...result,
      message: `${result.message}\n\n${rustPermissionFixHint()}`,
    };
  }

  return result;
}

export async function uninstallRust(): Promise<InstallResult> {
  return runCommand(
    "rustup",
    ["self", "uninstall", "-y"],
    "Rust toolchain uninstall",
  );
}

export async function updateSuiup(): Promise<InstallResult> {
  if (process.platform === "win32") {
    // suiup self-update downloads a .tar.gz that is not published for Windows.
    return installSuiupWindows();
  }
  return runCommand("suiup", ["self", "update"], "suiup update");
}

export async function uninstallSuiup(): Promise<InstallResult> {
  return runCommand("suiup", ["self", "uninstall"], "suiup uninstall");
}

export async function updateSuiCli(): Promise<InstallResult> {
  const status = await getToolchainStatus();
  if (status.suiup.installed) {
    if (!(await suiupHasSuiBinary())) {
      return installSuiViaSuiup("Sui CLI install");
    }

    const updateResult = await runCommand(
      "suiup",
      ["update", "sui"],
      "Sui CLI update",
    );
    if (
      !updateResult.success &&
      /Binary sui not found|suiup install/i.test(updateResult.message)
    ) {
      return installSuiViaSuiup("Sui CLI install");
    }
    return updateResult;
  }
  if (process.platform === "darwin") {
    return runCommand("brew", ["upgrade", "sui"], "Sui CLI update (Homebrew)");
  }
  return {
    success: false,
    message: "Install suiup first to manage Sui CLI updates.",
    stdout: "",
    stderr: "",
  };
}

export async function uninstallSuiCli(): Promise<InstallResult> {
  const status = await getToolchainStatus();
  if (status.suiup.installed) {
    return runCommand("suiup", ["remove", "sui"], "Sui CLI uninstall");
  }
  if (process.platform === "darwin") {
    return runCommand("brew", ["uninstall", "sui"], "Sui CLI uninstall (Homebrew)");
  }
  return {
    success: false,
    message: "Could not find suiup or Homebrew install to remove Sui CLI.",
    stdout: "",
    stderr: "",
  };
}