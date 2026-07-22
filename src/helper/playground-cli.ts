import { app } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  getManagedSuiBinary,
  toolchainEnv,
  warmToolchainBinaries,
} from "./sui-toolchain";
import {
  ensureLocalEnvironment,
  ensureTestnetEnvironment,
  getSuiClientStatus,
  initSuiClient,
  refreshLocalNetworkStatus,
  switchSuiEnvironment,
} from "./sui-client-manager";

const execFileAsync = promisify(execFile);

export interface PlaygroundFileInput {
  path: string;
  content: string;
}

export interface PlaygroundBuildResult {
  modules: string[];
  dependencies: string[];
  digest: number[];
  stdout: string;
  stderr: string;
}

export interface PlaygroundCliStatus {
  installed: boolean;
  version: string | null;
  path: string | null;
}

export async function getPlaygroundWorkspace(): Promise<string> {
  const dir = path.join(app.getPath("userData"), "playground", "workspace");
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function checkSuiCli(): Promise<PlaygroundCliStatus> {
  await warmToolchainBinaries();
  const binary = await getManagedSuiBinary();
  try {
    const { stdout } = await execFileAsync(binary, ["--version"], {
      timeout: 10_000,
      env: toolchainEnv(),
    });
    const versionLine = stdout.trim().split("\n")[0];
    return {
      installed: true,
      version: versionLine,
      path: binary,
    };
  } catch {
    return {
      installed: false,
      version: null,
      path: null,
    };
  }
}

export async function clearPlaygroundWorkspace(): Promise<string> {
  const workspace = await getPlaygroundWorkspace();
  const entries = await fs.readdir(workspace).catch(() => [] as string[]);

  for (const entry of entries) {
    await fs.rm(path.join(workspace, entry), { recursive: true, force: true });
  }

  return workspace;
}

export async function syncPlaygroundFiles(
  files: PlaygroundFileInput[],
  options?: { clear?: boolean },
): Promise<string> {
  const workspace = await getPlaygroundWorkspace();

  if (options?.clear !== false) {
    await clearPlaygroundWorkspace();
  }

  for (const file of files) {
    const target = path.join(workspace, file.path);
    const resolved = path.resolve(target);
    if (!resolved.startsWith(workspace)) {
      throw new Error(`Invalid file path: ${file.path}`);
    }
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, file.content, "utf-8");
  }

  return workspace;
}

type ChainBuildEnv = "testnet" | "mainnet";

function parseSuiCliMajorMinor(version: string | null): {
  major: number;
  minor: number;
} | null {
  if (!version) return null;
  const match = version.match(/(\d+)\.(\d+)/);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]) };
}

/** Sui 1.73+ requires `--build-env` when Move.toml targets localnet. */
function supportsBuildEnvFlag(version: string | null): boolean {
  const parsed = parseSuiCliMajorMinor(version);
  if (!parsed) return true;
  return (
    parsed.major > 1 || (parsed.major === 1 && parsed.minor >= 73)
  );
}

function needsBuildEnvRetry(message: string): boolean {
  return /pass one of.*--build-env (testnet|mainnet)/i.test(message);
}

function resolveChainBuildEnv(activeEnv: string | null, localRunning: boolean): ChainBuildEnv {
  if (localRunning) return "testnet";

  const env = activeEnv?.toLowerCase() ?? "";
  if (env.includes("local") || env.includes("testnet") || env.includes("devnet")) {
    return "testnet";
  }
  if (env.includes("mainnet")) {
    return "mainnet";
  }
  return "testnet";
}

async function findEnvironmentAlias(
  status: Awaited<ReturnType<typeof getSuiClientStatus>>,
  keyword: string,
): Promise<string | null> {
  const match = status.environments.find((env) =>
    env.alias.toLowerCase().includes(keyword),
  );
  return match?.alias ?? null;
}

async function prepareBuildEnvironment(version: string | null): Promise<{
  buildEnv: ChainBuildEnv;
  useBuildEnvFlag: boolean;
}> {
  const useBuildEnvFlag = supportsBuildEnvFlag(version);
  const local = await refreshLocalNetworkStatus();
  let status = await getSuiClientStatus();
  const buildEnv = resolveChainBuildEnv(status.activeEnv, local.rpcReady);

  if (useBuildEnvFlag) {
    return { buildEnv, useBuildEnvFlag };
  }

  if (!status.configured) {
    await initSuiClient();
    status = await getSuiClientStatus();
  }

  if (local.rpcReady) {
    await ensureLocalEnvironment();
    status = await getSuiClientStatus();
    const localAlias =
      status.environments.find((env) =>
        ["local", "localnet"].includes(env.alias.toLowerCase()),
      )?.alias ??
      (await findEnvironmentAlias(status, "local")) ??
      (await findEnvironmentAlias(status, "testnet"));
    if (localAlias) {
      await switchSuiEnvironment(localAlias);
      return { buildEnv, useBuildEnvFlag };
    }
  }

  const testnet = await ensureTestnetEnvironment();
  await switchSuiEnvironment(testnet.alias);
  return { buildEnv, useBuildEnvFlag };
}

function buildArgs(
  workspace: string,
  buildEnv: ChainBuildEnv,
  useBuildEnvFlag: boolean,
): string[] {
  const args = [
    "move",
    "build",
    "--dump-bytecode-as-base64",
    "--with-unpublished-dependencies",
  ];

  if (useBuildEnvFlag) {
    args.push("--build-env", buildEnv);
  }

  args.push("-p", workspace);
  return args;
}

export async function buildPlaygroundPackage(
  files: PlaygroundFileInput[],
): Promise<PlaygroundBuildResult> {
  const cli = await checkSuiCli();
  if (!cli.installed) {
    throw new Error(
      "Sui CLI is not installed. Install it from https://docs.sui.io/guides/developer/getting-started/sui-install",
    );
  }

  const workspace = await syncPlaygroundFiles(files);
  const binary = await getManagedSuiBinary();
  const { buildEnv, useBuildEnvFlag } = await prepareBuildEnvironment(cli.version);
  let args = buildArgs(workspace, buildEnv, useBuildEnvFlag);

  const runBuild = async (buildArgsList: string[]) =>
    execFileAsync(binary, buildArgsList, {
      timeout: 300_000,
      maxBuffer: 20 * 1024 * 1024,
      env: toolchainEnv(),
    });

  try {
    let stdout = "";
    let stderr = "";
    try {
      ({ stdout, stderr } = await runBuild(args));
    } catch (firstErr: unknown) {
      const firstErrRecord = firstErr as {
        stderr?: { toString?: () => string };
        stdout?: { toString?: () => string };
      };
      const firstMessage = [
        firstErr instanceof Error ? firstErr.message : String(firstErr),
        firstErrRecord.stderr?.toString?.() ?? "",
        firstErrRecord.stdout?.toString?.() ?? "",
      ]
        .filter(Boolean)
        .join("\n");
      if (!useBuildEnvFlag && needsBuildEnvRetry(firstMessage)) {
        args = buildArgs(workspace, buildEnv, true);
        ({ stdout, stderr } = await runBuild(args));
      } else {
        throw firstErr;
      }
    }

    const combined = `${stdout}\n${stderr}`.trim();
    const jsonLine = combined
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("{"))
      .pop();

    if (!jsonLine) {
      throw new Error(
        combined || "Build finished without bytecode output.",
      );
    }

    const parsed = JSON.parse(jsonLine) as {
      modules?: string[];
      dependencies?: string[];
      digest?: number[];
    };

    if (!parsed.modules?.length) {
      throw new Error("Build succeeded but produced no modules.");
    }

    return {
      modules: parsed.modules,
      dependencies: parsed.dependencies ?? [],
      digest: parsed.digest ?? [],
      stdout,
      stderr,
    };
  } catch (err: any) {
    const stderr = err?.stderr?.toString?.() ?? "";
    const stdout = err?.stdout?.toString?.() ?? "";
    const message = [err?.message, stderr, stdout]
      .filter(Boolean)
      .join("\n")
      .trim();
    throw new Error(message || "Move build failed.");
  }
}

export async function openPlaygroundWorkspace(): Promise<string> {
  const workspace = await getPlaygroundWorkspace();
  return workspace;
}

export async function runPlaygroundShellCommand(command: string): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  const trimmed = command.trim();
  if (!trimmed) {
    throw new Error("Command is empty.");
  }

  const workspace = await getPlaygroundWorkspace();
  await warmToolchainBinaries();
  const shell =
    process.platform === "win32"
      ? process.env.ComSpec || "cmd.exe"
      : process.env.SHELL || "/bin/zsh";
  const args =
    process.platform === "win32"
      ? ["/d", "/s", "/c", trimmed]
      : ["-c", trimmed];

  try {
    const { stdout, stderr } = await execFileAsync(shell, args, {
      cwd: workspace,
      timeout: 300_000,
      maxBuffer: 10 * 1024 * 1024,
      env: toolchainEnv(),
    });
    return {
      stdout: stdout?.toString?.() ?? String(stdout ?? ""),
      stderr: stderr?.toString?.() ?? String(stderr ?? ""),
      exitCode: 0,
    };
  } catch (err: unknown) {
    const failure = err as {
      stdout?: Buffer | string;
      stderr?: Buffer | string;
      message?: string;
      code?: number;
    };
    return {
      stdout: failure.stdout?.toString?.() ?? String(failure.stdout ?? ""),
      stderr:
        failure.stderr?.toString?.() ??
        String(failure.stderr ?? failure.message ?? "Command failed."),
      exitCode: typeof failure.code === "number" ? failure.code : 1,
    };
  }
}