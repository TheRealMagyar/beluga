import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  findListenerPidsOnPort,
  formatElevatedKillHint,
  getProcessOwner,
  killPid,
  pgrepByPattern,
} from "../platform-process";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import {
  ensureBelugaToolchainTmpDir,
  ensureBelugaToolchainWritable,
  getBelugaSuiLocalnetDir,
  getLocalnetSessionPath,
  withBelugaTmpEnv,
} from "../beluga-toolchain-path";
import { spawnWithLineBufferedLogs } from "../localnet-process";
import { toolchainEnv } from "../sui-toolchain";
import {
  DEFAULT_RPC_URL,
  ensureLocalEnvironment,
  switchSuiEnvironment,
} from "./client";
import { describeLocalnetStartupFailure } from "./config-repair";
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

function resolveSuiBinary() {
  return process.env.SUI_BIN || "sui";
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
  for (const pattern of [
    "sui(\\.exe)? start",
    "sui-node(\\.exe)?",
    "sui-faucet(\\.exe)?",
    "sui(\\.exe)? faucet",
  ]) {
    for (const pid of await pgrepByPattern(pattern)) {
      targetPids.add(pid);
    }
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
    args.push("--with-faucet");
  }
  if (options.fullnodeRpcPort) {
    args.push("--fullnode-rpc-port", String(options.fullnodeRpcPort));
  }
  return args;
}

function spawnSuiLocalnetProcess(args: string[], belugaTmpDir: string) {
  suiLocalnetRuntime.warnedUnmanagedSuiLogs = false;
  const child = spawnWithLineBufferedLogs(resolveSuiBinary(), args, {
    env: {
      ...withBelugaTmpEnv(toolchainEnv(), belugaTmpDir),
      RUST_LOG: "off,sui_node=info",
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

export async function refreshLocalNetworkStatus(): Promise<LocalNetworkStatus> {
  suiLocalnetRuntime.lastKnownRpcReady = await probeLocalRpcReady();
  if (!suiLocalnetRuntime.lastKnownRpcReady && suiLocalnetRuntime.localNetworkProcess?.killed) {
    suiLocalnetRuntime.localNetworkProcess = null;
    suiLocalnetRuntime.localNetworkStartedAt = null;
  }
  if (suiLocalnetRuntime.lastKnownRpcReady && !suiLocalnetRuntime.localNetworkProcess) {
    warnUnmanagedSuiLogsOnce();
  }
  return buildLocalNetworkStatus({
    persistedGenesisReady: await hasBelugaPersistedSuiGenesis(),
  });
}

export async function startLocalNetwork(
  options: StartLocalNetworkOptions = {},
): Promise<LocalNetworkStatus> {
  await ensureBelugaToolchainWritable();

  if (suiLocalnetRuntime.localNetworkProcess && !suiLocalnetRuntime.localNetworkProcess.killed) {
    throw new Error("Local network is already running in Beluga.");
  }

  const cli = await execFileAsync(resolveSuiBinary(), ["--version"], {
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
    const { stdout } = await execFileAsync(resolveSuiBinary(), ["--version"], {
      timeout: 10_000,
      env: toolchainEnv(),
    });
    pushLog(`Sui binary: ${stdout.trim().split("\n")[0]}`);
  } catch {
    pushLog(`Sui binary: ${resolveSuiBinary()}`);
  }
  pushLog(`Using writable temp dir ${belugaTmpDir} for Sui.`);
  suiLocalnetRuntime.localNetworkStartedAt = Date.now();
  suiLocalnetRuntime.lastKnownRpcReady = false;

  spawnSuiLocalnetProcess(buildSuiStartArgs(options), belugaTmpDir);

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
    await sleep(500);
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