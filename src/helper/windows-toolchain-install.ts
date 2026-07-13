import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { InstallResult } from "./sui-toolchain";
import { toolchainEnv } from "./sui-toolchain";
import {
  findWindowsLibClangDir,
  findWindowsMsvcLaunch,
  type WindowsMsvcLaunch,
} from "./windows-msvc";

const execFileAsync = promisify(execFile);

const VS_BUILD_TOOLS_URL = "https://aka.ms/vs/17/release/vs_buildtools.exe";
const LLVM_RELEASES_API =
  "https://api.github.com/repos/llvm/llvm-project/releases/latest";

async function runPowerShell(
  script: string,
  label: string,
  timeoutMs = 1_800_000,
): Promise<InstallResult> {
  try {
    const { stdout, stderr } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
      {
        timeout: timeoutMs,
        maxBuffer: 20 * 1024 * 1024,
        env: toolchainEnv(),
      },
    );
    return {
      success: true,
      message: `${label} finished successfully.`,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    };
  } catch (err: unknown) {
    const error = err as { message?: string; stdout?: { toString?: () => string }; stderr?: { toString?: () => string } };
    const stdout = error.stdout?.toString?.() ?? "";
    const stderr = error.stderr?.toString?.() ?? "";
    return {
      success: false,
      message:
        [error.message, stderr, stdout].filter(Boolean).join("\n").trim() ||
        `${label} failed.`,
      stdout,
      stderr,
    };
  }
}

async function wingetAvailable(): Promise<boolean> {
  try {
    await execFileAsync("winget", ["--version"], {
      timeout: 15_000,
      env: toolchainEnv(),
    });
    return true;
  } catch {
    return false;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForLibClang(maxWaitMs = 180_000): Promise<string | null> {
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    const dir = await findWindowsLibClangDir();
    if (dir) return dir;
    await sleep(3000);
  }
  return null;
}

async function waitForMsvcLaunch(maxWaitMs = 300_000): Promise<WindowsMsvcLaunch | null> {
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    const launch = await findWindowsMsvcLaunch();
    if (launch) return launch;
    await sleep(5000);
  }
  return null;
}

export async function installWindowsLibClang(): Promise<InstallResult> {
  if (process.platform !== "win32") {
    return {
      success: true,
      message: "LLVM install is only required on Windows.",
      stdout: "",
      stderr: "",
    };
  }

  if (await wingetAvailable()) {
    const winget = await runPowerShell(
      [
        "winget install -e --id LLVM.LLVM",
        "--accept-package-agreements",
        "--accept-source-agreements",
        "--disable-interactivity",
      ].join(" "),
      "LLVM install (winget)",
      900_000,
    );
    if (winget.success) {
      const dir = await waitForLibClang();
      if (dir) {
        return {
          success: true,
          message: `Installed LLVM — libclang found at ${dir}`,
          stdout: winget.stdout,
          stderr: winget.stderr,
        };
      }
    }
  }

  const tmpDir = path.join(os.tmpdir(), "beluga-llvm-install");
  const script = [
    `$tmp = '${tmpDir.replace(/'/g, "''")}'`,
    "New-Item -ItemType Directory -Force -Path $tmp | Out-Null",
    "$release = Invoke-RestMethod -Uri '" + LLVM_RELEASES_API + "' -Headers @{ 'User-Agent' = 'Beluga' }",
    "$asset = $release.assets | Where-Object { $_.name -match '^LLVM-.*-win64\\.exe$' -and $_.name -notmatch 'sha' } | Select-Object -First 1",
    "if (-not $asset) { throw 'Could not find LLVM Windows installer in latest GitHub release.' }",
    "$installer = Join-Path $tmp $asset.name",
    "Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $installer",
    "Start-Process -FilePath $installer -ArgumentList '/S' -Wait",
  ].join("; ");

  const downloaded = await runPowerShell(script, "LLVM install (download)", 900_000);
  if (!downloaded.success) {
    return downloaded;
  }

  const dir = await waitForLibClang();
  if (!dir) {
    return {
      success: false,
      message:
        "LLVM installer finished but libclang.dll was not found. Restart Beluga and retry Build Ika CLI.",
      stdout: downloaded.stdout,
      stderr: downloaded.stderr,
    };
  }

  return {
    success: true,
    message: `Installed LLVM — libclang found at ${dir}`,
    stdout: downloaded.stdout,
    stderr: downloaded.stderr,
  };
}

export async function installWindowsMsvcBuildTools(): Promise<InstallResult> {
  if (process.platform !== "win32") {
    return {
      success: true,
      message: "MSVC install is only required on Windows.",
      stdout: "",
      stderr: "",
    };
  }

  const installer = path.join(os.tmpdir(), "beluga-vs-buildtools.exe");
  const escapedInstaller = installer.replace(/'/g, "''");
  const script = [
    `Invoke-WebRequest -Uri '${VS_BUILD_TOOLS_URL}' -OutFile '${escapedInstaller}'`,
    `$args = @(
      '--passive',
      '--wait',
      '--norestart',
      '--add', 'Microsoft.VisualStudio.Workload.VCTools',
      '--includeRecommended'
    )`,
    `Start-Process -FilePath '${escapedInstaller}' -ArgumentList $args -Wait`,
  ].join("; ");

  const result = await runPowerShell(
    script,
    "Microsoft C++ Build Tools install",
    3_600_000,
  );
  if (!result.success) {
    return {
      ...result,
      message:
        `${result.message}\n\nIf Windows asked for administrator approval, accept it and retry. ` +
        "The C++ Build Tools installer may take 15–30 minutes.",
    };
  }

  const launch = await waitForMsvcLaunch();
  if (!launch) {
    return {
      success: false,
      message:
        "Build Tools installer finished but vcvars64.bat was not found yet. Restart Beluga and retry Build Ika CLI.",
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  return {
    success: true,
    message: `Installed C++ Build Tools — MSVC at ${launch.installationPath}`,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

export async function ensureWindowsLibClang(
  notify?: (message: string) => void,
): Promise<string> {
  const existing = await findWindowsLibClangDir();
  if (existing) return existing;

  notify?.(
    "Installing LLVM (libclang) for Ika — first time only, a few minutes…",
  );
  const installed = await installWindowsLibClang();
  if (!installed.success) {
    throw new Error(installed.message);
  }

  const dir = await findWindowsLibClangDir();
  if (!dir) {
    throw new Error(
      "LLVM install reported success but libclang.dll is still missing. Restart Beluga and retry.",
    );
  }
  notify?.(installed.message);
  return dir;
}

export async function ensureWindowsMsvcForCargo(
  notify?: (message: string) => void,
): Promise<WindowsMsvcLaunch | null> {
  const existing = await findWindowsMsvcLaunch();
  if (existing) return existing;

  notify?.(
    "Installing Microsoft C++ Build Tools — first time only, often 15–30 min. Accept any UAC prompt.",
  );
  const installed = await installWindowsMsvcBuildTools();
  if (!installed.success) {
    throw new Error(installed.message);
  }

  const launch = await findWindowsMsvcLaunch();
  if (!launch) {
    throw new Error(
      "C++ Build Tools install reported success but MSVC was not detected. Restart Beluga and retry.",
    );
  }
  notify?.(installed.message);
  return launch;
}

export async function ensureWindowsIkaBuildPrereqs(
  notify?: (message: string) => void,
): Promise<void> {
  if (process.platform !== "win32") return;
  notify?.("Checking Windows build prerequisites for Ika…");
  await ensureWindowsMsvcForCargo(notify);
  await ensureWindowsLibClang(notify);
}