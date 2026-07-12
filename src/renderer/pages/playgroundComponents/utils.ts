import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import type { PlaygroundDeployment, PlaygroundNetwork } from "./types";
import { DEPLOYMENT_STORAGE_KEY, NETWORK_CONFIG } from "./constants";

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

type RpcTransactionEvent = {
  eventType?: string;
  type?: string;
  bcs?: string | Uint8Array;
  parsedJson?: unknown;
};

export type NormalizedTransactionEvent = {
  eventType: string;
  bcs: Uint8Array;
  parsedJson: unknown;
};

export function decodeBase64ToBytes(value: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(value, "base64"));
  }
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function normalizeRpcEvents(
  events: RpcTransactionEvent[] | null | undefined,
): NormalizedTransactionEvent[] {
  if (!events?.length) return [];

  return events.flatMap((event) => {
    const eventType = event.eventType ?? event.type;
    if (!eventType) return [];

    let bcs: Uint8Array | null = null;
    if (event.bcs instanceof Uint8Array) {
      bcs = event.bcs;
    } else if (typeof event.bcs === "string" && event.bcs.length > 0) {
      bcs = decodeBase64ToBytes(event.bcs);
    }

    if (!bcs) return [];

    return [
      {
        eventType,
        bcs,
        parsedJson: event.parsedJson ?? null,
      },
    ];
  });
}

export function loadDeployment(): PlaygroundDeployment | null {
  try {
    const raw = localStorage.getItem(DEPLOYMENT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PlaygroundDeployment;
  } catch {
    return null;
  }
}

export function saveDeployment(deployment: PlaygroundDeployment) {
  localStorage.setItem(DEPLOYMENT_STORAGE_KEY, JSON.stringify(deployment));
}

export function clearDeployment() {
  localStorage.removeItem(DEPLOYMENT_STORAGE_KEY);
}

export async function getWalletAddress(): Promise<string | null> {
  const res = await window.sui?.getWalletInfo?.();
  return res?.address ?? null;
}

export function createSuiClient(network: PlaygroundNetwork) {
  const config = NETWORK_CONFIG[network];
  return new SuiJsonRpcClient({
    url:
      network === "localnet"
        ? config.rpc
        : getJsonRpcFullnodeUrl(network),
    network: network === "localnet" ? "testnet" : network,
  });
}

export async function getSuiBalance(
  address: string,
  network: PlaygroundNetwork,
): Promise<number> {
  const client = createSuiClient(network);
  const balance = await client.getBalance({ owner: address });
  return Number(balance.totalBalance) / 1_000_000_000;
}

async function prepareTransactionForNetwork(
  transaction: Transaction,
  suiClient: SuiJsonRpcClient,
  address: string,
  network: PlaygroundNetwork,
) {
  if (network !== "localnet") return;

  const [{ epoch }, coins] = await Promise.all([
    suiClient.getLatestSuiSystemState(),
    suiClient.getCoins({ owner: address, coinType: "0x2::sui::SUI" }),
  ]);

  transaction.setExpiration({
    Epoch: String(BigInt(epoch) + 5n),
  });

  const gasCoin = coins.data[0];
  if (!gasCoin) {
    throw new Error(
      "No SUI gas coins on localnet for this wallet. Request faucet SUI first.",
    );
  }

  transaction.setGasPayment([
    {
      objectId: gasCoin.coinObjectId,
      version: gasCoin.version,
      digest: gasCoin.digest,
    },
  ]);
}

export type PlaygroundSignerId = "beluga" | `test-${number}`;

export async function signAndExecuteTransaction(
  suiClient: SuiJsonRpcClient,
  address: string,
  transaction: Transaction,
  network: PlaygroundNetwork,
  signerId: PlaygroundSignerId = "beluga",
) {
  transaction.setSender(address);
  await prepareTransactionForNetwork(transaction, suiClient, address, network);
  const txBytes = await transaction.build({ client: suiClient });
  const txBytesB64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(txBytes).toString("base64")
      : btoa(String.fromCharCode(...new Uint8Array(txBytes)));

  const signed =
    network === "localnet"
      ? await window.playground.signTransaction({
          signerId,
          transactionBytesB64: txBytesB64,
        })
      : await window.electronAPI.signTransaction(txBytesB64);
  if (!signed.success) {
    throw new Error(signed.error || "Transaction signing failed.");
  }
  if (!signed.signature) {
    throw new Error("Transaction signing failed.");
  }

  const result = await suiClient.executeTransactionBlock({
    transactionBlock: txBytesB64,
    signature: signed.signature,
    options: {
      showEffects: true,
      showObjectChanges: true,
      showEvents: true,
    },
  });

  const status = result.effects?.status;
  if (status && "error" in status && status.status !== "success") {
    throw new Error(status.error ?? "Transaction failed.");
  }

  return {
    ...result,
    events: normalizeRpcEvents(result.events ?? undefined),
  };
}

export async function publishPackage(
  suiClient: SuiJsonRpcClient,
  address: string,
  modules: string[],
  dependencies: string[],
  network: PlaygroundNetwork,
  signerId: PlaygroundSignerId = "beluga",
) {
  const tx = new Transaction();
  const [upgradeCap] = tx.publish({ modules, dependencies });
  tx.transferObjects([upgradeCap], address);

  return signAndExecuteTransaction(
    suiClient,
    address,
    tx,
    network,
    signerId,
  );
}

type PublishObjectChange = {
  type?: string;
  packageId?: string;
  package?: string;
};

function readPublishedPackageId(change: PublishObjectChange): string | null {
  const raw = change.packageId ?? change.package;
  if (!raw) return null;
  try {
    return normalizeSuiAddress(raw);
  } catch {
    return raw;
  }
}

export function extractPackageId(result: {
  objectChanges?: Array<PublishObjectChange>;
  effects?: { created?: Array<{ reference?: { objectId?: string } }> };
}): string | null {
  for (const change of result.objectChanges ?? []) {
    if (change.type?.toLowerCase() !== "published") continue;
    const packageId = readPublishedPackageId(change);
    if (packageId) return packageId;
  }

  return null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForPackageOnChain(
  client: SuiJsonRpcClient,
  packageId: string,
  timeoutMs = 20_000,
): Promise<void> {
  const started = Date.now();
  let lastError = "Package not indexed yet.";

  while (Date.now() - started < timeoutMs) {
    try {
      await client.getNormalizedMoveModulesByPackage({ package: packageId });
      return;
    } catch (err: any) {
      const message = err?.message ?? String(err);
      lastError = message;
      if (!/does not exist/i.test(message)) {
        throw err;
      }
      await sleep(400);
    }
  }

  throw new Error(
    `Package ${packageId} is not visible on the active network yet. ${lastError}`,
  );
}

export async function resolvePackageIdFromPublish(
  client: SuiJsonRpcClient,
  result: {
    digest: string;
    objectChanges?: Array<PublishObjectChange>;
  },
): Promise<string> {
  let packageId = extractPackageId(result);
  if (!packageId) {
    const tx = await client.getTransactionBlock({
      digest: result.digest,
      options: { showObjectChanges: true },
    });
    packageId = extractPackageId(tx);
  }

  if (!packageId) {
    throw new Error(
      "Publish succeeded but no package ID was returned. Check the publish transaction in the explorer.",
    );
  }

  await waitForPackageOnChain(client, packageId);
  return packageId;
}