import { Transaction } from "@mysten/sui/transactions";
import {
  DeepBookClient,
  mainnetCoins,
  mainnetPackageIds,
  mainnetPools,
  testnetCoins,
  testnetPackageIds,
  testnetPools,
} from "@mysten/deepbook-v3";
import type { PlaygroundNetwork } from "./types";
import {
  createSuiClient,
  signAndExecuteTransaction,
  type PlaygroundSignerId,
} from "./utils";
import { DEFI_BALANCE_MANAGER_KEY } from "./defi-playground";

export type DeepBookNetwork = "testnet" | "mainnet";

export const DEEPBOOK_STATE_KEY = "beluga-defi-deepbook-state-v1";

export interface DeepBookPlaygroundState {
  balanceManagerId: string | null;
  network: DeepBookNetwork;
}

export function isDeepBookNetwork(
  network: PlaygroundNetwork,
): network is DeepBookNetwork {
  return network === "testnet" || network === "mainnet";
}

export function loadDeepBookState(): DeepBookPlaygroundState | null {
  try {
    const raw = localStorage.getItem(DEEPBOOK_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DeepBookPlaygroundState;
  } catch {
    return null;
  }
}

export function saveDeepBookState(state: DeepBookPlaygroundState) {
  localStorage.setItem(DEEPBOOK_STATE_KEY, JSON.stringify(state));
}

export function clearDeepBookState() {
  localStorage.removeItem(DEEPBOOK_STATE_KEY);
}

export function listDeepBookPools(network: DeepBookNetwork) {
  const pools = network === "testnet" ? testnetPools : mainnetPools;
  return Object.entries(pools).map(([key, pool]) => ({
    key,
    address: pool.address,
    baseCoin: pool.baseCoin,
    quoteCoin: pool.quoteCoin,
  }));
}

export function createDeepBookClient(
  address: string,
  network: DeepBookNetwork,
  balanceManagerId?: string | null,
) {
  const client = createSuiClient(network);

  const balanceManagers = balanceManagerId
    ? {
        [DEFI_BALANCE_MANAGER_KEY]: {
          address: balanceManagerId,
          tradeCap: undefined,
        },
      }
    : undefined;

  return new DeepBookClient({
    client,
    address,
    network,
    balanceManagers,
    pools: network === "testnet" ? testnetPools : mainnetPools,
    coins: network === "testnet" ? testnetCoins : mainnetCoins,
    packageIds: network === "testnet" ? testnetPackageIds : mainnetPackageIds,
  });
}

function extractCreatedObjectId(
  objectChanges: Array<{ type?: string; objectType?: string; objectId?: string }> | null | undefined,
  typeIncludes: string,
): string | null {
  for (const change of objectChanges ?? []) {
    if (
      change.type === "created" &&
      typeof change.objectType === "string" &&
      change.objectType.includes(typeIncludes) &&
      typeof change.objectId === "string"
    ) {
      return change.objectId;
    }
  }
  return null;
}

export async function createDeepBookBalanceManager(
  address: string,
  network: DeepBookNetwork,
  signerId: PlaygroundSignerId = "beluga",
) {
  const db = createDeepBookClient(address, network);
  const tx = new Transaction();
  db.balanceManager.createAndShareBalanceManager()(tx);

  const suiClient = createSuiClient(network);
  const result = await signAndExecuteTransaction(
    suiClient,
    address,
    tx,
    network,
    signerId,
  );

  const balanceManagerId =
    extractCreatedObjectId(result.objectChanges, "BalanceManager") ??
    extractCreatedObjectId(result.objectChanges, "balance_manager");

  if (!balanceManagerId) {
    throw new Error(
      "Balance manager transaction succeeded but no manager ID was found.",
    );
  }

  const state: DeepBookPlaygroundState = {
    balanceManagerId,
    network,
  };
  saveDeepBookState(state);
  return { result, state };
}

export async function depositIntoDeepBookManager(
  address: string,
  network: DeepBookNetwork,
  coinKey: string,
  amount: number,
  balanceManagerId: string,
  signerId: PlaygroundSignerId = "beluga",
) {
  const db = createDeepBookClient(address, network, balanceManagerId);
  const tx = new Transaction();
  db.balanceManager.depositIntoManager(
    DEFI_BALANCE_MANAGER_KEY,
    coinKey,
    amount,
  )(tx);

  const suiClient = createSuiClient(network);
  return signAndExecuteTransaction(suiClient, address, tx, network, signerId);
}

export async function placeDeepBookLimitOrder(
  address: string,
  network: DeepBookNetwork,
  balanceManagerId: string,
  params: {
    poolKey: string;
    price: number;
    quantity: number;
    isBid: boolean;
  },
  signerId: PlaygroundSignerId = "beluga",
) {
  const db = createDeepBookClient(address, network, balanceManagerId);
  const tx = new Transaction();
  db.deepBook.placeLimitOrder({
    poolKey: params.poolKey,
    balanceManagerKey: DEFI_BALANCE_MANAGER_KEY,
    clientOrderId: `beluga-${Date.now()}`,
    price: params.price,
    quantity: params.quantity,
    isBid: params.isBid,
    payWithDeep: false,
  })(tx);

  const suiClient = createSuiClient(network);
  return signAndExecuteTransaction(suiClient, address, tx, network, signerId);
}

/** Dummy address for read-only DeepBook queries (midPrice / orderbook). */
export const DEEPBOOK_READONLY_ADDRESS =
  "0x0000000000000000000000000000000000000000000000000000000000000001";

export async function fetchDeepBookMidPrice(
  address: string,
  network: DeepBookNetwork,
  poolKey: string,
  balanceManagerId?: string | null,
) {
  const db = createDeepBookClient(address, network, balanceManagerId);
  return db.midPrice(poolKey);
}

/** Mid price without a connected wallet (uses a read-only dummy address). */
export async function fetchDeepBookMidPriceReadonly(
  network: DeepBookNetwork,
  poolKey: string,
  address?: string | null,
) {
  return fetchDeepBookMidPrice(
    address || DEEPBOOK_READONLY_ADDRESS,
    network,
    poolKey,
  );
}

/** Prefer a USD-quoted pool for a coin ticker (e.g. WAL → WAL_USDC). */
export function resolveDeepBookPoolForCoin(
  network: DeepBookNetwork,
  coinOrPoolKey: string,
): { key: string; baseCoin: string; quoteCoin: string } | null {
  const raw = coinOrPoolKey.trim().toUpperCase().replace(/^DB:/, "");
  const pools = listDeepBookPools(network);
  const exact = pools.find((p) => p.key.toUpperCase() === raw);
  if (exact) {
    return {
      key: exact.key,
      baseCoin: exact.baseCoin,
      quoteCoin: exact.quoteCoin,
    };
  }

  const usdQuote = /^(USDC|USDT|USD|AUSD|DBUSDC|DBUSDT|WUSDC|WUSDT)$/i;
  const byBaseUsd =
    pools.find(
      (p) =>
        p.baseCoin.toUpperCase() === raw && usdQuote.test(p.quoteCoin),
    ) ||
    pools.find(
      (p) =>
        p.quoteCoin.toUpperCase() === raw && usdQuote.test(p.baseCoin),
    );
  if (byBaseUsd) {
    return {
      key: byBaseUsd.key,
      baseCoin: byBaseUsd.baseCoin,
      quoteCoin: byBaseUsd.quoteCoin,
    };
  }

  const byBase = pools.find(
    (p) =>
      p.baseCoin.toUpperCase() === raw || p.quoteCoin.toUpperCase() === raw,
  );
  if (byBase) {
    return {
      key: byBase.key,
      baseCoin: byBase.baseCoin,
      quoteCoin: byBase.quoteCoin,
    };
  }
  return null;
}

export async function fetchDeepBookLevel2(
  address: string,
  network: DeepBookNetwork,
  poolKey: string,
  balanceManagerId: string | null | undefined,
  lowPrice: number,
  highPrice: number,
  isBid: boolean,
) {
  const db = createDeepBookClient(address, network, balanceManagerId);
  return db.getLevel2Range(poolKey, lowPrice, highPrice, isBid);
}

export async function fetchManagerBalance(
  address: string,
  network: DeepBookNetwork,
  balanceManagerId: string,
  coinKey: string,
) {
  const db = createDeepBookClient(address, network, balanceManagerId);
  return db.checkManagerBalance(DEFI_BALANCE_MANAGER_KEY, coinKey);
}