import { app } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { getBelugaIkaRepoPath } from "../beluga-toolchain-path";

export function getIkaRepoPath() {
  return getBelugaIkaRepoPath();
}

export function getIkaConfigPath() {
  return path.join(getIkaRepoPath(), "ika_config.json");
}

export function getIkaBinaryPath() {
  const base = path.join(getIkaRepoPath(), "target", "release", "ika");
  return process.platform === "win32" ? `${base}.exe` : base;
}

export function getLegacyIkaRepoPath() {
  return path.join(app.getPath("userData"), "toolchain", "ika");
}

export async function pathExists(target: string) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export function createLocalRpcClient() {
  return new SuiJsonRpcClient({
    url: "http://127.0.0.1:9000",
    network: "testnet",
  });
}