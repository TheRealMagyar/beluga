import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { getIkaNetworkConfigPath } from "./beluga-toolchain-path";
import {
  getIkaLocalnetConfig,
  getIkaLocalnetStatus,
  getIkaRepoPath,
  getLocalnetResumeStatus,
  probeIkaNetworkDkgOnChain,
  type IkaLocalnetConfigFile,
} from "./ika-localnet";
import {
  fetchLocalTransactionDetail,
  fetchRecentLocalTransactions,
  refreshLocalNetworkStatus,
  type LocalTransactionSummary,
} from "./sui-client-manager";

function createLocalRpcClient() {
  return new SuiJsonRpcClient({
    url: "http://127.0.0.1:9000",
    network: "testnet",
  });
}

async function pathExists(target: string) {
  try {
    await fs.access(target);
    return true;
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
  const systemMatch = raw.match(/^ika_system_object_id:\s*"(0x[a-f0-9]+)"/m);
  const coordinatorMatch = raw.match(
    /^ika_dwallet_coordinator_object_id:\s*"(0x[a-f0-9]+)"/m,
  );
  if (!systemMatch || !coordinatorMatch) return null;

  return {
    systemId: systemMatch[1],
    coordinatorId: coordinatorMatch[1],
  };
}

function extractMoveObjectFields(
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

function readTableId(table: unknown): string | null {
  if (!table || typeof table !== "object") return null;
  const fields = (table as { fields?: { id?: { id?: string } } }).fields;
  return fields?.id?.id ?? null;
}

function readEnumVariant(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const keys = Object.keys(value).filter((k) => k !== "type");
  return keys[0] ?? null;
}

function readU64(value: unknown): string | null {
  if (value == null) return null;
  return String(value);
}

export interface IkaObjectProbe {
  objectId: string;
  exists: boolean;
  version: string | null;
  objectType: string | null;
  innerObjectId: string | null;
  innerFields: Record<string, string | null>;
}

export interface IkaEncryptionKeyProbe {
  objectId: string;
  dkgAtEpoch: string | null;
  state: string | null;
  chunkCount: number;
  dkgTableId: string | null;
  supportedCurves: string | null;
}

export interface IkaDkgProbe {
  ready: boolean;
  coordinatorInnerId: string | null;
  keysTableId: string | null;
  encryptionKeyCount: number;
  totalChunkCount: number;
  encryptionKeys: IkaEncryptionKeyProbe[];
}

export interface IkaExplorerOverview {
  rpcReady: boolean;
  rpcUrl: string;
  chainId: string | null;
  suiEpoch: string | null;
  latestCheckpoint: string | null;
  totalTransactions: string | null;
  configPath: string | null;
  config: IkaLocalnetConfigFile | null;
  persistedSystemId: string | null;
  persistedCoordinatorId: string | null;
  configMatchesPersisted: boolean;
  ikaRunning: boolean;
  ikaPid: number | null;
  networkDkgReady: boolean;
  dwalletReady: boolean;
  suiCheckpointLag: number | null;
  readinessHint: string | null;
  resumeAvailable: boolean;
  stateOutOfSync: boolean;
  canResumeIka: boolean;
  sessionSavedAt: number | null;
  objects: {
    system: IkaObjectProbe | null;
    coordinator: IkaObjectProbe | null;
  };
  dkg: IkaDkgProbe;
  packages: Array<{ label: string; packageId: string }>;
  coordinatorDynamicFieldCount: number;
  fetchedAt: number;
}

async function probeObjectShell(
  objectId: string,
  innerFieldLabels: string[],
): Promise<IkaObjectProbe> {
  const client = createLocalRpcClient();
  try {
    const response = await client.getObject({
      id: objectId,
      options: { showType: true, showContent: true },
    });
    if (!response.data) {
      return {
        objectId,
        exists: false,
        version: null,
        objectType: null,
        innerObjectId: null,
        innerFields: {},
      };
    }

    const dfs = await client.getDynamicFields({ parentId: objectId });
    const innerEntry = dfs.data?.[dfs.data.length - 1];
    const innerObjectId: string | null = innerEntry?.objectId ?? null;
    const innerFields: Record<string, string | null> = {};

    if (innerObjectId) {
      const innerObj = await client.getObject({
        id: innerObjectId,
        options: { showContent: true },
      });
      const fields = extractMoveObjectFields(innerObj.data?.content ?? null);
      if (fields) {
        for (const label of innerFieldLabels) {
          innerFields[label] = readU64(fields[label]);
        }
        if (labelExists(fields, "last_processed_checkpoint_sequence_number")) {
          innerFields.last_processed_checkpoint_sequence_number = readU64(
            fields.last_processed_checkpoint_sequence_number,
          );
        }
        if (labelExists(fields, "total_messages_processed")) {
          innerFields.total_messages_processed = readU64(
            fields.total_messages_processed,
          );
        }
        if (labelExists(fields, "protocol_version")) {
          innerFields.protocol_version = readU64(fields.protocol_version);
        }
        if (labelExists(fields, "epoch_duration_ms")) {
          innerFields.epoch_duration_ms = readU64(fields.epoch_duration_ms);
        }
      }
    }

    return {
      objectId,
      exists: true,
      version: response.data.version ?? null,
      objectType: response.data.type ?? null,
      innerObjectId,
      innerFields,
    };
  } catch {
    return {
      objectId,
      exists: false,
      version: null,
      objectType: null,
      innerObjectId: null,
      innerFields: {},
    };
  }
}

function labelExists(fields: Record<string, unknown>, label: string) {
  return label in fields;
}

async function probeIkaDkgDetails(
  config: IkaLocalnetConfigFile,
): Promise<IkaDkgProbe> {
  const empty: IkaDkgProbe = {
    ready: false,
    coordinatorInnerId: null,
    keysTableId: null,
    encryptionKeyCount: 0,
    totalChunkCount: 0,
    encryptionKeys: [],
  };

  try {
    const client = createLocalRpcClient();
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
    const innerFields = extractMoveObjectFields(innerObj.data?.content ?? null);
    if (!innerFields) return { ...empty, coordinatorInnerId: innerId };

    const keysTableId = readTableId(innerFields.dwallet_network_encryption_keys);
    if (!keysTableId) {
      return { ...empty, coordinatorInnerId: innerId };
    }

    const keyDfs = await client.getDynamicFields({ parentId: keysTableId });
    const encryptionKeys: IkaEncryptionKeyProbe[] = [];
    let totalChunkCount = 0;

    for (const keyDf of keyDfs.data ?? []) {
      const keyObj = await client.getObject({
        id: keyDf.objectId,
        options: { showContent: true },
      });
      const keyFields = extractMoveObjectFields(keyObj.data?.content ?? null);
      if (!keyFields) continue;

      const dkgOutput = keyFields.network_dkg_public_output as {
        fields?: { contents?: { fields?: { id?: { id?: string } } } };
      };
      const dkgTableId = dkgOutput?.fields?.contents?.fields?.id?.id ?? null;
      let chunkCount = 0;
      if (dkgTableId) {
        const chunks = await client.getDynamicFields({ parentId: dkgTableId });
        chunkCount = chunks.data?.length ?? 0;
        totalChunkCount += chunkCount;
      }

      const curves = keyFields.supported_curves;
      encryptionKeys.push({
        objectId: keyDf.objectId,
        dkgAtEpoch: readU64(keyFields.dkg_at_epoch),
        state: readEnumVariant(keyFields.state),
        chunkCount,
        dkgTableId,
        supportedCurves: Array.isArray(curves)
          ? curves.map(String).join(", ")
          : null,
      });
    }

    return {
      ready: totalChunkCount > 0,
      coordinatorInnerId: innerId,
      keysTableId,
      encryptionKeyCount: encryptionKeys.length,
      totalChunkCount,
      encryptionKeys,
    };
  } catch {
    return empty;
  }
}

function buildPackageList(config: IkaLocalnetConfigFile) {
  const packages = config.packages;
  const entries: Array<{ label: string; packageId: string }> = [
    { label: "ika", packageId: packages.ika_package_id },
    { label: "ika_common", packageId: packages.ika_common_package_id },
    {
      label: "ika_dwallet_2pc_mpc",
      packageId: packages.ika_dwallet_2pc_mpc_package_id,
    },
    { label: "ika_system", packageId: packages.ika_system_package_id },
  ];
  if (packages.ika_dwallet_2pc_mpc_package_id_v2) {
    entries.push({
      label: "ika_dwallet_2pc_mpc_v2",
      packageId: packages.ika_dwallet_2pc_mpc_package_id_v2,
    });
  }
  if (packages.ika_system_original_package_id) {
    entries.push({
      label: "ika_system_original",
      packageId: packages.ika_system_original_package_id,
    });
  }
  if (packages.ika_dwallet_2pc_mpc_original_package_id) {
    entries.push({
      label: "ika_dwallet_2pc_mpc_original",
      packageId: packages.ika_dwallet_2pc_mpc_original_package_id,
    });
  }
  return entries;
}

export async function fetchIkaLocalnetExplorerOverview(): Promise<IkaExplorerOverview> {
  const [suiStatus, ikaStatus, resume, configStatus] = await Promise.all([
    refreshLocalNetworkStatus(),
    getIkaLocalnetStatus(),
    getLocalnetResumeStatus(),
    getIkaLocalnetConfig(),
  ]);

  const rpcUrl = suiStatus.rpcUrl;
  const config = configStatus.config;
  const persisted = await readPersistedNetworkObjectIds();

  let chainId: string | null = null;
  let suiEpoch: string | null = null;
  let latestCheckpoint: string | null = null;
  let totalTransactions: string | null = null;
  let coordinatorDynamicFieldCount = 0;

  const emptyDkg: IkaDkgProbe = {
    ready: false,
    coordinatorInnerId: null,
    keysTableId: null,
    encryptionKeyCount: 0,
    totalChunkCount: 0,
    encryptionKeys: [],
  };

  let objects: IkaExplorerOverview["objects"] = {
    system: null,
    coordinator: null,
  };
  let dkg = emptyDkg;
  let packages: IkaExplorerOverview["packages"] = [];
  let networkDkgReady = ikaStatus.networkDkgReady;

  if (suiStatus.rpcReady) {
    const client = createLocalRpcClient();
    try {
      const [chain, checkpoint, totalTx, systemState] = await Promise.all([
        client.getChainIdentifier().catch(() => null),
        client.getLatestCheckpointSequenceNumber().catch(() => null),
        client.getTotalTransactionBlocks().catch(() => null),
        client.getLatestSuiSystemState().catch(() => null),
      ]);
      chainId = chain ?? null;
      latestCheckpoint =
        checkpoint != null ? checkpoint.toString() : null;
      totalTransactions =
        totalTx != null ? totalTx.toString() : null;
      suiEpoch = systemState?.epoch ?? null;
    } catch {
      // RPC probe failed
    }

    if (config) {
      packages = buildPackageList(config);
      const [system, coordinator, dkgProbe, dkgReady] = await Promise.all([
        probeObjectShell(config.objects.ika_system_object_id, ["epoch"]),
        probeObjectShell(config.objects.ika_dwallet_coordinator_object_id, [
          "current_epoch",
        ]),
        probeIkaDkgDetails(config),
        probeIkaNetworkDkgOnChain(config),
      ]);
      objects = { system, coordinator };
      dkg = dkgProbe;
      networkDkgReady = dkgReady;

      try {
        const coordinatorDfs = await client.getDynamicFields({
          parentId: config.objects.ika_dwallet_coordinator_object_id,
        });
        coordinatorDynamicFieldCount = coordinatorDfs.data?.length ?? 0;
      } catch {
        coordinatorDynamicFieldCount = 0;
      }
    }
  }

  return {
    rpcReady: suiStatus.rpcReady,
    rpcUrl,
    chainId,
    suiEpoch,
    latestCheckpoint,
    totalTransactions,
    configPath: configStatus.path ?? path.join(getIkaRepoPath(), "ika_config.json"),
    config,
    persistedSystemId: persisted?.systemId ?? null,
    persistedCoordinatorId: persisted?.coordinatorId ?? null,
    configMatchesPersisted: resume.configMatchesPersisted,
    ikaRunning: ikaStatus.running,
    ikaPid: ikaStatus.pid,
    networkDkgReady,
    dwalletReady: ikaStatus.dwalletReady,
    suiCheckpointLag: ikaStatus.suiCheckpointLag,
    readinessHint: ikaStatus.readinessHint,
    resumeAvailable: ikaStatus.resumeAvailable,
    stateOutOfSync: ikaStatus.stateOutOfSync,
    canResumeIka: resume.canResumeIka,
    sessionSavedAt: resume.session?.savedAt ?? null,
    objects,
    dkg,
    packages,
    coordinatorDynamicFieldCount,
    fetchedAt: Date.now(),
  };
}

export interface IkaExplorerTransaction extends LocalTransactionSummary {
  ikaRelated: boolean;
  ikaPackageHits: string[];
}

export async function fetchIkaRelatedTransactions(
  limit = 40,
): Promise<IkaExplorerTransaction[]> {
  const configStatus = await getIkaLocalnetConfig();
  const packageIds = new Set(
    configStatus.config
      ? buildPackageList(configStatus.config).map((p) => p.packageId)
      : [],
  );

  const recent = await fetchRecentLocalTransactions(Math.min(limit * 2, 50));
  const hits: IkaExplorerTransaction[] = [];

  for (const tx of recent) {
    if (hits.length >= limit) break;
    try {
      const detail = await fetchLocalTransactionDetail(tx.digest);
      const packageHits = new Set<string>();

      for (const event of detail.events ?? []) {
        if (event.packageId && packageIds.has(event.packageId)) {
          packageHits.add(event.packageId);
        }
      }
      for (const change of detail.objectChanges ?? []) {
        const pkg = change.packageId;
        if (pkg && packageIds.has(pkg)) {
          packageHits.add(pkg);
        }
        const objectId = change.objectId;
        if (
          objectId &&
          configStatus.config &&
          (objectId === configStatus.config.objects.ika_system_object_id ||
            objectId ===
              configStatus.config.objects.ika_dwallet_coordinator_object_id)
        ) {
          packageHits.add("ika-object");
        }
      }

      if (packageHits.size > 0) {
        hits.push({
          ...tx,
          ikaRelated: true,
          ikaPackageHits: [...packageHits],
        });
      }
    } catch {
      // skip unreadable tx
    }
  }

  return hits;
}