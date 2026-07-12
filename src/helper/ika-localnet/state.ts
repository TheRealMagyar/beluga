import path from "node:path";
import fs from "node:fs/promises";
import {
  getIkaNetworkRoot,
  resolveBelugaToolchainRoot,
} from "../beluga-toolchain-path";
import { invalidateIkaLocalnetConfig, repoIsReady } from "./config";
import { pushIkaLog } from "./logs";
import { getIkaRepoPath, getLegacyIkaRepoPath } from "./paths";
import { clearCachedChainReadiness } from "./readiness";
import { clearLocalnetSession } from "./session";

export async function wipeIkaPersistedState(): Promise<void> {
  await resolveBelugaToolchainRoot();
  const ikaHome = getIkaNetworkRoot();
  try {
    await fs.rm(ikaHome, { recursive: true, force: true });
    pushIkaLog(`Removed persisted Ika state at ${ikaHome}.`);
  } catch {
    // already clean
  }
}

export async function resetIkaLocalnetState(): Promise<void> {
  clearCachedChainReadiness();
  await invalidateIkaLocalnetConfig();
  await wipeIkaPersistedState();
  await clearLocalnetSession();
}

export async function migrateIkaToolchainIfNeeded(): Promise<string | null> {
  const newPath = getIkaRepoPath();
  const legacyPath = getLegacyIkaRepoPath();
  if (newPath === legacyPath) return null;
  if (await repoIsReady(newPath)) return null;
  if (!(await repoIsReady(legacyPath))) return null;

  await fs.mkdir(path.dirname(newPath), { recursive: true });
  await fs.rename(legacyPath, newPath);
  await fs.rm(path.join(newPath, "target"), { recursive: true, force: true });
  return `Moved Ika repository to ${newPath} and cleared stale build artifacts. Run Build Ika CLI again.`;
}