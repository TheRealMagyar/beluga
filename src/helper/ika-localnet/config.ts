import path from "node:path";
import fs from "node:fs/promises";
import { getIkaNetworkConfigPath } from "../beluga-toolchain-path";
import {
  createLocalRpcClient,
  getIkaConfigPath,
  pathExists,
} from "./paths";
import {
  pushIkaLog,
  detectIkaFatalStartupError,
  sessionIkaLogMessages,
} from "./logs";
import {ikaLocalnetRuntime} from "./runtime";
import { sleep } from "./process-kill";
import type { IkaLocalnetConfigFile, IkaLocalnetConfigStatus } from "./types";

export async function getIkaLocalnetConfig(): Promise<IkaLocalnetConfigStatus> {
  const configPath = getIkaConfigPath();
  try {
    const raw = await fs.readFile(configPath, "utf-8");
    const config = JSON.parse(raw) as IkaLocalnetConfigFile;
    if (!config?.packages?.ika_package_id || !config?.objects?.ika_system_object_id) {
      return { ready: false, path: configPath, config: null };
    }
    return { ready: true, path: configPath, config };
  } catch {
    return { ready: false, path: null, config: null };
  }
}

export async function invalidateIkaLocalnetConfig(): Promise<void> {
  const configPath = getIkaConfigPath();
  try {
    await fs.unlink(configPath);
    pushIkaLog(
      "Removed stale ika_config.json. Restart Ika localnet after resetting Sui.",
    );
  } catch {
    // no config yet
  }
}

async function objectExistsOnChain(objectId: string): Promise<boolean> {
  try {
    const client = createLocalRpcClient();
    const response = await client.getObject({
      id: objectId,
      options: { showContent: true },
    });
    return response.data != null && response.error == null;
  } catch {
    return false;
  }
}

async function readPersistedNetworkObjectIds(): Promise<{
  systemId: string;
  coordinatorId: string;
} | null> {
  const yamlPath = getIkaNetworkConfigPath();
  if (!(await pathExists(yamlPath))) return null;

  const raw = await fs.readFile(yamlPath, "utf-8");
  const systemMatch = raw.match(
    /^ika_system_object_id:\s*"(0x[a-f0-9]+)"/m,
  );
  const coordinatorMatch = raw.match(
    /^ika_dwallet_coordinator_object_id:\s*"(0x[a-f0-9]+)"/m,
  );
  if (!systemMatch || !coordinatorMatch) return null;

  return {
    systemId: systemMatch[1],
    coordinatorId: coordinatorMatch[1],
  };
}

export async function verifyIkaConfigMatchesPersistedState(
  config: IkaLocalnetConfigFile,
): Promise<boolean> {
  const persisted = await readPersistedNetworkObjectIds();
  if (!persisted) return true;

  return (
    persisted.systemId === config.objects.ika_system_object_id &&
    persisted.coordinatorId === config.objects.ika_dwallet_coordinator_object_id
  );
}

export async function verifyAllIkaObjectsOnChain(
  config: IkaLocalnetConfigFile,
): Promise<boolean> {
  const [systemOk, coordinatorOk] = await Promise.all([
    objectExistsOnChain(config.objects.ika_system_object_id),
    objectExistsOnChain(config.objects.ika_dwallet_coordinator_object_id),
  ]);
  return systemOk && coordinatorOk;
}

export async function repoIsReady(repoPath: string) {
  try {
    await fs.access(path.join(repoPath, "Cargo.toml"));
    return true;
  } catch {
    return false;
  }
}

type WaitForIkaConfigResult =
  | { ok: true }
  | { ok: false; reason: "timeout" | "crashed" | "fatal"; message?: string };

export async function waitForIkaConfig(
  timeoutMs: number,
): Promise<WaitForIkaConfigResult> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const sessionLogs = sessionIkaLogMessages();
    const fatal =
      Date.now() - started >= 1_000
        ? detectIkaFatalStartupError(sessionLogs)
        : null;
    if (fatal) {
      return { ok: false, reason: "fatal", message: fatal };
    }

    const config = await getIkaLocalnetConfig();
    if (config.ready) {
      pushIkaLog(`ika_config.json ready at ${config.path}`);
      return { ok: true };
    }
    if (!ikaLocalnetRuntime.ikaProcess || ikaLocalnetRuntime.ikaProcess.killed) {
      const fatalAfterExit = detectIkaFatalStartupError(sessionLogs);
      if (fatalAfterExit) {
        return { ok: false, reason: "fatal", message: fatalAfterExit };
      }
      return { ok: false, reason: "crashed" };
    }
    await sleep(2_000);
  }
  return { ok: false, reason: "timeout" };
}