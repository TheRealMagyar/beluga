import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  findListenerPidsOnPort,
  formatElevatedKillHint,
  getProcessOwner,
  killPid,
  invalidateWindowsProcessCache,
  pgrepByPatterns,
} from "../platform-process";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import {
  ensureBelugaToolchainTmpDir,
  ensureBelugaToolchainWritable,
  getBelugaSuiLocalnetDir,
  getLocalnetSessionPath,
  withBelugaTmpEnv,
} from "../beluga-toolchain-path";
import {
  invalidateLocalNetworkStatusCache,
  readCachedLocalNetworkStatus,
  storeCachedLocalNetworkStatus,
} from "../localnet-status-cache";
import { spawnWithLineBufferedLogs } from "../localnet-process";
import { getManagedSuiBinary, toolchainEnv } from "../sui-toolchain";
import {
  DEFAULT_RPC_URL,
  ensureLocalEnvironment,
  switchSuiEnvironment,
} from "./client";
import { probeLocalFaucetStatus } from "../sui-faucet";
import {
  describeLocalnetStartupFailure,
  ensureSuiLocalnetClientAssets,
} from "./config-repair";
import {
  ensureBelugaPersistedSuiGenesis,
  hasBelugaPersistedSuiGenesis,
} from "./genesis";
import {
  getSuiLocalnetLogMessages,
  pushLog,
  suiLocalnetRuntime,
  warnUnmanagedSuiLogsOnce,
} from "./runtime";

import type { KillSuiProcessesResult, LocalNetworkStatus, StartLocalNetworkOptions } from "./types";

const execFileAsync = promisify(execFile);

export const DEFAULT_FAUCET_URL = "http://127.0.0.1:9123";

function resolveSuiLocalnetDir(forIka = false) {
  return getBelugaSuiLocalnetDir(forIka);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatUnkillableSuiHint(
  unkillable: KillSuiProcessesResult["unkillable"],
): string {
  if (!unkillable.length) {
    return "Port 9000 is still in use. Stop other Sui localnet processes and try again.";
  }
  const pids = unkillable.map((entry) => entry.pid);
  const isRoot = unkillable.some((entry) => entry.owner === "root");
  const elevatedNote = isRoot
    ? " (left over from running Beluga/Sui with elevated permissions)"
    : "";
  return (
    formatElevatedKillHint(pids, `Sui on port 9000${elevatedNote}`) +
    (process.platform === "win32"
      ? " Or run: npm run kill-sui"
      : "")
  );
}

async function killSuiLocalnetProcesses(): Promise<KillSuiProcessesResult> {
  const targetPids = new Set<number>();
  for (const pid of await pgrepByPatterns([
    "sui(\\.exe)? start",
    "sui-node(\\.exe)?",
    "sui-faucet(\\.exe)?",
    "sui(\\.exe)? faucet",
  ])) {
    targetPids.add(pid);
  }
  for (const port of [9000, 9123]) {
    for (const pid of await findListenerPidsOnPort(port)) {
      targetPids.add(pid);
    }
  }

  const killed: number[] = [];
  const unkillable: KillSuiProcessesResult["unkillable"] = [];

  for (const pid of targetPids) {
    const result = await killPid(pid);
    if (result === "killed") {
      killed.push(pid);
    } else if (result === "eperm") {
      unkillable.push({ pid, owner: await getProcessOwner(pid) });
    }
  }

  if (killed.length > 0) {
    invalidateWindowsProcessCache();
    await sleep(750);
  }

  return { killed, unkillable };
}

/** @deprecated use killSuiLocalnetProcesses */
async function killOrphanedSuiStartProcesses(): Promise<number[]> {
  const { killed } = await killSuiLocalnetProcesses();
  return killed;
}

export async function probeLocalRpcReady(
  rpcUrl = DEFAULT_RPC_URL,
): Promise<boolean> {
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "sui_getLatestCheckpointSequenceNumber",
        params: [],
      }),
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) return false;
    const payload = (await response.json()) as { error?: unknown };
    return payload.error == null;
  } catch {
    return false;
  }
}

export interface WaitForLocalFaucetOptions {
  faucetUrl?: string;
  networkDir?: string;
  belugaTmpDir?: string;
  trySupplemental?: boolean;
}

async function resolveSuiFaucetBinary(): Promise<string | null> {
  const suiBin = await getManagedSuiBinary();
  const names =
    process.platform === "win32"
      ? ["sui-faucet.exe", "sui-faucet"]
      : ["sui-faucet"];

  if (suiBin.includes(path.sep)) {
    const dir = path.dirname(suiBin);
    for (const name of names) {
      const candidate = path.join(dir, name);
      try {
        await fs.access(candidate);
        return candidate;
      } catch {
        // try next candidate
      }
    }
  }

  for (const name of names) {
    try {
      await execFileAsync(name, ["--help"], {
        timeout: 5_000,
        env: toolchainEnv(),
      });
      return name;
    } catch {
      // try next candidate
    }
  }

  return null;
}

async function stopSupplementalFaucet() {
  const proc = suiLocalnetRuntime.supplementalFaucetProcess;
  if (!proc || proc.killed) {
    suiLocalnetRuntime.supplementalFaucetProcess = null;
    return;
  }
  const pid = proc.pid;
  if (pid) {
    await killPid(pid);
  } else {
    proc.kill("SIGKILL");
  }
  suiLocalnetRuntime.supplementalFaucetProcess = null;
}

async function tryStartSupplementalLocalFaucet(
  networkDir: string,
  belugaTmpDir: string,
): Promise<boolean> {
  if (
    suiLocalnetRuntime.supplementalFaucetProcess &&
    !suiLocalnetRuntime.supplementalFaucetProcess.killed
  ) {
    return true;
  }

  const binary = await resolveSuiFaucetBinary();
  if (!binary) {
    pushLog(
      "sui-faucet binary not found — embedded faucet is required on this Sui install.",
    );
    return false;
  }

  pushLog(`Starting supplemental sui-faucet (${binary}) for ${networkDir}…`);
  const child = spawnWithLineBufferedLogs(
    binary,
    ["--port", "9123", "--host-ip", "127.0.0.1"],
    {
      env: {
        ...withBelugaTmpEnv(toolchainEnv(), belugaTmpDir),
        SUI_CONFIG_DIR: networkDir,
        RUST_LOG: "info",
      },
    },
  );

  suiLocalnetRuntime.supplementalFaucetProcess = child;
  child.stdout.on("data", (chunk) => {
    pushLog(`[faucet] ${chunk.toString()}`);
  });
  child.stderr.on("data", (chunk) => {
    pushLog(`[faucet] ${chunk.toString()}`);
  });
  child.on("exit", (code) => {
    pushLog(`Supplemental faucet exited with code ${code ?? "unknown"}.`);
    suiLocalnetRuntime.supplementalFaucetProcess = null;
  });

  await sleep(2_000);
  return (await findListenerPidsOnPort(9123)).length > 0;
}

async function ensureLocalnetFaucetAssets(
  networkDir: string,
  forIka: boolean,
): Promise<void> {
  const keystorePath = path.join(networkDir, "sui.keystore");
  try {
    await fs.access(keystorePath);
    return;
  } catch {
    // restore below
  }

  const restored = await ensureSuiLocalnetClientAssets(networkDir, forIka);
  if (restored) {
    pushLog("Restored localnet faucet keystore (sui.keystore).");
  }

  try {
    await fs.access(keystorePath);
  } catch {
    throw new Error(
      "Persisted localnet is missing its faucet keystore (sui.keystore). " +
        "Press Reset in the Ika CLI panel to regenerate genesis.",
    );
  }
}

export async function waitForLocalFaucetReady(
  timeoutMs: number,
  options: WaitForLocalFaucetOptions = {},
): Promise<boolean> {
  const faucetUrl = options.faucetUrl ?? DEFAULT_FAUCET_URL;
  const started = Date.now();
  let supplementalAttempted = false;
  let misconfiguredStreak = 0;

  while (Date.now() - started < timeoutMs) {
    const status = await probeLocalFaucetStatus(faucetUrl);
    if (status === "ready") {
      return true;
    }

    if (status === "misconfigured") {
      misconfiguredStreak += 1;
      if (misconfiguredStreak >= 3) {
        return false;
      }
    } else {
      misconfiguredStreak = 0;
    }

    if (
      options.trySupplemental !== false &&
      !supplementalAttempted &&
      status === "not_listening" &&
      options.networkDir &&
      options.belugaTmpDir &&
      Date.now() - started >= 12_000
    ) {
      supplementalAttempted = true;
      await tryStartSupplementalLocalFaucet(
        options.networkDir,
        options.belugaTmpDir,
      );
    }

    const proc = suiLocalnetRuntime.localNetworkProcess;
    if (proc?.killed) {
      return false;
    }
    if (
      suiLocalnetRuntime.localNetworkStartedAt &&
      !proc &&
      !suiLocalnetRuntime.supplementalFaucetProcess &&
      Date.now() - suiLocalnetRuntime.localNetworkStartedAt > 1_500
    ) {
      return false;
    }
    await sleep(1_000);
  }
  return false;
}

async function describeLocalFaucetStartupFailure(
  logs: string[],
): Promise<string> {
  const knownFailure = describeLocalnetStartupFailure(logs);
  if (knownFailure) {
    return knownFailure;
  }

  const portPids = await findListenerPidsOnPort(9123);
  const status = await probeLocalFaucetStatus();
  let diagnosis = "";
  if (portPids.length === 0) {
    diagnosis =
      "Port 9123 is not listening — the Sui faucet process never started.";
  } else if (status === "misconfigured") {
    diagnosis =
      "Port 9123 is listening but faucet requests fail (missing or invalid sui.keystore).";
  } else if (status === "warming_up") {
    diagnosis =
      "Port 9123 is listening but faucet is not accepting fund requests yet.";
  }

  return (
    "Sui localnet faucet did not become ready on http://127.0.0.1:9123. " +
    "Ika needs the faucet to fund its publisher address during bootstrap.\n\n" +
    "Press Reset in the Ika CLI panel, then Start again. " +
    "If another Sui process is using port 9000 without a faucet, stop it first." +
    (diagnosis ? `\n\nDiagnosis: ${diagnosis}` : "")
  );
}

async function waitForLocalRpcReady(timeoutMs: number): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await probeLocalRpcReady()) {
      suiLocalnetRuntime.lastKnownRpcReady = true;
      return true;
    }
    const proc = suiLocalnetRuntime.localNetworkProcess;
    if (proc?.killed) {
      return false;
    }
    if (
      suiLocalnetRuntime.localNetworkStartedAt &&
      !proc &&
      Date.now() - suiLocalnetRuntime.localNetworkStartedAt > 1_500
    ) {
      return false;
    }
    await sleep(1_000);
  }
  return false;
}

export function buildLocalNetworkStatus(
  extras: Partial<LocalNetworkStatus> = {},
): LocalNetworkStatus {
  const managed = suiLocalnetRuntime.localNetworkProcess != null && !suiLocalnetRuntime.localNetworkProcess.killed;
  return {
    running: managed || suiLocalnetRuntime.lastKnownRpcReady,
    rpcReady: suiLocalnetRuntime.lastKnownRpcReady,
    managed,
    pid: suiLocalnetRuntime.localNetworkProcess?.pid ?? null,
    rpcUrl: DEFAULT_RPC_URL,
    faucetUrl: DEFAULT_FAUCET_URL,
    startedAt: suiLocalnetRuntime.localNetworkStartedAt,
    recentLogs: getSuiLocalnetLogMessages(),
    forIka: suiLocalnetRuntime.activeSuiLocalnetForIka,
    ...extras,
  };
}

async function persistSuiLocalnetSession() {
  try {
    const client = new SuiJsonRpcClient({
      url: DEFAULT_RPC_URL,
      network: "testnet",
    });
    const chainId = await client.getChainIdentifier();
    let session: Record<string, unknown> = {};
    try {
      const raw = await fs.readFile(getLocalnetSessionPath(), "utf-8");
      session = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      // no session yet
    }
    await fs.mkdir(path.dirname(getLocalnetSessionPath()), { recursive: true });
    await fs.writeFile(
      getLocalnetSessionPath(),
      JSON.stringify(
        {
          ...session,
          suiChainId: chainId,
          suiNetworkDir: resolveSuiLocalnetDir(suiLocalnetRuntime.activeSuiLocalnetForIka),
          suiSavedAt: Date.now(),
        },
        null,
        2,
      ),
      "utf-8",
    );
  } catch {
    // non-fatal
  }
}

function buildSuiStartArgs(options: StartLocalNetworkOptions): string[] {
  const args = [
    "start",
    "--network.config",
    resolveSuiLocalnetDir(options.forIka === true),
  ];
  if (options.withFaucet !== false) {
    args.push(
      process.platform === "win32"
        ? "--with-faucet=127.0.0.1:9123"
        : "--with-faucet",
    );
  }
  if (options.fullnodeRpcPort) {
    args.push("--fullnode-rpc-port", String(options.fullnodeRpcPort));
  }
  return args;
}

async function spawnSuiLocalnetProcess(
  args: string[],
  belugaTmpDir: string,
  withFaucet: boolean,
) {
  suiLocalnetRuntime.warnedUnmanagedSuiLogs = false;
  const rustLog =
    withFaucet && process.platform === "win32"
      ? "off,sui_node=info,sui_faucet=info"
      : "off,sui_node=info";
  const suiBinary = await getManagedSuiBinary();
  const child = spawnWithLineBufferedLogs(suiBinary, args, {
    env: {
      ...withBelugaTmpEnv(toolchainEnv(), belugaTmpDir),
      RUST_LOG: rustLog,
    },
  });

  suiLocalnetRuntime.localNetworkProcess = child;

  child.stdout.on("data", (chunk) => {
    pushLog(chunk.toString());
  });
  child.stderr.on("data", (chunk) => {
    pushLog(chunk.toString());
  });
  child.on("exit", (code) => {
    pushLog(`Local network exited with code ${code ?? "unknown"}.`);
    suiLocalnetRuntime.localNetworkProcess = null;
    suiLocalnetRuntime.localNetworkStartedAt = null;
    void probeLocalRpcReady().then((ready) => {
      suiLocalnetRuntime.lastKnownRpcReady = ready;
    });
  });

  return child;
}

export function getLocalNetworkStatus(): LocalNetworkStatus {
  return buildLocalNetworkStatus();
}

export async function refreshLocalNetworkStatus(options?: {
  force?: boolean;
}): Promise<LocalNetworkStatus> {
  if (!options?.force) {
    const cached = readCachedLocalNetworkStatus();
    if (cached) return cached;
  }

  suiLocalnetRuntime.lastKnownRpcReady = await probeLocalRpcReady();
  if (!suiLocalnetRuntime.lastKnownRpcReady && suiLocalnetRuntime.localNetworkProcess?.killed) {
    suiLocalnetRuntime.localNetworkProcess = null;
    suiLocalnetRuntime.localNetworkStartedAt = null;
  }
  if (suiLocalnetRuntime.lastKnownRpcReady && !suiLocalnetRuntime.localNetworkProcess) {
    warnUnmanagedSuiLogsOnce();
  }
  const status = buildLocalNetworkStatus({
    persistedGenesisReady: await hasBelugaPersistedSuiGenesis(),
  });
  storeCachedLocalNetworkStatus(status);
  return status;
}

export async function startLocalNetwork(
  options: StartLocalNetworkOptions = {},
): Promise<LocalNetworkStatus> {
  invalidateLocalNetworkStatusCache();
  await ensureBelugaToolchainWritable();

  if (suiLocalnetRuntime.localNetworkProcess && !suiLocalnetRuntime.localNetworkProcess.killed) {
    throw new Error("Local network is already running in Beluga.");
  }

  const suiBinary = await getManagedSuiBinary();
  const cli = await execFileAsync(suiBinary, ["--version"], {
    timeout: 10_000,
    env: toolchainEnv(),
  }).catch(() => null);

  if (!cli) {
    throw new Error(
      "Sui CLI is not installed. Install it from the Packages toolchain section.",
    );
  }

  const requestedForIka = options.forIka === true;

  if (await probeLocalRpcReady()) {
    if (options.forceRegenesis) {
      pushLog("Stopping existing Sui localnet for chain reset…");
      await forceStopLocalNetwork();
    } else if (requestedForIka !== suiLocalnetRuntime.activeSuiLocalnetForIka) {
      pushLog(
        requestedForIka
          ? "Switching port 9000 from Move Sui to Ika-compatible Sui localnet…"
          : "Switching port 9000 from Ika Sui to Move Sui localnet…",
      );
      await forceStopLocalNetwork();
    } else if (!suiLocalnetRuntime.localNetworkProcess) {
      pushLog(
        "Restarting Sui to attach live logs to Beluga (same persisted chain)…",
      );
      await forceStopLocalNetwork();
    } else {
      pushLog(
        `Sui localnet already running (Beluga managed, ${requestedForIka ? "Ika" : "Move"} profile).`,
      );
      try {
        await ensureLocalEnvironment();
        await switchSuiEnvironment("localnet");
      } catch {
        // User can switch manually if env setup fails.
      }
      suiLocalnetRuntime.lastKnownRpcReady = true;
      return buildLocalNetworkStatus({
        persistedGenesisReady: await hasBelugaPersistedSuiGenesis(requestedForIka),
        forIka: requestedForIka,
      });
    }
  }

  await killOrphanedSuiStartProcesses();

  const chainReset = await ensureBelugaPersistedSuiGenesis(
    options,
    options.forceRegenesis === true,
  );

  suiLocalnetRuntime.activeSuiLocalnetForIka = requestedForIka;
  const belugaTmpDir = await ensureBelugaToolchainTmpDir();
  const networkDir = resolveSuiLocalnetDir(requestedForIka);

  pushLog("--- Sui localnet start ---");
  pushLog(
    `Profile: ${requestedForIka ? "Ika-compatible" : "Move playground"} · config ${networkDir}`,
  );
  try {
    const { stdout } = await execFileAsync(suiBinary, ["--version"], {
      timeout: 10_000,
      env: toolchainEnv(),
    });
    pushLog(`Sui binary: ${stdout.trim().split("\n")[0]} (${suiBinary})`);
  } catch {
    pushLog(`Sui binary: ${suiBinary}`);
  }
  pushLog(`Using writable temp dir ${belugaTmpDir} for Sui.`);
  suiLocalnetRuntime.localNetworkStartedAt = Date.now();
  suiLocalnetRuntime.lastKnownRpcReady = false;

  const withFaucet = options.withFaucet !== false;
  if (withFaucet) {
    await ensureLocalnetFaucetAssets(networkDir, requestedForIka);
  }

  await spawnSuiLocalnetProcess(buildSuiStartArgs(options), belugaTmpDir, withFaucet);

  const ready = await waitForLocalRpcReady(120_000);
  if (!ready) {
    const recentLogs = getSuiLocalnetLogMessages();
    const recent = recentLogs.slice(-12).join("\n");
    const knownFailure = describeLocalnetStartupFailure(recentLogs);
    await stopLocalNetwork();
    throw new Error(
      knownFailure ??
        (recent
          ? `Sui localnet did not become ready within 2 minutes.\n\nRecent logs:\n${recent}`
          : "Sui localnet did not become ready within 2 minutes."),
    );
  }

  if (withFaucet) {
    pushLog("Waiting for Sui faucet on port 9123…");
    const faucetTimeoutMs = process.platform === "win32" ? 180_000 : 120_000;
    const faucetReady = await waitForLocalFaucetReady(faucetTimeoutMs, {
      networkDir,
      belugaTmpDir,
      trySupplemental: true,
    });
    if (!faucetReady) {
      const recentLogs = getSuiLocalnetLogMessages();
      const recent = recentLogs.slice(-12).join("\n");
      const message = await describeLocalFaucetStartupFailure(recentLogs);
      await stopLocalNetwork();
      throw new Error(
        recent ? `${message}\n\nRecent logs:\n${recent}` : message,
      );
    }
    pushLog("Sui faucet is ready.");
  }

  return finishLocalNetworkStart(options, chainReset);
}

async function finishLocalNetworkStart(
  _options: StartLocalNetworkOptions,
  chainReset: boolean,
): Promise<LocalNetworkStatus> {
  try {
    await ensureLocalEnvironment();
    await switchSuiEnvironment("localnet");
  } catch {
    // Network is up; env switch can be retried from the panel.
  }

  await persistSuiLocalnetSession();

  return buildLocalNetworkStatus({
    chainReset,
    persistedGenesisReady: true,
  });
}

export async function forceStopLocalNetwork(): Promise<LocalNetworkStatus> {
  invalidateLocalNetworkStatusCache();
  await stopLocalNetwork();

  const started = Date.now();
  let lastUnkillable: KillSuiProcessesResult["unkillable"] = [];

  while (Date.now() - started < 30_000) {
    if (!(await probeLocalRpcReady())) {
      suiLocalnetRuntime.lastKnownRpcReady = false;
      pushLog("Local network fully stopped.");
      return buildLocalNetworkStatus({
        persistedGenesisReady: await hasBelugaPersistedSuiGenesis(),
      });
    }

    const result = await killSuiLocalnetProcesses();
    lastUnkillable = result.unkillable;
    if (result.unkillable.length > 0) {
      break;
    }
    await sleep(process.platform === "win32" ? 2_000 : 500);
  }

  suiLocalnetRuntime.lastKnownRpcReady = await probeLocalRpcReady();
  if (suiLocalnetRuntime.lastKnownRpcReady) {
    const hint = formatUnkillableSuiHint(lastUnkillable);
    pushLog(hint);
    throw new Error(hint);
  }

  return buildLocalNetworkStatus({
    persistedGenesisReady: await hasBelugaPersistedSuiGenesis(),
  });
}

export async function stopLocalNetwork(): Promise<LocalNetworkStatus> {
  invalidateLocalNetworkStatusCache();
  await stopSupplementalFaucet();

  if (suiLocalnetRuntime.localNetworkProcess && !suiLocalnetRuntime.localNetworkProcess.killed) {
    const pid = suiLocalnetRuntime.localNetworkProcess.pid;
    if (pid) {
      await killPid(pid);
    } else {
      suiLocalnetRuntime.localNetworkProcess.kill("SIGKILL");
    }
  }

  suiLocalnetRuntime.localNetworkProcess = null;
  suiLocalnetRuntime.localNetworkStartedAt = null;
  const killResult = await killSuiLocalnetProcesses();
  suiLocalnetRuntime.lastKnownRpcReady = await probeLocalRpcReady();

  if (suiLocalnetRuntime.lastKnownRpcReady) {
    const hint = formatUnkillableSuiHint(killResult.unkillable);
    pushLog(
      killResult.unkillable.length > 0
        ? hint
        : "Beluga stopped its process, but port 9000 is still in use.",
    );
  } else {
    suiLocalnetRuntime.lastKnownRpcReady = false;
    pushLog("Local network stopped.");
  }

  return buildLocalNetworkStatus({
    persistedGenesisReady: await hasBelugaPersistedSuiGenesis(),
  });
}

export async function requestLocalFaucet(
  recipient: string,
): Promise<{ message: string }> {
  const status = await refreshLocalNetworkStatus();
  if (!status.rpcReady) {
    throw new Error("Local network is not running.");
  }

  const target = recipient?.trim();
  if (!target) {
    throw new Error("Wallet address is required.");
  }

  const { requestLocalFaucetCoins } = await import("../sui-faucet");
  const result = await requestLocalFaucetCoins(target, status.faucetUrl);
  return { message: result.message };
}

export function cleanupLocalNetwork() {
  if (
    suiLocalnetRuntime.supplementalFaucetProcess &&
    !suiLocalnetRuntime.supplementalFaucetProcess.killed
  ) {
    const pid = suiLocalnetRuntime.supplementalFaucetProcess.pid;
    if (pid) {
      void killPid(pid);
    } else {
      suiLocalnetRuntime.supplementalFaucetProcess.kill("SIGKILL");
    }
  }
  suiLocalnetRuntime.supplementalFaucetProcess = null;

  if (suiLocalnetRuntime.localNetworkProcess && !suiLocalnetRuntime.localNetworkProcess.killed) {
    const pid = suiLocalnetRuntime.localNetworkProcess.pid;
    if (pid) {
      void killPid(pid);
    } else {
      suiLocalnetRuntime.localNetworkProcess.kill("SIGKILL");
    }
  }
  suiLocalnetRuntime.localNetworkProcess = null;
  suiLocalnetRuntime.localNetworkStartedAt = null;
  suiLocalnetRuntime.lastKnownRpcReady = false;
}