import path from "node:path";
import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  ensureBelugaMoveHomeDir,
  ensureBelugaToolchainTmpDir,
  ensureBelugaToolchainWritable,
  getIkaPersistedConfigDir,
  withBelugaTmpEnv,
} from "../beluga-toolchain-path";
import { broadcastLocalnetLogs } from "../localnet-log-broadcast";
import { spawnWithLineBufferedLogs } from "../localnet-process";
import { refreshLocalNetworkStatus } from "../sui-client-manager";
import { getToolchainStatus, toolchainEnv } from "../sui-toolchain";
import { IKA_REPO_URL, IKA_START_EPOCH_DURATION_MS } from "./constants";
import { repoIsReady, waitForIkaConfig } from "./config";
import {
  detectIkaFatalStartupError,
  pushIkaLog,
  sessionIkaLogMessages,
} from "./logs";
import {
  formatUnkillableIkaHint,
  findOrphanedIkaStartPidsSync,
  killIkaProcessTree,
  killIkaProcessTreeSync,
  killOrphanedIkaStartProcesses,
} from "./process-kill";
import {
  getIkaBinaryPath,
  getIkaRepoPath,
  pathExists,
} from "./paths";
import {
  getLocalnetResumeStatus,
  refreshLocalnetSessionSnapshot,
} from "./readiness";
import { ikaLocalnetRuntime } from "./runtime";
import { clearLocalnetSession } from "./session";
import { resetIkaLocalnetState, wipeIkaPersistedState } from "./state";
import { getIkaLocalnetStatus } from "./status";
import type { IkaLocalnetStatus, StartIkaLocalnetOptions } from "./types";

const execFileAsync = promisify(execFile);

export async function ensureIkaRepository(): Promise<{
  message: string;
  cloned: boolean;
  repoPath: string;
}> {
  const repoPath = getIkaRepoPath();
  await fs.mkdir(path.dirname(repoPath), { recursive: true });

  if (await repoIsReady(repoPath)) {
    return {
      message: "Ika repository is ready.",
      cloned: false,
      repoPath,
    };
  }

  try {
    await execFileAsync("git", ["--version"], {
      timeout: 10_000,
      env: toolchainEnv(),
    });
  } catch {
    throw new Error(
      "Git is not installed. Install Git to clone the Ika repository.",
    );
  }

  ikaLocalnetRuntime.ikaLogs.length = 0;
  pushIkaLog(`Cloning Ika repository into ${repoPath}...`);

  await execFileAsync("git", ["clone", IKA_REPO_URL, repoPath], {
    timeout: 900_000,
    maxBuffer: 10 * 1024 * 1024,
    env: toolchainEnv(),
  });

  pushIkaLog("Ika repository cloned.");

  return {
    message: "Cloned Ika repository.",
    cloned: true,
    repoPath,
  };
}

export async function startIkaLocalnet(
  options: StartIkaLocalnetOptions = {},
): Promise<IkaLocalnetStatus> {
  const toolchainRoot = await ensureBelugaToolchainWritable();
  const belugaTmpDir = await ensureBelugaToolchainTmpDir();
  const moveHome = await ensureBelugaMoveHomeDir();
  await fs.mkdir(getIkaPersistedConfigDir(), { recursive: true });

  const reset = options.reset === true;
  const suiStatus = await refreshLocalNetworkStatus();
  if (!suiStatus.rpcReady) {
    throw new Error(
      "Start the Sui localnet first. Ika connects to the running Sui node.",
    );
  }

  await ensureIkaRepository();
  const repoPath = getIkaRepoPath();

  if (ikaLocalnetRuntime.ikaProcess?.pid && !ikaLocalnetRuntime.ikaProcess.killed) {
    await killIkaProcessTree(ikaLocalnetRuntime.ikaProcess.pid);
    ikaLocalnetRuntime.ikaProcess = null;
    ikaLocalnetRuntime.ikaStartedAt = null;
  }
  const orphanKill = await killOrphanedIkaStartProcesses(repoPath);
  if (orphanKill.unkillable.length > 0) {
    throw new Error(formatUnkillableIkaHint(orphanKill.unkillable));
  }

  const toolchain = await getToolchainStatus();
  if (!toolchain.cargo.installed || !toolchain.rust.installed) {
    throw new Error(
      "Rust and Cargo are required. Install them from Packages → Toolchain.",
    );
  }

  let resume = await getLocalnetResumeStatus();
  let forceFreshBootstrap = reset;

  if (
    !reset &&
    resume.ikaNetworkConfigReady &&
    resume.ikaConfigReady &&
    !resume.configMatchesPersisted
  ) {
    pushIkaLog(
      "ika_config.json and ~/.ika/network.yaml are out of sync — clearing stale Ika state.",
    );
    await wipeIkaPersistedState();
    await clearLocalnetSession();
    resume = await getLocalnetResumeStatus();
    forceFreshBootstrap = true;
  }

  const canResume = !forceFreshBootstrap && resume.canResumeIka;

  const useFreshBootstrap =
    forceFreshBootstrap || !resume.ikaNetworkConfigReady;

  if (reset) {
    await resetIkaLocalnetState();
  }

  ikaLocalnetRuntime.ikaLogs.length = 0;
  ikaLocalnetRuntime.ikaLogSessionStart = 0;
  broadcastLocalnetLogs("ika", ikaLocalnetRuntime.ikaLogs);
  pushIkaLog("--- Ika localnet start ---");
  ikaLocalnetRuntime.ikaStartedAt = Date.now();
  if (orphanKill.killed.length > 0) {
    pushIkaLog(
      `Stopped ${orphanKill.killed.length} orphaned Ika process(es) before start (pids: ${orphanKill.killed.join(", ")}).`,
    );
  }
  if (canResume) {
    pushIkaLog(
      "Resuming Ika localnet from persisted state (~/.ika). Network DKG should already be on-chain.",
    );
  } else if (forceFreshBootstrap) {
    pushIkaLog(
      "Starting fresh Ika localnet (republishing contracts, network DKG will run again)...",
    );
    pushIkaLog(
      `Using ${Number(IKA_START_EPOCH_DURATION_MS) / 60_000}-minute Ika epochs.`,
    );
  } else {
    pushIkaLog(
      "Starting Ika localnet (first run may take several minutes to compile)...",
    );
    pushIkaLog(
      `Using ${Number(IKA_START_EPOCH_DURATION_MS) / 60_000}-minute Ika epochs. Network DKG may take several more minutes after ika_config.json appears.`,
    );
  }

  const releaseBinary = getIkaBinaryPath();
  let command = "cargo";
  const startArgs = canResume
    ? ["start"]
    : useFreshBootstrap
      ? [
          "start",
          "--force-reinitiation",
          "--epoch-duration-ms",
          IKA_START_EPOCH_DURATION_MS,
        ]
      : ["start"];
  let args = [
    "run",
    "--bin",
    "ika",
    "--release",
    "--no-default-features",
    "--",
    ...startArgs,
  ];

  try {
    await fs.access(releaseBinary);
    command = releaseBinary;
    args = startArgs;
  } catch {
    pushIkaLog("Ika binary not found — compiling via cargo run (first run may take a while)...");
  }

  const ikaConfigDir = getIkaPersistedConfigDir();
  pushIkaLog(`Using Ika network config at ${ikaConfigDir} (toolchain: ${toolchainRoot}).`);
  pushIkaLog(`Using writable temp dir ${belugaTmpDir} for Ika RocksDB.`);
  pushIkaLog(`Using Move cache at ${moveHome} (MOVE_HOME).`);

  const spawnEnv: NodeJS.ProcessEnv = {
    ...withBelugaTmpEnv(toolchainEnv(), belugaTmpDir),
    MOVE_HOME: moveHome,
    IKA_CONFIG_DIR: ikaConfigDir,
    RUST_LOG: process.env.RUST_LOG ?? "info",
    RUST_MIN_STACK: process.env.RUST_MIN_STACK ?? "67108864",
  };

  let spawnCommand = command;
  let spawnArgs = args;
  if (
    process.platform !== "win32" &&
    command === releaseBinary &&
    (await pathExists("/usr/bin/env"))
  ) {
    spawnCommand = "/usr/bin/env";
    spawnArgs = [
      `TMPDIR=${belugaTmpDir}`,
      `TEMP=${belugaTmpDir}`,
      `TMP=${belugaTmpDir}`,
      `MOVE_HOME=${moveHome}`,
      `IKA_CONFIG_DIR=${ikaConfigDir}`,
      releaseBinary,
      ...startArgs,
    ];
    pushIkaLog(`Spawning Ika via env with TMPDIR=${belugaTmpDir}`);
  }

  const child = spawnWithLineBufferedLogs(spawnCommand, spawnArgs, {
    cwd: repoPath,
    env: spawnEnv,
  });

  ikaLocalnetRuntime.ikaProcess = child;

  child.stdout.on("data", (chunk) => {
    pushIkaLog(chunk.toString());
  });
  child.stderr.on("data", (chunk) => {
    pushIkaLog(chunk.toString());
  });
  child.on("exit", (code) => {
    pushIkaLog(`Ika localnet exited with code ${code ?? "unknown"}.`);
    ikaLocalnetRuntime.ikaProcess = null;
    ikaLocalnetRuntime.ikaStartedAt = null;
  });

  const configTimeoutMs = canResume ? 120_000 : 900_000;
  const waitResult = await waitForIkaConfig(configTimeoutMs);
  if (!waitResult.ok) {
    const recent = sessionIkaLogMessages().slice(-24).join("\n");
    if (ikaLocalnetRuntime.ikaProcess && !ikaLocalnetRuntime.ikaProcess.killed) {
      ikaLocalnetRuntime.ikaProcess.kill("SIGKILL");
      ikaLocalnetRuntime.ikaProcess = null;
      ikaLocalnetRuntime.ikaStartedAt = null;
    }
    if (waitResult.reason === "fatal" && waitResult.message) {
      throw new Error(waitResult.message);
    }
    const fatal = detectIkaFatalStartupError(sessionIkaLogMessages());
    if (fatal) {
      throw new Error(fatal);
    }
    if (waitResult.reason === "crashed") {
      throw new Error(
        recent
          ? `Ika localnet exited before ika_config.json was ready.\n\nRecent logs:\n${recent}`
          : "Ika localnet exited before ika_config.json was ready.",
      );
    }
    throw new Error(
      recent
        ? `Ika localnet did not produce ika_config.json in time.\n\nRecent logs:\n${recent}`
        : "Ika localnet did not produce ika_config.json in time.",
    );
  }

  if (canResume) {
    await refreshLocalnetSessionSnapshot();
  }

  return getIkaLocalnetStatus();
}

export async function stopIkaLocalnet(): Promise<IkaLocalnetStatus> {
  await refreshLocalnetSessionSnapshot();

  const repoPath = getIkaRepoPath();
  const hadTrackedProcess =
    ikaLocalnetRuntime.ikaProcess?.pid != null && !ikaLocalnetRuntime.ikaProcess.killed;

  if (hadTrackedProcess && ikaLocalnetRuntime.ikaProcess?.pid) {
    await killIkaProcessTree(ikaLocalnetRuntime.ikaProcess.pid);
  }
  ikaLocalnetRuntime.ikaProcess = null;
  ikaLocalnetRuntime.ikaStartedAt = null;

  const stoppedOrphans = await killOrphanedIkaStartProcesses(repoPath);
  if (stoppedOrphans.killed.length > 0) {
    pushIkaLog(
      `Stopped ${stoppedOrphans.killed.length} orphaned Ika process(es) (pids: ${stoppedOrphans.killed.join(", ")}).`,
    );
  }
  if (hadTrackedProcess || stoppedOrphans.killed.length > 0) {
    pushIkaLog("Ika localnet stopped.");
  }

  return getIkaLocalnetStatus();
}

export function cleanupIkaLocalnet() {
  const repoPath = getIkaRepoPath();

  if (ikaLocalnetRuntime.ikaProcess?.pid && !ikaLocalnetRuntime.ikaProcess.killed) {
    killIkaProcessTreeSync(ikaLocalnetRuntime.ikaProcess.pid);
  }
  ikaLocalnetRuntime.ikaProcess = null;
  ikaLocalnetRuntime.ikaStartedAt = null;

  for (const pid of findOrphanedIkaStartPidsSync(repoPath)) {
    killIkaProcessTreeSync(pid);
  }
}