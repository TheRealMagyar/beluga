import { ipcMain } from "electron";
import {
  executeGrpcQuery,
  listGrpcQueryCatalog,
} from "../helper/grpc-query";
import { fetchAddressGraph } from "../helper/tx-visualizer";
import { scanToken } from "../helper/token-scanner";
import {
  buildTokenPackage,
  type TokenGeneratorConfig,
} from "../helper/token-generator";
import { buildNftPackage, type NftContractConfig } from "../helper/nft-manager";

type WalrusStorageModule = typeof import("../helper/walrus-storage");

let walrusStorageModule: WalrusStorageModule | null = null;

async function getWalrusStorage(): Promise<WalrusStorageModule> {
  if (!walrusStorageModule) {
    walrusStorageModule = await import("../helper/walrus-storage");
  }
  return walrusStorageModule;
}

export function registerToolsIpc() {
  ipcMain.handle("tools:list-grpc-query-catalog", async () =>
    listGrpcQueryCatalog(),
  );

  ipcMain.handle(
    "tools:execute-grpc-query",
    async (
      _event,
      params: {
        network: "mainnet" | "testnet" | "devnet" | "localnet";
        service: string;
        method: string;
        request?: Record<string, unknown>;
        baseUrl?: string;
      },
    ) => executeGrpcQuery({
      network: params.network,
      service: params.service as Parameters<typeof executeGrpcQuery>[0]["service"],
      method: params.method,
      request: params.request,
      baseUrl: params.baseUrl,
    }),
  );

  ipcMain.handle(
    "tools:fetch-address-graph",
    async (
      _event,
      {
        address,
        network = "mainnet",
        limit = 25,
      }: {
        address: string;
        network?: "mainnet" | "testnet" | "devnet";
        limit?: number;
      },
    ) => fetchAddressGraph(address, network, limit),
  );

  ipcMain.handle(
    "tools:build-token-package",
    async (_event, config: TokenGeneratorConfig) => buildTokenPackage(config),
  );

  ipcMain.handle(
    "tools:build-nft-package",
    async (_event, config: NftContractConfig) => buildNftPackage(config),
  );

  ipcMain.handle("tools:prepare-walrus-upload", async (_event, params) => {
    const { prepareWalrusUpload } = await getWalrusStorage();
    return prepareWalrusUpload(params);
  });

  ipcMain.handle("tools:complete-walrus-register", async (_event, params) => {
    const { completeWalrusRegister } = await getWalrusStorage();
    return completeWalrusRegister(params);
  });

  ipcMain.handle("tools:finalize-walrus-upload", async (_event, params) => {
    const { finalizeWalrusUpload } = await getWalrusStorage();
    return finalizeWalrusUpload(params);
  });

  ipcMain.handle("tools:prepare-walrus-extend", async (_event, params) => {
    const { prepareWalrusExtend } = await getWalrusStorage();
    return prepareWalrusExtend(params);
  });

  ipcMain.handle("tools:get-walrus-blob-status", async (_event, params) => {
    const { getWalrusBlobStatus } = await getWalrusStorage();
    return getWalrusBlobStatus(params);
  });

  ipcMain.handle(
    "tools:scan-token",
    async (
      _event,
      {
        input,
        network = "mainnet",
      }: {
        input: string;
        network?: "mainnet" | "testnet" | "devnet" | "localnet";
      },
    ) => scanToken(input, network),
  );
}