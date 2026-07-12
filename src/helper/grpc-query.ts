import { SuiGrpcClient } from "@mysten/sui/grpc";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import type { GrpcServiceId } from "./grpc-query-catalog";
import {
  GRPC_QUERY_PRESETS,
  GRPC_SERVICES,
  getMethodsForService,
} from "./grpc-query-catalog";

export type GrpcQueryNetwork = "mainnet" | "testnet" | "devnet" | "localnet";

export type GrpcQueryTransport = "grpc" | "jsonrpc";

export interface ExecuteGrpcQueryParams {
  network: GrpcQueryNetwork;
  service: GrpcServiceId;
  method: string;
  request?: Record<string, unknown>;
  baseUrl?: string;
}

export interface ExecuteGrpcQueryResult {
  ok: boolean;
  transport: GrpcQueryTransport;
  endpoint: string;
  durationMs: number;
  response?: unknown;
  error?: string;
}

const GRPC_BASE_URLS: Record<Exclude<GrpcQueryNetwork, "localnet">, string> = {
  mainnet: "https://fullnode.mainnet.sui.io:443",
  testnet: "https://fullnode.testnet.sui.io:443",
  devnet: "https://fullnode.devnet.sui.io:443",
};

const LOCALNET_RPC = "http://127.0.0.1:9000";

const BIGINT_FIELD_PATTERN =
  /^(version|epoch|sequenceNumber|pageSize|limit|checkpoint|height)$/i;

function resolveTransport(network: GrpcQueryNetwork): GrpcQueryTransport {
  return network === "localnet" ? "jsonrpc" : "grpc";
}

function resolveEndpoint(
  network: GrpcQueryNetwork,
  transport: GrpcQueryTransport,
  baseUrl?: string,
): string {
  if (baseUrl?.trim()) return baseUrl.trim();
  if (transport === "jsonrpc") {
    return network === "localnet" ? LOCALNET_RPC : getJsonRpcFullnodeUrl(network);
  }
  if (network === "localnet") return LOCALNET_RPC;
  return GRPC_BASE_URLS[network];
}

function normalizeRequestValue(key: string, value: unknown): unknown {
  if (value == null) return value;

  if (Array.isArray(value)) {
    return value.map((entry, index) =>
      typeof entry === "object" && entry !== null
        ? normalizeRequestBody(entry as Record<string, unknown>)
        : normalizeRequestValue(String(index), entry),
    );
  }

  if (typeof value === "object") {
    return normalizeRequestBody(value as Record<string, unknown>);
  }

  if (
    typeof value === "string" &&
    BIGINT_FIELD_PATTERN.test(key) &&
    /^\d+$/.test(value)
  ) {
    return BigInt(value);
  }

  if (typeof value === "number" && BIGINT_FIELD_PATTERN.test(key)) {
    return BigInt(Math.trunc(value));
  }

  return value;
}

function normalizeRequestBody(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    normalized[key] = normalizeRequestValue(key, value);
  }
  return normalized;
}

/** Map friendly flat JSON to protobuf-ts oneof shapes where needed. */
function coerceGrpcRequest(
  service: GrpcServiceId,
  method: string,
  body: Record<string, unknown>,
): Record<string, unknown> {
  const request = { ...body };

  if (service === "ledger" && method === "getCheckpoint") {
    if (request.checkpointId == null) {
      if (request.sequenceNumber != null) {
        request.checkpointId = {
          oneofKind: "sequenceNumber",
          sequenceNumber: BigInt(String(request.sequenceNumber)),
        };
        delete request.sequenceNumber;
      } else if (request.digest != null) {
        request.checkpointId = {
          oneofKind: "digest",
          digest: String(request.digest),
        };
        delete request.digest;
      }
    }
  }

  if (service === "state" && method === "getBalance" && request.coinType == null) {
    if (request.coin_type != null) {
      request.coinType = request.coin_type;
      delete request.coin_type;
    }
  }

  if (service === "state" && method === "listDynamicFields" && request.parent == null) {
    if (request.parentId != null) {
      request.parent = request.parentId;
      delete request.parentId;
    }
  }

  return request;
}

function serializeForJson(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(serializeForJson);
  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString("base64");
  }
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    out[key] = serializeForJson(entry);
  }
  return out;
}

function getGrpcServiceClient(client: SuiGrpcClient, service: GrpcServiceId) {
  switch (service) {
    case "ledger":
      return client.ledgerService;
    case "state":
      return client.stateService;
    case "movePackage":
      return client.movePackageService;
    case "transactionExecution":
      return client.transactionExecutionService;
    case "nameService":
      return client.nameService;
    default:
      return null;
  }
}

async function executeGrpcUnary(
  client: SuiGrpcClient,
  service: GrpcServiceId,
  method: string,
  request: Record<string, unknown>,
) {
  const serviceClient = getGrpcServiceClient(client, service);
  if (!serviceClient) {
    throw new Error(`Unknown gRPC service: ${service}`);
  }

  const fn = (serviceClient as Record<string, unknown>)[method];
  if (typeof fn !== "function") {
    throw new Error(`Unknown method ${service}.${method}`);
  }

  const call = (
    fn as (
      this: unknown,
      input: Record<string, unknown>,
    ) => { response: Promise<unknown> }
  ).call(serviceClient, request);
  return call.response;
}

async function executeJsonRpcQuery(
  network: GrpcQueryNetwork,
  endpoint: string,
  service: GrpcServiceId,
  method: string,
  request: Record<string, unknown>,
) {
  const client = new SuiJsonRpcClient({
    url: endpoint,
    network: network === "localnet" ? "testnet" : network,
  });

  const key = `${service}.${method}`;

  switch (key) {
    case "ledger.getServiceInfo": {
      const [chainId, system] = await Promise.all([
        client.getChainIdentifier(),
        client.getLatestSuiSystemState(),
      ]);
      return {
        chainId,
        epoch: system.epoch,
        checkpointHeight: system.epoch,
        chain: network,
        server: "jsonrpc",
        systemState: system,
      };
    }
    case "ledger.getObject": {
      const objectId = String(request.objectId ?? "");
      return client.getObject({
        id: objectId,
        options: {
          showContent: true,
          showOwner: true,
          showType: true,
          showDisplay: true,
        },
      });
    }
    case "ledger.batchGetObjects": {
      const requests = Array.isArray(request.requests) ? request.requests : [];
      const ids = requests.map((entry) =>
        String((entry as { objectId?: string }).objectId ?? ""),
      );
      return client.multiGetObjects({
        ids,
        options: { showContent: true, showOwner: true, showType: true },
      });
    }
    case "ledger.getTransaction": {
      return client.getTransactionBlock({
        digest: String(request.digest ?? ""),
        options: {
          showEffects: true,
          showEvents: true,
          showInput: true,
          showBalanceChanges: true,
          showObjectChanges: true,
        },
      });
    }
    case "ledger.getCheckpoint": {
      return client.getCheckpoint({
        id: String(request.sequenceNumber ?? request.checkpointId ?? ""),
      });
    }
    case "ledger.getEpoch": {
      return client.getLatestSuiSystemState();
    }
    case "state.getBalance": {
      return client.getBalance({
        owner: String(request.owner ?? ""),
        coinType: request.coinType ? String(request.coinType) : undefined,
      });
    }
    case "state.listBalances": {
      return client.getAllBalances({
        owner: String(request.owner ?? ""),
      });
    }
    case "state.listOwnedObjects": {
      return client.listOwnedObjects({
        owner: String(request.owner ?? ""),
        limit: Number(request.pageSize ?? 25),
        cursor:
          request.pageToken != null ? String(request.pageToken) : undefined,
      });
    }
    case "state.listDynamicFields": {
      return client.getDynamicFields({
        parentId: String(request.parent ?? request.parentId ?? ""),
        limit: Number(request.pageSize ?? 50),
        cursor:
          request.pageToken != null ? String(request.pageToken) : undefined,
      });
    }
    case "state.getCoinInfo": {
      return client.getCoinMetadata({
        coinType: String(request.coinType ?? ""),
      });
    }
    case "movePackage.getPackage": {
      return client.getObject({
        id: String(request.packageId ?? ""),
        options: { showContent: true, showType: true },
      });
    }
    default:
      throw new Error(
        `JSON-RPC fallback does not support ${service}.${method}. Use mainnet/testnet/devnet for full gRPC, or pick a supported preset.`,
      );
  }
}

export function listGrpcQueryCatalog() {
  return {
    services: GRPC_SERVICES,
    presets: GRPC_QUERY_PRESETS,
  };
}

export async function executeGrpcQuery(
  params: ExecuteGrpcQueryParams,
): Promise<ExecuteGrpcQueryResult> {
  const started = Date.now();
  const transport = resolveTransport(params.network);
  const endpoint = resolveEndpoint(params.network, transport, params.baseUrl);
  const request = normalizeRequestBody(
    coerceGrpcRequest(params.service, params.method, params.request ?? {}),
  );

  try {
    let response: unknown;

    if (transport === "grpc") {
      const client = new SuiGrpcClient({
        network: params.network,
        baseUrl: endpoint,
      });
      response = await executeGrpcUnary(
        client,
        params.service,
        params.method,
        request,
      );
    } else {
      response = await executeJsonRpcQuery(
        params.network,
        endpoint,
        params.service,
        params.method,
        request,
      );
    }

    return {
      ok: true,
      transport,
      endpoint,
      durationMs: Date.now() - started,
      response: serializeForJson(response),
    };
  } catch (err: unknown) {
    return {
      ok: false,
      transport,
      endpoint,
      durationMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export { getMethodsForService };