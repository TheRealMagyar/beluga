import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import {
  CoordinatorInnerModule,
  createRandomSessionIdentifier,
  Curve,
  IkaClient,
  IkaTransaction,
  objResToBcs,
  prepareDKGAsync,
  SessionsManagerModule,
  UserShareEncryptionKeys,
  type IkaConfig,
} from "@ika.xyz/sdk";
import { LOCALNET_RPC } from "../../types/network";

interface IkaLocalnetConfigFile {
  packages: {
    ika_package_id: string;
    ika_common_package_id: string;
    ika_dwallet_2pc_mpc_package_id: string;
    ika_dwallet_2pc_mpc_package_id_v2?: string;
    ika_system_package_id: string;
    ika_system_original_package_id?: string;
    ika_dwallet_2pc_mpc_original_package_id?: string;
  };
  objects: {
    ika_system_object_id: string;
    ika_dwallet_coordinator_object_id: string;
  };
}
import { decodeBase64ToBytes, signAndExecuteTransaction } from "./utils";

const IKA_SEED_STORAGE_KEY = "beluga-ika-playground-seed-v1";

let ikaWasmReady: Promise<void> | null = null;

async function ensureIkaWasmReady() {
  if (!ikaWasmReady) {
    ikaWasmReady = import("../../lib/ika-wasm-entry").then((mod) => mod.default());
  }
  await ikaWasmReady;
}

export type IkaCurveOption = "secp256k1" | "secp256r1" | "ed25519" | "ristretto";

const CURVE_MAP: Record<IkaCurveOption, Curve> = {
  secp256k1: Curve.SECP256K1,
  secp256r1: Curve.SECP256R1,
  ed25519: Curve.ED25519,
  ristretto: Curve.RISTRETTO,
};

export function toIkaConfig(file: IkaLocalnetConfigFile): IkaConfig {
  const packages = file.packages;
  return {
    packages: {
      ikaPackage: packages.ika_package_id,
      ikaCommonPackage: packages.ika_common_package_id,
      ikaDwallet2pcMpcPackage: packages.ika_dwallet_2pc_mpc_package_id,
      ikaSystemPackage: packages.ika_system_package_id,
      ikaSystemOriginalPackage:
        packages.ika_system_original_package_id ?? packages.ika_system_package_id,
      ikaDwallet2pcMpcOriginalPackage:
        packages.ika_dwallet_2pc_mpc_original_package_id ??
        packages.ika_dwallet_2pc_mpc_package_id,
    },
    objects: {
      ikaSystemObject: {
        objectID: file.objects.ika_system_object_id,
        initialSharedVersion: 0,
      },
      ikaDWalletCoordinator: {
        objectID: file.objects.ika_dwallet_coordinator_object_id,
        initialSharedVersion: 0,
      },
    },
  };
}

const NETWORK_DKG_POLL_MS = 3_000;
const NETWORK_DKG_TIMEOUT_MS = 900_000;

export async function probeIkaNetworkReady(
  ikaClient: IkaClient,
): Promise<{ ready: boolean; error?: string }> {
  try {
    await ikaClient.initialize();
    await ikaClient.getProtocolPublicParameters(undefined, Curve.SECP256K1);
    return { ready: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ready: false, error: message };
  }
}

export async function waitForIkaNetworkReady(params: {
  ikaClient: IkaClient;
  onProgress?: (message: string) => void;
  timeoutMs?: number;
}): Promise<void> {
  const { ikaClient, onProgress, timeoutMs = NETWORK_DKG_TIMEOUT_MS } = params;
  const started = Date.now();
  let lastError: string | undefined;
  let lastProgressAt = 0;

  while (Date.now() - started < timeoutMs) {
    const probe = await probeIkaNetworkReady(ikaClient);
    if (probe.ready) {
      return;
    }
    lastError = probe.error;

    const now = Date.now();
    if (now - lastProgressAt >= 15_000) {
      onProgress?.(
        lastError
          ? `Waiting for Ika protocol keys… (${lastError})`
          : "Waiting for Ika network DKG to finish (usually a few minutes after ika_config.json)...",
      );
      lastProgressAt = now;
    }

    await new Promise((resolve) => setTimeout(resolve, NETWORK_DKG_POLL_MS));
  }

  const wasmMismatch =
    lastError?.includes("expected variant index 0 <= i < 2") ?? false;
  throw new Error(
    wasmMismatch
      ? "Ika WASM is out of date for this localnet (network DKG V3). Reinstall Ika SDK from Packages → Toolchain, restart Beluga, then try again."
      : lastError
        ? `Ika protocol keys are not ready: ${lastError}. If dWallet ready is true in the UI but this persists, reinstall Ika SDK from Packages → Toolchain and restart Beluga.`
        : "Ika network DKG did not complete in time. Stop Ika, restart Sui with Reset chain + Ika-compatible, then Start Ika localnet again and wait a few minutes.",
  );
}

export function createLocalIkaClient(config: IkaConfig) {
  const suiClient = new SuiJsonRpcClient({
    url: LOCALNET_RPC,
    network: "testnet",
  });
  const ikaClient = new IkaClient({
    suiClient,
    config,
    cache: true,
    encryptionKeyOptions: { autoDetect: true },
  });
  return { suiClient, ikaClient };
}

function loadOrCreateSeed(): Uint8Array {
  try {
    const raw = localStorage.getItem(IKA_SEED_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as number[];
      if (Array.isArray(parsed) && parsed.length === 32) {
        return new Uint8Array(parsed);
      }
    }
  } catch {
    // fall through
  }

  const seed = crypto.getRandomValues(new Uint8Array(32));
  localStorage.setItem(IKA_SEED_STORAGE_KEY, JSON.stringify([...seed]));
  return seed;
}

export function resetIkaPlaygroundSeed() {
  localStorage.removeItem(IKA_SEED_STORAGE_KEY);
}

export async function loadUserShareEncryptionKeys(curve: IkaCurveOption) {
  await ensureIkaWasmReady();
  const seed = loadOrCreateSeed();
  const keys = await UserShareEncryptionKeys.fromRootSeedKey(
    seed,
    CURVE_MAP[curve],
  );
  return keys;
}

function createEmptyIkaCoin(tx: Transaction, ikaConfig: IkaConfig) {
  return tx.moveCall({
    target: "0x2::coin::zero",
    arguments: [],
    typeArguments: [`${ikaConfig.packages.ikaPackage}::ika::IKA`],
  });
}

function destroyEmptyIkaCoin(
  tx: Transaction,
  ikaConfig: IkaConfig,
  ikaCoin: ReturnType<typeof createEmptyIkaCoin>,
) {
  tx.moveCall({
    target: "0x2::coin::destroy_zero",
    arguments: [ikaCoin],
    typeArguments: [`${ikaConfig.packages.ikaPackage}::ika::IKA`],
  });
}

export interface CreatedDWallet {
  dWalletId: string;
  dWalletCapId: string;
  digest: string;
  curve: IkaCurveOption;
}

export async function createSharedDWallet(params: {
  ikaClient: IkaClient;
  suiClient: SuiJsonRpcClient;
  walletAddress: string;
  curve: IkaCurveOption;
  onProgress?: (message: string) => void;
}): Promise<CreatedDWallet> {
  const { ikaClient, suiClient, walletAddress, curve, onProgress } = params;
  const curveValue = CURVE_MAP[curve];

  await ensureIkaWasmReady();
  onProgress?.("Initializing Ika client...");
  await ikaClient.initialize();

  await waitForIkaNetworkReady({ ikaClient, onProgress });

  onProgress?.("Preparing encryption keys...");
  const userShareEncryptionKeys = await loadUserShareEncryptionKeys(curve);
  const randomSessionIdentifier = createRandomSessionIdentifier();

  onProgress?.("Running local DKG preparation...");
  const { encryptedUserShareAndProof, userDKGMessage, userPublicOutput, userSecretKeyShare } =
    await prepareDKGAsync(
      ikaClient,
      curveValue,
      userShareEncryptionKeys,
      randomSessionIdentifier,
      walletAddress,
    );

  const latestNetworkEncryptionKey =
    await ikaClient.getLatestNetworkEncryptionKey();

  const tx = new Transaction();
  const ikaTx = new IkaTransaction({
    ikaClient,
    transaction: tx,
    userShareEncryptionKeys,
  });

  const ikaCoin = createEmptyIkaCoin(tx, ikaClient.ikaConfig);
  const [dWalletCap] = await ikaTx.requestDWalletDKGWithPublicUserShare({
    publicKeyShareAndProof: userDKGMessage,
    publicUserSecretKeyShare: userSecretKeyShare,
    userPublicOutput,
    curve: curveValue,
    dwalletNetworkEncryptionKeyId: latestNetworkEncryptionKey.id,
    ikaCoin,
    suiCoin: tx.gas,
    sessionIdentifier: ikaTx.registerSessionIdentifier(randomSessionIdentifier),
  });

  tx.transferObjects([dWalletCap], walletAddress);
  destroyEmptyIkaCoin(tx, ikaClient.ikaConfig, ikaCoin);

  onProgress?.("Submitting dWallet creation transaction...");
  const result = await signAndExecuteTransaction(
    suiClient,
    walletAddress,
    tx,
    "localnet",
  );

  const findDkgEvent = (
    events: Array<{ eventType?: string; bcs?: Uint8Array; parsedJson?: unknown }> | null | undefined,
  ) =>
    events?.find(
      (event) =>
        event.eventType?.includes("DWalletDKGRequestEvent") &&
        event.eventType?.includes("DWalletSessionEvent"),
    );

  let dkgEvent = findDkgEvent(result.events);
  if (!dkgEvent?.bcs && result.digest) {
    const detail = await suiClient.getTransactionBlock({
      digest: result.digest,
      options: { showEvents: true },
    });
    dkgEvent = findDkgEvent(
      detail.events?.map((event) => ({
        eventType: event.type,
        bcs:
          typeof event.bcs === "string"
            ? decodeBase64ToBytes(event.bcs)
            : undefined,
        parsedJson: event.parsedJson,
      })),
    );
  }

  let dWalletId: string | undefined;
  let dWalletCapId: string | undefined;

  if (dkgEvent?.bcs) {
    const parsed = SessionsManagerModule.DWalletSessionEvent(
      CoordinatorInnerModule.DWalletDKGRequestEvent,
    ).parse(dkgEvent.bcs);
    dWalletId = parsed.event_data.dwallet_id as string;
    dWalletCapId = parsed.event_data.dwallet_cap_id as string;
  } else {
    const eventJson = result.events?.find(
      (event) =>
        event.eventType?.includes("DWalletDKGRequestEvent") &&
        event.eventType?.includes("DWalletSessionEvent"),
    )?.parsedJson as
      | { event_data?: { dwallet_id?: string; dwallet_cap_id?: string } }
      | undefined;

    dWalletId = eventJson?.event_data?.dwallet_id;
    dWalletCapId = eventJson?.event_data?.dwallet_cap_id;
  }

  if (!dWalletId || !dWalletCapId) {
    const createdCap = result.objectChanges?.find(
      (change) =>
        change.type === "created" &&
        change.objectType?.includes("::coordinator_inner::DWalletCap"),
    );
    if (createdCap && "objectId" in createdCap) {
      dWalletCapId = createdCap.objectId;
      const capObj = await suiClient.getObject({
        id: dWalletCapId,
        options: { showContent: true },
      });
      const fields = capObj.data?.content as
        | { dataType?: string; fields?: { dwallet_id?: string } }
        | undefined;
      dWalletId = fields?.fields?.dwallet_id;
    }
  }

  if (!dWalletId || !dWalletCapId) {
    throw new Error(
      "dWallet transaction succeeded but DKG session event could not be parsed. Check Ika Explorer for the transaction digest.",
    );
  }

  onProgress?.("Waiting for dWallet to become Active (may take several minutes)...");
  const activeWallet = await ikaClient.getDWalletInParticularState(
    dWalletId,
    "Active",
    { timeout: 600_000, interval: 2_000, maxInterval: 8_000 },
  );

  if (activeWallet.state.$kind !== "Active") {
    throw new Error(`dWallet did not reach Active state (got ${activeWallet.state.$kind}).`);
  }

  return {
    dWalletId,
    dWalletCapId,
    digest: result.digest,
    curve,
  };
}

export async function listOwnedDWalletCaps(
  ikaClient: IkaClient,
  suiClient: SuiJsonRpcClient,
  address: string,
) {
  await ikaClient.initialize();
  const capType = `${ikaClient.ikaConfig.packages.ikaDwallet2pcMpcOriginalPackage}::coordinator_inner::DWalletCap`;
  const response = await suiClient.core.listOwnedObjects({
    owner: address,
    type: capType,
    limit: 25,
    include: { content: true },
  });

  return response.objects.map((obj) =>
    CoordinatorInnerModule.DWalletCap.parse(objResToBcs(obj)),
  );
}