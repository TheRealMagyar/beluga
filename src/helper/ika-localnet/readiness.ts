import {
  readCachedIkaReadiness,
  storeCachedIkaReadiness,
} from "../localnet-status-cache";
import {
  getBelugaToolchainRoot,
  getIkaNetworkConfigPath,
  isBelugaToolchainWritable,
  resolveBelugaToolchainRoot,
} from "../beluga-toolchain-path";
import {
  hasBelugaPersistedSuiGenesis,
  refreshLocalNetworkStatus,
} from "../sui-client-manager";
import {
  getIkaLocalnetConfig,
  verifyAllIkaObjectsOnChain,
  verifyIkaConfigMatchesPersistedState,
} from "./config";
import {
  COMPLETED_ENCRYPTION_KEY_STATES,
  MIN_COORDINATOR_EPOCH_FOR_DWALLET,
  READINESS_STICKY_MS,
  TRANSIENT_USABLE_ENCRYPTION_KEY_STATES,
} from "./constants";
import { createLocalRpcClient, pathExists } from "./paths";
import { loadLocalnetSession, saveLocalnetSession } from "./session";
import type { IkaChainReadiness, IkaLocalnetConfigFile, LocalnetResumeStatus } from "./types";

let cachedChainReadiness: {
  capturedAt: number;
  value: IkaChainReadiness;
} | null = null;

export function clearCachedChainReadiness(): void {
  cachedChainReadiness = null;
}

function isEncryptionKeyUsableForDwallet(
  state: string | null,
  coordinatorEpoch: number | null,
): boolean {
  if (!state) return false;
  if (COMPLETED_ENCRYPTION_KEY_STATES.has(state)) return true;
  if (
    TRANSIENT_USABLE_ENCRYPTION_KEY_STATES.has(state) &&
    coordinatorEpoch != null &&
    coordinatorEpoch >= MIN_COORDINATOR_EPOCH_FOR_DWALLET
  ) {
    return true;
  }
  return false;
}

function applyStickyChainReadiness(
  current: IkaChainReadiness,
): IkaChainReadiness {
  const now = Date.now();
  if (current.protocolOnChainReady) {
    cachedChainReadiness = { capturedAt: now, value: current };
    return current;
  }

  const cached = cachedChainReadiness;
  if (
    cached &&
    now - cached.capturedAt < READINESS_STICKY_MS &&
    cached.value.protocolOnChainReady
  ) {
    return {
      ...cached.value,
      latestSuiCheckpoint:
        current.latestSuiCheckpoint ?? cached.value.latestSuiCheckpoint,
      lastProcessedCheckpoint:
        current.lastProcessedCheckpoint ?? cached.value.lastProcessedCheckpoint,
      suiCheckpointLag:
        current.suiCheckpointLag ?? cached.value.suiCheckpointLag,
      coordinatorEpoch:
        current.coordinatorEpoch ?? cached.value.coordinatorEpoch,
      readinessHint:
        current.readinessHint ??
        cached.value.readinessHint ??
        "Network DKG was ready — refreshing on-chain state…",
    };
  }

  return current;
}

function extractCoordinatorInnerFields(
  content: { dataType: string; fields?: unknown } | null | undefined,
): Record<string, unknown> | null {
  if (!content || content.dataType !== "moveObject") return null;
  const fields = content.fields;
  if (!fields || typeof fields !== "object") return null;
  if ("value" in (fields as Record<string, unknown>)) {
    const wrapped = (fields as { value: { fields?: Record<string, unknown> } })
      .value;
    return wrapped?.fields ?? null;
  }
  return fields as Record<string, unknown>;
}

function readEncryptionKeyStateVariant(
  state: unknown,
): string | null {
  if (!state || typeof state !== "object") return null;
  const variant = (state as { variant?: string }).variant;
  if (typeof variant === "string") return variant;
  const keys = Object.keys(state).filter((key) => key !== "type");
  return keys[0] ?? null;
}

export async function probeIkaChainReadiness(
  config: IkaLocalnetConfigFile,
): Promise<IkaChainReadiness> {
  const cacheKey = `${config.objects.ika_system_object_id}:${config.objects.ika_dwallet_coordinator_object_id}`;
  const empty: IkaChainReadiness = {
    dkgChunksReady: false,
    dkgChunkCount: 0,
    encryptionKeyState: null,
    coordinatorEpoch: null,
    lastProcessedCheckpoint: null,
    latestSuiCheckpoint: null,
    suiCheckpointLag: null,
    coordinatorEpochReady: false,
    protocolOnChainReady: false,
    dwalletReady: false,
    readinessHint: "Ika on-chain state is not available yet.",
  };

  const cachedReady = readCachedIkaReadiness(cacheKey, true);
  if (cachedReady?.dwalletReady) return cachedReady;
  const cachedProbe = readCachedIkaReadiness(cacheKey, false);
  if (cachedProbe) return cachedProbe;

  try {
    if (!(await verifyIkaConfigMatchesPersistedState(config))) {
      return {
        ...empty,
        readinessHint:
          "ika_config.json and ~/.ika/network.yaml disagree — reset Ika localnet.",
      };
    }
    if (!(await verifyAllIkaObjectsOnChain(config))) {
      return {
        ...empty,
        readinessHint: "Ika system/coordinator objects are missing on Sui.",
      };
    }

    const client = createLocalRpcClient();
    const latestSuiCheckpoint = await client
      .getLatestCheckpointSequenceNumber()
      .catch(() => null);
    const latestSuiCheckpointStr =
      latestSuiCheckpoint != null ? latestSuiCheckpoint.toString() : null;

    const coordinatorId = config.objects.ika_dwallet_coordinator_object_id;
    const coordinatorDfs = await client.getDynamicFields({
      parentId: coordinatorId,
    });
    const innerEntries = coordinatorDfs.data ?? [];
    if (!innerEntries.length) return empty;

    const innerId = innerEntries[innerEntries.length - 1].objectId;
    const innerObj = await client.getObject({
      id: innerId,
      options: { showContent: true },
    });
    const innerFields = extractCoordinatorInnerFields(innerObj.data?.content ?? null);
    if (!innerFields) return empty;

    const coordinatorEpoch =
      innerFields.current_epoch != null
        ? String(innerFields.current_epoch)
        : null;
    const lastProcessedCheckpoint =
      innerFields.last_processed_checkpoint_sequence_number != null
        ? String(innerFields.last_processed_checkpoint_sequence_number)
        : null;

    let suiCheckpointLag: number | null = null;
    if (latestSuiCheckpointStr != null && lastProcessedCheckpoint != null) {
      suiCheckpointLag =
        Number(latestSuiCheckpointStr) - Number(lastProcessedCheckpoint);
      if (!Number.isFinite(suiCheckpointLag)) {
        suiCheckpointLag = null;
      }
    }

    const keysTable = innerFields.dwallet_network_encryption_keys as {
      fields?: { id?: { id?: string } };
    };
    const keysTableId = keysTable?.fields?.id?.id;
    if (!keysTableId) return { ...empty, coordinatorEpoch, lastProcessedCheckpoint, latestSuiCheckpoint: latestSuiCheckpointStr, suiCheckpointLag };

    const keyDfs = await client.getDynamicFields({ parentId: keysTableId });
    let dkgChunkCount = 0;
    let encryptionKeyState: string | null = null;
    let encryptionStateReady = false;
    const coordinatorEpochNum =
      coordinatorEpoch != null ? Number(coordinatorEpoch) : null;

    for (const keyDf of keyDfs.data ?? []) {
      const keyObj = await client.getObject({
        id: keyDf.objectId,
        options: { showContent: true },
      });
      const keyContent = keyObj.data?.content;
      if (!keyContent || keyContent.dataType !== "moveObject") continue;

      const keyFields = keyContent.fields as Record<string, unknown>;
      const keyState = readEncryptionKeyStateVariant(keyFields.state);

      const dkgOutput = keyFields.network_dkg_public_output as {
        fields?: { contents?: { fields?: { id?: { id?: string } } } };
      };
      const dkgTableId = dkgOutput?.fields?.contents?.fields?.id?.id;
      if (!dkgTableId) continue;

      const chunks = await client.getDynamicFields({ parentId: dkgTableId });
      const chunkCount = chunks.data?.length ?? 0;
      dkgChunkCount = Math.max(dkgChunkCount, chunkCount);

      if (
        chunkCount > 0 &&
        isEncryptionKeyUsableForDwallet(keyState, coordinatorEpochNum)
      ) {
        encryptionStateReady = true;
        if (
          keyState &&
          COMPLETED_ENCRYPTION_KEY_STATES.has(keyState) &&
          (!encryptionKeyState ||
            !COMPLETED_ENCRYPTION_KEY_STATES.has(encryptionKeyState))
        ) {
          encryptionKeyState = keyState;
        } else if (!encryptionKeyState) {
          encryptionKeyState = keyState;
        }
      }
    }

    const dkgChunksReady = dkgChunkCount > 0;
    const coordinatorEpochReady =
      coordinatorEpochNum != null &&
      coordinatorEpochNum >= MIN_COORDINATOR_EPOCH_FOR_DWALLET;

    const protocolOnChainReady =
      dkgChunksReady && encryptionStateReady && coordinatorEpochReady;

    let readinessHint: string | null = null;
    if (!dkgChunksReady) {
      readinessHint =
        "Network DKG chunks are not on-chain yet. Wait a few minutes after ika_config.json.";
    } else if (!encryptionStateReady) {
      readinessHint = `Encryption key state is ${encryptionKeyState ?? "unknown"} — wait for network DKG to finish.`;
    } else if (!coordinatorEpochReady) {
      readinessHint = `Coordinator epoch is ${coordinatorEpoch ?? "?"} — wait until epoch ${MIN_COORDINATOR_EPOCH_FOR_DWALLET}+ (Ika playbook).`;
    } else if (
      encryptionKeyState &&
      TRANSIENT_USABLE_ENCRYPTION_KEY_STATES.has(encryptionKeyState)
    ) {
      readinessHint =
        "Epoch reconfiguration in progress — dWallet creation remains available.";
    }

    const dwalletReady = protocolOnChainReady;

    const readiness = applyStickyChainReadiness({
      dkgChunksReady,
      dkgChunkCount,
      encryptionKeyState,
      coordinatorEpoch,
      lastProcessedCheckpoint,
      latestSuiCheckpoint: latestSuiCheckpointStr,
      suiCheckpointLag,
      coordinatorEpochReady,
      protocolOnChainReady,
      dwalletReady,
      readinessHint,
    });
    storeCachedIkaReadiness(cacheKey, readiness);
    return readiness;
  } catch {
    const cached = cachedChainReadiness;
    if (
      cached &&
      Date.now() - cached.capturedAt < READINESS_STICKY_MS &&
      cached.value.protocolOnChainReady
    ) {
      return cached.value;
    }
    return empty;
  }
}

export async function probeIkaNetworkDkgOnChain(
  config: IkaLocalnetConfigFile,
): Promise<boolean> {
  const readiness = await probeIkaChainReadiness(config);
  return readiness.protocolOnChainReady;
}

export async function getLocalnetResumeStatus(): Promise<LocalnetResumeStatus> {
  let toolchainRoot = getBelugaToolchainRoot();
  let toolchainWritable = await isBelugaToolchainWritable(toolchainRoot);

  try {
    toolchainRoot = await resolveBelugaToolchainRoot();
    toolchainWritable = await isBelugaToolchainWritable(toolchainRoot);
  } catch {
    toolchainWritable = false;
  }

  const config = await getIkaLocalnetConfig();
  const ikaNetworkConfigReady = await pathExists(getIkaNetworkConfigPath());
  const session = await loadLocalnetSession();
  const suiStatus = await refreshLocalNetworkStatus();
  const suiGenesisReady = await hasBelugaPersistedSuiGenesis(true);

  const configMatchesPersisted =
    config.ready && config.config
      ? await verifyIkaConfigMatchesPersistedState(config.config)
      : true;

  let canResumeSui = suiGenesisReady;
  if (canResumeSui && session?.suiChainId && suiStatus.rpcReady) {
    try {
      const chainId = await createLocalRpcClient().getChainIdentifier();
      if (chainId !== session.suiChainId) {
        canResumeSui = false;
      }
    } catch {
      canResumeSui = false;
    }
  }

  let canResumeIka =
    canResumeSui &&
    config.ready &&
    ikaNetworkConfigReady &&
    configMatchesPersisted;

  let suiCheckpointLag: number | null = null;

  if (canResumeIka && config.config && suiStatus.rpcReady) {
    canResumeIka = await verifyAllIkaObjectsOnChain(config.config);

    if (canResumeIka && session?.suiChainId) {
      try {
        const chainId = await createLocalRpcClient().getChainIdentifier();
        if (chainId !== session.suiChainId) {
          canResumeIka = false;
        }
      } catch {
        canResumeIka = false;
      }
    }

    if (canResumeIka && config.config) {
      const readiness = await probeIkaChainReadiness(config.config);
      suiCheckpointLag = readiness.suiCheckpointLag;
    }
  }

  return {
    ikaConfigReady: config.ready,
    ikaNetworkConfigReady,
    configMatchesPersisted,
    suiGenesisReady,
    canResumeSui,
    canResumeIka,
    suiCheckpointLag,
    session,
    toolchainWritable,
    toolchainRoot,
  };
}

export async function refreshLocalnetSessionSnapshot(): Promise<void> {
  const config = await getIkaLocalnetConfig();
  if (!config.ready || !config.config) return;

  const suiStatus = await refreshLocalNetworkStatus();
  if (!suiStatus.rpcReady) return;

  const networkDkgReady = await probeIkaNetworkDkgOnChain(config.config);
  if (!networkDkgReady) return;

  let suiChainId: string | null = null;
  try {
    suiChainId = await createLocalRpcClient().getChainIdentifier();
  } catch {
    suiChainId = null;
  }

  await saveLocalnetSession({
    coordinatorObjectId: config.config.objects.ika_dwallet_coordinator_object_id,
    suiChainId,
    networkDkgReady: true,
    savedAt: Date.now(),
  });
}