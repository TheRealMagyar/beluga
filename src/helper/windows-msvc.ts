import { execFile } from "node:child_process";
import fsSync from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const MSVC_REQUIRED_MESSAGE =
  'Microsoft C++ Build Tools are required to compile Ika on Windows. Install "Desktop development with C++" from Visual Studio Build Tools (https://visualstudio.microsoft.com/visual-cpp-build-tools/), then restart Beluga and rebuild.';

export const LIBCLANG_REQUIRED_MESSAGE =
  "LLVM libclang is required for Ika on Windows (librocksdb-sys uses bindgen). " +
  'Install LLVM (https://releases.llvm.org/download.html) or run: winget install LLVM.LLVM — ' +
  'or add "C++ Clang tools for Windows" in Visual Studio Installer. Then restart Beluga and rebuild.';

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

function libClangDllExists(dir: string): boolean {
  return (
    pathExistsSync(path.join(dir, "libclang.dll")) ||
    pathExistsSync(path.join(dir, "clang.dll"))
  );
}

function findLibClangDir(candidates: string[]): string | null {
  for (const dir of candidates) {
    if (libClangDllExists(dir)) return dir;
  }
  return null;
}

async function collectLibClangCandidates(): Promise<string[]> {
  const candidates: string[] = [];
  const programFiles = process.env.ProgramFiles ?? "C:\\Program Files";
  const programFilesX86 =
    process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";

  candidates.push(
    path.join(programFiles, "LLVM", "bin"),
    path.join(programFilesX86, "LLVM", "bin"),
  );

  const appendVsLlvmDirs = (installationPath: string) => {
    candidates.push(
      path.join(installationPath, "VC", "Tools", "Llvm", "x64", "bin"),
      path.join(installationPath, "VC", "Tools", "Llvm", "bin"),
    );
  };

  const vsPath = await findVcToolsInstallationPath();
  if (vsPath) appendVsLlvmDirs(vsPath);

  const vswhere = getVswherePath();
  if (vswhere) {
    const llvmVsPath = await queryVswhere(vswhere, [
      "-latest",
      "-products",
      "*",
      "-requires",
      "Microsoft.VisualStudio.Component.VC.Llvm.x86_x64",
      "-property",
      "installationPath",
    ]);
    if (llvmVsPath) appendVsLlvmDirs(llvmVsPath);
  }

  return candidates;
}

export async function findWindowsLibClangDir(
  env?: NodeJS.ProcessEnv,
): Promise<string | null> {
  if (process.platform !== "win32") return null;

  const existing = env?.LIBCLANG_PATH?.trim();
  if (existing && libClangDllExists(existing)) {
    return existing;
  }

  return findLibClangDir(await collectLibClangCandidates());
}

export async function resolveWindowsLibClangDir(
  env?: NodeJS.ProcessEnv,
): Promise<string> {
  const libClangDir = await findWindowsLibClangDir(env);
  if (!libClangDir) {
    throw new Error(LIBCLANG_REQUIRED_MESSAGE);
  }
  return libClangDir;
}

export async function applyWindowsCargoBuildEnv(
  baseEnv: NodeJS.ProcessEnv,
): Promise<NodeJS.ProcessEnv> {
  if (process.platform !== "win32") return baseEnv;

  const libClangDir = await findWindowsLibClangDir(baseEnv);
  if (!libClangDir) {
    throw new Error(LIBCLANG_REQUIRED_MESSAGE);
  }
  return {
    ...baseEnv,
    LIBCLANG_PATH: libClangDir,
  };
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

export async function findWindowsMsvcLaunch(): Promise<WindowsMsvcLaunch | null> {
  if (process.platform !== "win32") return null;

  const installationPath = await findVcToolsInstallationPath();
  if (!installationPath) return null;

  const vcvars64 = path.join(
    installationPath,
    "VC",
    "Auxiliary",
    "Build",
    "vcvars64.bat",
  );
  if (!pathExistsSync(vcvars64)) return null;

  return { installationPath, vcvars64 };
}

export async function resolveWindowsMsvcForCargo(
  env?: NodeJS.ProcessEnv,
): Promise<WindowsMsvcLaunch | null> {
  if (process.platform !== "win32") return null;

  if (await linkExeAvailable(env)) {
    return null;
  }

  const launch = await findWindowsMsvcLaunch();
  if (!launch) {
    throw new Error(MSVC_REQUIRED_MESSAGE);
  }
  return launch;
}

export function buildWindowsCargoCommand(
  vcvars64: string,
  cargoArgs: string[],
): { command: string; args: string[] } {
  if (!pathExistsSync(vcvars64)) {
    throw new Error(
      `MSVC environment script not found at ${vcvars64}. ` +
        'Reinstall Visual Studio Build Tools with "Desktop development with C++".',
    );
  }

  const cargoCmd = ["cargo", ...cargoArgs].map(quoteCmdToken).join(" ");
  // PowerShell here-string avoids cmd.exe /s quote-stripping breaking spaced paths.
  const script = [
    "$vcvars = @'",
    vcvars64,
    "'@",
    `cmd /c "call \`"$vcvars\`" >nul && ${cargoCmd}"`,
  ].join("\r\n");

  return {
    command: "powershell.exe",
    args: [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      script,
    ],
  };
}