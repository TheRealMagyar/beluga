import { execFile } from "node:child_process";
import fsSync from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const MSVC_REQUIRED_MESSAGE =
  'Microsoft C++ Build Tools are required to compile Ika on Windows. Install "Desktop development with C++" from Visual Studio Build Tools (https://visualstudio.microsoft.com/visual-cpp-build-tools/), then restart Beluga and rebuild.';

export interface WindowsMsvcLaunch {
  installationPath: string;
  vcvars64: string;
}

function pathExistsSync(target: string): boolean {
  try {
    return fsSync.existsSync(target);
  } catch {
    return false;
  }
}

function getVswherePath(): string | null {
  const programFilesX86 =
    process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
  const vswhere = path.join(
    programFilesX86,
    "Microsoft Visual Studio",
    "Installer",
    "vswhere.exe",
  );
  return pathExistsSync(vswhere) ? vswhere : null;
}

async function queryVswhere(
  vswhere: string,
  args: string[],
): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(vswhere, args, { timeout: 20_000 });
    const installationPath = stdout.trim();
    return installationPath || null;
  } catch {
    return null;
  }
}

async function findVcToolsInstallationPath(): Promise<string | null> {
  const vswhere = getVswherePath();
  if (!vswhere) return null;

  const queries = [
    [
      "-latest",
      "-products",
      "*",
      "-requires",
      "Microsoft.VisualStudio.Component.VC.Tools.x86.x64",
      "-property",
      "installationPath",
    ],
    [
      "-latest",
      "-products",
      "*",
      "-requires",
      "Microsoft.VisualStudio.Workload.VCTools",
      "-property",
      "installationPath",
    ],
    ["-latest", "-products", "*", "-property", "installationPath"],
  ];

  for (const args of queries) {
    const installationPath = await queryVswhere(vswhere, args);
    if (!installationPath) continue;

    const vcvars64 = path.join(
      installationPath,
      "VC",
      "Auxiliary",
      "Build",
      "vcvars64.bat",
    );
    if (pathExistsSync(vcvars64)) {
      return installationPath;
    }
  }

  return null;
}

function quoteCmdToken(token: string): string {
  if (!/[\s"]/g.test(token)) return token;
  return `"${token.replace(/"/g, '""')}"`;
}

export async function linkExeAvailable(env?: NodeJS.ProcessEnv): Promise<boolean> {
  if (process.platform !== "win32") return true;
  try {
    await execFileAsync("where", ["link.exe"], {
      timeout: 10_000,
      env,
    });
    return true;
  } catch {
    return false;
  }
}

export async function resolveWindowsMsvcForCargo(
  env?: NodeJS.ProcessEnv,
): Promise<WindowsMsvcLaunch | null> {
  if (process.platform !== "win32") return null;

  if (await linkExeAvailable(env)) {
    return null;
  }

  const installationPath = await findVcToolsInstallationPath();
  if (!installationPath) {
    throw new Error(MSVC_REQUIRED_MESSAGE);
  }

  const vcvars64 = path.join(
    installationPath,
    "VC",
    "Auxiliary",
    "Build",
    "vcvars64.bat",
  );
  if (!pathExistsSync(vcvars64)) {
    throw new Error(MSVC_REQUIRED_MESSAGE);
  }

  return { installationPath, vcvars64 };
}

export function buildWindowsCargoCommand(
  vcvars64: string,
  cargoArgs: string[],
): { command: string; args: string[] } {
  const cargoCmd = ["cargo", ...cargoArgs].map(quoteCmdToken).join(" ");
  const script = `call ${quoteCmdToken(vcvars64)} >nul && ${cargoCmd}`;
  return {
    command: "cmd.exe",
    args: ["/d", "/s", "/c", script],
  };
}