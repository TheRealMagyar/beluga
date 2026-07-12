import { createRequire } from "node:module";
import path from "node:path";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { walrus, WalrusFile } from "@mysten/walrus";
import { getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";

const require = createRequire(import.meta.url);
const WALRUS_WASM_PATH = path.join(
  path.dirname(require.resolve("@mysten/walrus-wasm/package.json")),
  "nodejs/walrus_wasm_bg.wasm",
);

export type WalrusNetwork = "mainnet" | "testnet";

const UPLOAD_RELAYS: Record<WalrusNetwork, string> = {
  testnet: "https://upload-relay.testnet.walrus.space",
  mainnet: "https://upload-relay.mainnet.walrus.space",
};

export interface WalrusBlobRecord {
  id: string;
  fileName: string;
  blobId: string;
  blobObjectId: string;
  epochs: number;
  uploadedAt: number;
  network: WalrusNetwork;
  sizeBytes: number;
}

export interface WalrusUploadPrepareResult {
  flowId: string;
  blobId: string;
  registerTxBytes: string;
  epochs: number;
  sizeBytes: number;
}

export interface WalrusCertifyPrepareResult {
  flowId: string;
  certifyTxBytes: string;
}

const flows = new Map<
  string,
  {
    flow: ReturnType<ReturnType<typeof createWalrusClient>["walrus"]["writeFilesFlow"]>;
    network: WalrusNetwork;
    fileName: string;
    epochs: number;
    sizeBytes: number;
    owner: string;
  }
>();

export function createWalrusClient(network: WalrusNetwork) {
  return new SuiGrpcClient({
    network,
    baseUrl: getJsonRpcFullnodeUrl(network),
  }).$extend(
    walrus({
      wasmUrl: WALRUS_WASM_PATH,
      uploadRelay: {
        host: UPLOAD_RELAYS[network],
        sendTip: { max: 5_000_000 },
      },
    }),
  );
}

export function walrusSupportedForNetwork(
  network: "mainnet" | "testnet" | "devnet" | "localnet",
): boolean {
  return network === "mainnet" || network === "testnet" || network === "devnet";
}

export function resolveWalrusNetwork(
  network: "mainnet" | "testnet" | "devnet" | "localnet",
): WalrusNetwork {
  return network === "mainnet" ? "mainnet" : "testnet";
}

export async function prepareWalrusUpload(params: {
  network: WalrusNetwork;
  owner: string;
  fileName: string;
  contentBase64: string;
  epochs?: number;
}): Promise<WalrusUploadPrepareResult> {
  const client = createWalrusClient(params.network);
  const bytes = Uint8Array.from(Buffer.from(params.contentBase64, "base64"));
  const epochs = params.epochs ?? 5;
  const file = WalrusFile.from({
    contents: bytes,
    identifier: params.fileName,
    tags: { "content-type": "application/octet-stream" },
  });
  const flow = client.walrus.writeFilesFlow({ files: [file] });
  const encoded = await flow.encode();
  const registerTx = flow.register({
    epochs,
    owner: params.owner,
    deletable: true,
  });
  registerTx.setSender(params.owner);
  const flowId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  flows.set(flowId, {
    flow,
    network: params.network,
    fileName: params.fileName,
    epochs,
    sizeBytes: bytes.length,
    owner: params.owner,
  });
  return {
    flowId,
    blobId: encoded.blobId,
    registerTxBytes: await registerTx.toBase64(),
    epochs,
    sizeBytes: bytes.length,
  };
}

export async function completeWalrusRegister(params: {
  flowId: string;
  registerDigest: string;
}): Promise<WalrusCertifyPrepareResult> {
  const entry = flows.get(params.flowId);
  if (!entry) throw new Error("Walrus upload flow expired. Prepare upload again.");

  await entry.flow.upload({ digest: params.registerDigest });
  const certifyTx = entry.flow.certify();
  certifyTx.setSender(entry.owner);
  return {
    flowId: params.flowId,
    certifyTxBytes: await certifyTx.toBase64(),
  };
}

export async function finalizeWalrusUpload(params: {
  flowId: string;
}): Promise<WalrusBlobRecord> {
  const entry = flows.get(params.flowId);
  if (!entry) throw new Error("Walrus upload flow expired. Prepare upload again.");

  const files = await entry.flow.listFiles();
  const file = files[0];
  if (!file) throw new Error("Walrus upload produced no files.");

  const record: WalrusBlobRecord = {
    id: params.flowId,
    fileName: entry.fileName,
    blobId: file.blobId,
    blobObjectId: file.blobObject.id,
    epochs: entry.epochs,
    uploadedAt: Date.now(),
    network: entry.network,
    sizeBytes: entry.sizeBytes,
  };
  flows.delete(params.flowId);
  return record;
}

export async function prepareWalrusExtend(params: {
  network: WalrusNetwork;
  blobObjectId: string;
  epochs: number;
  sender: string;
}): Promise<{ txBytes: string }> {
  const client = createWalrusClient(params.network);
  const tx = await client.walrus.extendBlobTransaction({
    blobObjectId: params.blobObjectId,
    epochs: params.epochs,
  });
  tx.setSender(params.sender);
  return { txBytes: await tx.toBase64() };
}

export async function getWalrusBlobStatus(params: {
  network: WalrusNetwork;
  blobObjectId: string;
}): Promise<{
  blobId: string | null;
  storedEpochs: number | null;
  endEpoch: number | null;
  deletable: boolean | null;
}> {
  const client = createWalrusClient(params.network);
  try {
    const object = await client.getObject({
      id: params.blobObjectId,
      include: { content: true },
    });
    const fields = (object.object?.content as { fields?: Record<string, unknown> } | undefined)
      ?.fields;
    return {
      blobId: typeof fields?.blob_id === "string" ? fields.blob_id : null,
      storedEpochs:
        typeof fields?.stored_epochs === "number" ? fields.stored_epochs : null,
      endEpoch: typeof fields?.end_epoch === "number" ? fields.end_epoch : null,
      deletable:
        typeof fields?.deletable === "boolean" ? fields.deletable : null,
    };
  } catch {
    return {
      blobId: null,
      storedEpochs: null,
      endEpoch: null,
      deletable: null,
    };
  }
}

export function walrusAggregatorUrl(network: WalrusNetwork, blobId: string) {
  const host =
    network === "mainnet"
      ? "https://aggregator.walrus-mainnet.walrus.space"
      : "https://aggregator.walrus-testnet.walrus.space";
  return `${host}/v1/${blobId}`;
}