import fs from "node:fs/promises";
import path from "node:path";
import {
  ensureBelugaToolchainWritable,
  getBelugaSuiLocalnetDir,
} from "../beluga-toolchain-path";
import { runSui } from "./client";
import { repairSuiLocalnetNetwork } from "./config-repair";
import { pushLog, suiLocalnetRuntime } from "./runtime";
import type { LocalNetworkStatus, StartLocalNetworkOptions } from "./types";

function resolveSuiLocalnetDir(forIka = false) {
  return getBelugaSuiLocalnetDir(forIka);
}

async function pathExists(target: string) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function getBelugaSuiLocalnetMetaPath(forIka = suiLocalnetRuntime.activeSuiLocalnetForIka) {
  return path.join(resolveSuiLocalnetDir(forIka), "beluga-meta.json");
}

export async function hasBelugaPersistedSuiGenesis(
  forIka = suiLocalnetRuntime.activeSuiLocalnetForIka,
): Promise<boolean> {
  return pathExists(path.join(resolveSuiLocalnetDir(forIka), "network.yaml"));
}

function resolveGenesisEpochMs(options: StartLocalNetworkOptions): string | null {
  if (options.forIka || options.epochDurationMs) {
    return options.epochDurationMs ?? "1000000000000000";
  }
  return null;
}

export async function ensureBelugaPersistedSuiGenesis(
  options: StartLocalNetworkOptions,
  forceReset: boolean,
): Promise<boolean> {
  const forIka = options.forIka === true;
  const dir = resolveSuiLocalnetDir(forIka);
  await fs.mkdir(dir, { recursive: true });

  const exists = await hasBelugaPersistedSuiGenesis(forIka);
  if (exists && !forceReset) {
    pushLog(`Resuming persisted Sui localnet from ${dir}`);
    const repair = await repairSuiLocalnetNetwork(dir, forIka);
    if (repair.pathsRepaired || repair.assetsRestored) {
      const parts: string[] = [];
      if (repair.pathsRepaired) parts.push("config paths");
      if (repair.assetsRestored) parts.push("faucet keystore");
      pushLog(
        `Repaired localnet ${parts.join(" and ")} after toolchain migration — resuming same chain.`,
      );
    }
    return false;
  }

  const args = ["genesis", "--with-faucet", "--working-dir", dir];
  if (forceReset && exists) {
    args.push("-f");
    pushLog("Regenerating persisted Sui genesis (chain reset)…");
  } else {
    pushLog("Creating persisted Sui genesis (first run)…");
  }

  const epochMs = resolveGenesisEpochMs(options);
  if (epochMs) {
    args.push("--epoch-duration-ms", epochMs);
  }

  await runSui(args);

  await fs.writeFile(
    getBelugaSuiLocalnetMetaPath(forIka),
    JSON.stringify(
      {
        forIka: options.forIka === true,
        epochDurationMs: epochMs,
        networkDir: dir,
        createdAt: Date.now(),
      },
      null,
      2,
    ),
    "utf-8",
  );

  return forceReset && exists;
}

/** Regenerate persisted genesis while Sui is stopped (used by localnet reset). */
export async function regenerateBelugaSuiGenesis(
  options: StartLocalNetworkOptions = {},
): Promise<void> {
  const { probeLocalRpcReady } = await import("./network");
  await ensureBelugaToolchainWritable();
  if (await probeLocalRpcReady()) {
    throw new Error(
      "Stop Sui localnet before resetting the chain.",
    );
  }
  suiLocalnetRuntime.activeSuiLocalnetForIka = options.forIka === true;
  await ensureBelugaPersistedSuiGenesis(options, true);
}

/** Reset persisted Move playground Sui genesis (does not touch Ika state). */
export async function resetMoveSuiLocalnet(): Promise<LocalNetworkStatus> {
  const { forceStopLocalNetwork, refreshLocalNetworkStatus } = await import("./network");
  await forceStopLocalNetwork();
  suiLocalnetRuntime.activeSuiLocalnetForIka = false;
  await regenerateBelugaSuiGenesis({ forIka: false, withFaucet: true });
  pushLog(
    "Move Sui localnet reset — press Start in the Move tab CLI panel to boot a fresh chain.",
  );
  return refreshLocalNetworkStatus();
}