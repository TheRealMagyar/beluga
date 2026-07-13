import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Common Node.js install locations when Electron inherits a trimmed PATH. */
export function getNodeInstallPaths(): string[] {
  if (process.platform === "win32") {
    const paths: string[] = [];
    const programFiles = process.env.ProgramFiles;
    const programFilesX86 = process.env["ProgramFiles(x86)"];
    const appData = process.env.APPDATA;
    const localAppData = process.env.LOCALAPPDATA;

    if (programFiles) paths.push(path.join(programFiles, "nodejs"));
    if (programFilesX86) paths.push(path.join(programFilesX86, "nodejs"));
    if (appData) paths.push(path.join(appData, "npm"));
    if (localAppData) paths.push(path.join(localAppData, "Programs", "node"));

    const nvmHome = process.env.NVM_HOME?.trim();
    const nvmSymlink = process.env.NVM_SYMLINK?.trim();
    if (nvmHome) paths.push(nvmHome);
    if (nvmSymlink) paths.push(nvmSymlink);

    return paths;
  }

  return [
    "/opt/homebrew/bin",
    "/usr/local/bin",
    path.join(os.homedir(), ".nvm", "versions", "node"),
  ];
}

export function resolveNpmBinary(): string {
  return process.env.NPM_BIN?.trim() || "npm";
}

export function npmInstalledPackageDir(prefix: string, packageName: string): string {
  if (packageName.startsWith("@")) {
    const [scope, name] = packageName.split("/");
    return path.join(prefix, "node_modules", scope, name);
  }
  return path.join(prefix, "node_modules", packageName);
}

export async function runNpmCommand(
  args: string[],
  options?: {
    cwd?: string;
    timeout?: number;
    env?: NodeJS.ProcessEnv;
    maxBuffer?: number;
  },
): Promise<{ stdout: string; stderr: string }> {
  const env = options?.env ?? process.env;
  const execOptions = {
    cwd: options?.cwd,
    timeout: options?.timeout ?? 300_000,
    maxBuffer: options?.maxBuffer ?? 10 * 1024 * 1024,
    env,
  };

  if (process.platform === "win32") {
    return execFileAsync("cmd.exe", ["/d", "/s", "/c", "npm", ...args], execOptions);
  }

  return execFileAsync(resolveNpmBinary(), args, execOptions);
}