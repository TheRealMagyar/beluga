import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { DEFAULT_RPC_URL } from "./client";
import { refreshLocalNetworkStatus } from "./network";
import type {
  LocalAddressOverview,
  LocalCheckpointSummary,
  LocalEventSummary,
  LocalNetworkOverview,
  LocalNetworkStats,
  LocalObjectChangeSummary,
  LocalObjectSummary,
  LocalTransactionDetail,
  LocalTransactionSummary,
  LocalWalletAssets,
  LocalWalletBalanceSummary,
  LocalWalletCoinObject,
  LocalWalletOwnedObject,
} from "./types";

function createLocalRpcClient(rpcUrl = DEFAULT_RPC_URL) {
  return new SuiJsonRpcClient({
    url: rpcUrl,
    network: "testnet",
  });
}

function wrapLocalRpcError(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err);
  if (/fetch failed|ECONNREFUSED|network/i.test(message)) {
    return new Error(
      "Localnet RPC unreachable. Start Sui localnet from the Playground network panel.",
    );
  }
  return err instanceof Error ? err : new Error(message);
}

async function requireRunningLocalNetwork() {
  const status = await refreshLocalNetworkStatus();
  if (!status.rpcReady) {
    throw new Error("Local network is not running.");
  }
  return status;
}

async function withLocalRpc<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    throw wrapLocalRpcError(err);
  }
}

function mapObjectChanges(
  changes: Array<Record<string, unknown>> | null | undefined,
): LocalObjectChangeSummary[] {
  return (changes ?? []).map((change) => ({
    type: String(change.type ?? "unknown"),
    objectId: typeof change.objectId === "string" ? change.objectId : null,
    packageId: typeof change.packageId === "string" ? change.packageId : null,
    objectType: typeof change.objectType === "string" ? change.objectType : null,
  }));
}

function mapEvents(
  events: Array<{
    packageId?: string;
    transactionModule?: string;
    type?: string;
    sender?: string;
    parsedJson?: unknown;
    id?: { eventSeq?: string | number };
  }> | null | undefined,
): LocalEventSummary[] {
  return (events ?? []).map((event) => ({
    packageId: event.packageId ?? "",
    module: event.transactionModule ?? "",
    type: event.type ?? "",
    sender: event.sender ?? null,
    parsedJson: event.parsedJson ?? null,
    eventSeq:
      event.id?.eventSeq != null ? String(event.id.eventSeq) : null,
  }));
}

function mapTransactionSummary(
  tx: {
    digest: string;
    timestampMs?: string | null;
    checkpoint?: string | null;
    transaction?: { data?: { sender?: string } };
    effects?: {
      status?: { status?: string; error?: string };
      gasUsed?: {
        computationCost?: string;
        storageCost?: string;
        storageRebate?: string;
      };
    };
  },
): LocalTransactionSummary {
  const gas = tx.effects?.gasUsed;
  const computation = gas?.computationCost ?? null;
  const storage = gas?.storageCost ?? null;
  const rebate = gas?.storageRebate ?? null;
  const totalGas =
    computation != null
      ? String(
          BigInt(computation) +
            BigInt(storage ?? 0) -
            BigInt(rebate ?? 0),
        )
      : null;

  return {
    digest: tx.digest,
    timestampMs: tx.timestampMs ?? null,
    sender: tx.transaction?.data?.sender ?? null,
    status: tx.effects?.status?.status ?? null,
    gasUsed: totalGas,
    checkpoint: tx.checkpoint ?? null,
    kind: null,
  };
}

function mapTransactionDetail(tx: {
  digest: string;
  timestampMs?: string | null;
  checkpoint?: string | null;
  transaction?: {
    data?: {
      sender?: string;
      transaction?: { kind?: string };
    };
  };
  effects?: {
    status?: { status?: string; error?: string };
    gasUsed?: {
      computationCost?: string;
      storageCost?: string;
      storageRebate?: string;
    };
  };
  objectChanges?: Array<Record<string, unknown>>;
  events?: Array<{
    packageId?: string;
    transactionModule?: string;
    type?: string;
    sender?: string;
    parsedJson?: unknown;
    id?: { eventSeq?: string | number };
  }>;
}): LocalTransactionDetail {
  const summary = mapTransactionSummary(tx);
  const commands = (tx.transaction?.data as { transaction?: { transactions?: unknown[] } } | undefined)
    ?.transaction?.transactions;
  return {
    ...summary,
    kind: tx.transaction?.data?.transaction?.kind ?? null,
    error: tx.effects?.status?.error ?? null,
    computationCost: tx.effects?.gasUsed?.computationCost ?? null,
    storageCost: tx.effects?.gasUsed?.storageCost ?? null,
    storageRebate: tx.effects?.gasUsed?.storageRebate ?? null,
    commandCount: Array.isArray(commands) ? commands.length : 0,
    objectChanges: mapObjectChanges(tx.objectChanges),
    events: mapEvents(tx.events),
  };
}

export async function fetchLocalNetworkStats(): Promise<LocalNetworkStats> {
  const overview = await fetchLocalNetworkOverview();
  return {
    totalTransactions: overview.totalTransactions,
    latestCheckpoint: overview.latestCheckpoint,
    rpcUrl: overview.rpcUrl,
  };
}

export async function fetchLocalNetworkOverview(): Promise<LocalNetworkOverview> {
  const status = requireRunningLocalNetwork();
  const client = createLocalRpcClient(status.rpcUrl);

  const [totalTransactions, checkpoint, systemState, chainId] = await Promise.all([
    client.getTotalTransactionBlocks().catch(() => null),
    client.getLatestCheckpointSequenceNumber().catch(() => null),
    client.getLatestSuiSystemState().catch(() => null),
    client.getChainIdentifier().catch(() => null),
  ]);

  return {
    totalTransactions:
      totalTransactions != null ? totalTransactions.toString() : null,
    latestCheckpoint:
      checkpoint != null ? checkpoint.toString() : null,
    epoch: systemState?.epoch ?? null,
    epochDurationMs: systemState?.epochDurationMs ?? null,
    referenceGasPrice: systemState?.referenceGasPrice ?? null,
    chainId: chainId ?? null,
    rpcUrl: status.rpcUrl,
    faucetUrl: status.faucetUrl,
    running: status.running,
    pid: status.pid,
    startedAt: status.startedAt,
  };
}

export async function fetchLocalCheckpoints(
  limit = 12,
): Promise<LocalCheckpointSummary[]> {
  const status = requireRunningLocalNetwork();
  const client = createLocalRpcClient(status.rpcUrl);
  const page = await client.getCheckpoints({ limit, descendingOrder: true });

  return (page.data ?? []).map((checkpoint) => ({
    sequenceNumber: checkpoint.sequenceNumber,
    digest: checkpoint.digest,
    timestampMs: checkpoint.timestampMs ?? null,
    transactionCount: checkpoint.transactions?.length ?? 0,
    networkTotalTransactions: checkpoint.networkTotalTransactions ?? null,
  }));
}

const SUI_MULTI_GET_TX_LIMIT = 50;

async function multiGetTransactionSummaries(
  client: ReturnType<typeof createLocalRpcClient>,
  digests: string[],
) {
  const summaries: LocalTransactionSummary[] = [];

  for (let i = 0; i < digests.length; i += SUI_MULTI_GET_TX_LIMIT) {
    const batch = digests.slice(i, i + SUI_MULTI_GET_TX_LIMIT);
    const txs = await client.multiGetTransactionBlocks({
      digests: batch,
      options: { showEffects: true, showInput: true },
    });
    for (const tx of txs) {
      if (tx != null) {
        summaries.push(mapTransactionSummary(tx));
      }
    }
  }

  return summaries;
}

export async function fetchRecentLocalTransactions(
  limit = 30,
): Promise<LocalTransactionSummary[]> {
  const status = requireRunningLocalNetwork();
  const client = createLocalRpcClient(status.rpcUrl);
  const cappedLimit = Math.min(Math.max(limit, 1), SUI_MULTI_GET_TX_LIMIT);
  const latestSeq = await client.getLatestCheckpointSequenceNumber();
  const digests: string[] = [];
  const start = Number(latestSeq);

  for (let seq = start; seq >= 0 && digests.length < cappedLimit * 3; seq -= 1) {
    const checkpoint = await client.getCheckpoint({ id: String(seq) }).catch(() => null);
    if (!checkpoint?.transactions?.length) continue;
    for (const digest of checkpoint.transactions) {
      digests.push(digest);
      if (digests.length >= cappedLimit * 3) break;
    }
    if (start - seq > 40) break;
  }

  const unique = [...new Set(digests)].slice(0, cappedLimit);
  if (!unique.length) return [];

  const summaries = await multiGetTransactionSummaries(client, unique);
  return summaries.sort(
    (a, b) => Number(b.timestampMs ?? 0) - Number(a.timestampMs ?? 0),
  );
}

export async function fetchLocalTransactions(
  address?: string,
  limit = 30,
): Promise<LocalTransactionSummary[]> {
  return withLocalRpc(async () => {
    const status = await requireRunningLocalNetwork();

    const targetAddress = address?.trim();
    if (!targetAddress) {
      return fetchRecentLocalTransactions(limit);
    }

    const client = createLocalRpcClient(status.rpcUrl);
    const options = {
      showInput: true,
      showEffects: true,
    };

    const results = await Promise.all([
      client.queryTransactionBlocks({
        filter: { FromAddress: targetAddress },
        options,
        order: "descending",
        limit,
      }),
      client.queryTransactionBlocks({
        filter: { ToAddress: targetAddress },
        options,
        order: "descending",
        limit,
      }),
    ]);
    const merged = new Map<string, LocalTransactionSummary>();

    for (const result of results) {
      for (const tx of result.data ?? []) {
        merged.set(tx.digest, mapTransactionSummary(tx));
      }
    }

    return Array.from(merged.values())
      .sort((a, b) => Number(b.timestampMs ?? 0) - Number(a.timestampMs ?? 0))
      .slice(0, limit);
  });
}

export async function fetchLocalTransactionDetail(
  digest: string,
): Promise<LocalTransactionDetail> {
  const status = requireRunningLocalNetwork();
  const client = createLocalRpcClient(status.rpcUrl);
  const tx = await client.getTransactionBlock({
    digest: digest.trim(),
    options: {
      showEffects: true,
      showInput: true,
      showEvents: true,
      showObjectChanges: true,
    },
  });
  return mapTransactionDetail(tx);
}

const SUI_COIN_TYPE = "0x2::sui::SUI";
const WALLET_ASSETS_COIN_LIMIT = 120;
const WALLET_ASSETS_OBJECT_LIMIT = 120;

function shortCoinTypeLabel(coinType: string): string {
  const parts = coinType.split("::");
  if (parts.length >= 2) {
    return `${parts[parts.length - 2]}::${parts[parts.length - 1]}`;
  }
  return coinType.length > 20 ? `${coinType.slice(0, 10)}…` : coinType;
}

function formatTokenAmount(raw: string, decimals: number): string {
  const value = BigInt(raw);
  if (value === 0n) return "0";
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = value % base;
  if (fraction === 0n) return whole.toString();
  const fracStr = fraction
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}

function isCoinStructType(objectType: string | null | undefined): boolean {
  return Boolean(objectType?.includes("::coin::Coin<"));
}

function readDisplayField(display: unknown, key: string): string | null {
  if (!display || typeof display !== "object") return null;
  const data = (display as { data?: Record<string, unknown> }).data;
  if (!data || typeof data !== "object") return null;
  const value = data[key];
  return typeof value === "string" && value.trim() ? value : null;
}

async function fetchAllCoinObjects(
  client: ReturnType<typeof createLocalRpcClient>,
  owner: string,
) {
  const coins: Array<{
    coinObjectId: string;
    coinType: string;
    balance: string;
    version: string;
    digest: string;
  }> = [];
  let cursor: string | null | undefined = undefined;

  do {
    const page = await client.getCoins({ owner, cursor, limit: 50 });
    for (const coin of page.data ?? []) {
      coins.push({
        coinObjectId: coin.coinObjectId,
        coinType: coin.coinType,
        balance: coin.balance,
        version: coin.version,
        digest: coin.digest,
      });
      if (coins.length >= WALLET_ASSETS_COIN_LIMIT) break;
    }
    cursor = page.hasNextPage ? page.nextCursor : null;
  } while (cursor && coins.length < WALLET_ASSETS_COIN_LIMIT);

  return coins;
}

async function fetchAllOwnedObjectSummaries(
  client: ReturnType<typeof createLocalRpcClient>,
  owner: string,
) {
  const objects: LocalWalletOwnedObject[] = [];
  let cursor: string | null | undefined = undefined;

  do {
    const page = await client.getOwnedObjects({
      owner,
      cursor,
      limit: 50,
      options: { showType: true, showDisplay: true, showContent: true },
    });

    for (const entry of page.data ?? []) {
      const data = entry.data;
      if (!data) continue;
      const objectType = data.type ?? null;
      if (isCoinStructType(objectType)) continue;

      objects.push({
        objectId: data.objectId,
        objectType,
        version: data.version ?? null,
        digest: data.digest ?? null,
        displayName: readDisplayField(data.display, "name"),
        displayDescription: readDisplayField(data.display, "description"),
        displayImageUrl: readDisplayField(data.display, "image_url"),
      });

      if (objects.length >= WALLET_ASSETS_OBJECT_LIMIT) break;
    }

    cursor = page.hasNextPage ? page.nextCursor : null;
  } while (cursor && objects.length < WALLET_ASSETS_OBJECT_LIMIT);

  return objects;
}

export async function fetchLocalWalletAssets(
  address: string,
): Promise<LocalWalletAssets> {
  return withLocalRpc(async () => {
    const status = await requireRunningLocalNetwork();
    const client = createLocalRpcClient(status.rpcUrl);
    const target = address.trim();

    const [allBalances, coinObjects, ownedObjects] = await Promise.all([
      client.getAllBalances({ owner: target }),
      fetchAllCoinObjects(client, target),
      fetchAllOwnedObjectSummaries(client, target),
    ]);

    const coinTypes = [
      ...new Set([
        ...allBalances.map((entry) => entry.coinType),
        ...coinObjects.map((coin) => coin.coinType),
      ]),
    ];

    const metadataByType = new Map<
      string,
      { symbol: string | null; name: string | null; decimals: number }
    >();

    await Promise.all(
      coinTypes.map(async (coinType) => {
        try {
          const meta = await client.getCoinMetadata({ coinType });
          metadataByType.set(coinType, {
            symbol: meta?.symbol ?? null,
            name: meta?.name ?? null,
            decimals: meta?.decimals ?? 9,
          });
        } catch {
          metadataByType.set(coinType, {
            symbol: null,
            name: null,
            decimals: 9,
          });
        }
      }),
    );

    const balances: LocalWalletBalanceSummary[] = allBalances
      .map((entry) => {
        const meta = metadataByType.get(entry.coinType);
        const decimals = meta?.decimals ?? 9;
        return {
          coinType: entry.coinType,
          symbol: meta?.symbol ?? shortCoinTypeLabel(entry.coinType),
          name: meta?.name ?? null,
          decimals,
          totalBalance: entry.totalBalance,
          formattedBalance: formatTokenAmount(entry.totalBalance, decimals),
        };
      })
      .sort((a, b) => {
        if (a.coinType === SUI_COIN_TYPE) return -1;
        if (b.coinType === SUI_COIN_TYPE) return 1;
        return a.symbol.localeCompare(b.symbol);
      });

    const coins: LocalWalletCoinObject[] = coinObjects.map((coin) => {
      const meta = metadataByType.get(coin.coinType);
      const decimals = meta?.decimals ?? 9;
      return {
        coinObjectId: coin.coinObjectId,
        coinType: coin.coinType,
        symbol: meta?.symbol ?? shortCoinTypeLabel(coin.coinType),
        balance: coin.balance,
        formattedBalance: formatTokenAmount(coin.balance, decimals),
        version: coin.version,
        digest: coin.digest,
      };
    });

    const suiEntry = balances.find((entry) => entry.coinType === SUI_COIN_TYPE);

    return {
      address: target,
      suiBalance: suiEntry ? Number(suiEntry.totalBalance) / 1_000_000_000 : 0,
      balances,
      coins,
      objects: ownedObjects,
    };
  });
}

export async function fetchLocalAddressOverview(
  address: string,
): Promise<LocalAddressOverview> {
  const status = requireRunningLocalNetwork();
  const client = createLocalRpcClient(status.rpcUrl);
  const target = address.trim();

  const [balance, coins, objects] = await Promise.all([
    client.getBalance({ owner: target }),
    client.getCoins({ owner: target, limit: 50 }),
    client.getOwnedObjects({ owner: target, limit: 50 }),
  ]);

  return {
    address: target,
    balanceSui: Number(balance.totalBalance) / 1_000_000_000,
    coinCount: coins.data?.length ?? 0,
    objectCount: objects.data?.length ?? 0,
  };
}

export async function fetchLocalObject(
  objectId: string,
): Promise<LocalObjectSummary> {
  const status = requireRunningLocalNetwork();
  const client = createLocalRpcClient(status.rpcUrl);
  const response = await client.getObject({
    id: objectId.trim(),
    options: { showType: true, showOwner: true, showContent: true },
  });

  if (response.error || !response.data) {
    throw new Error(response.error?.code ?? "Object not found.");
  }

  const data = response.data;
  let owner: string | null = null;
  if (data.owner && typeof data.owner === "object") {
    if ("AddressOwner" in data.owner) {
      owner = String(data.owner.AddressOwner);
    } else if ("ObjectOwner" in data.owner) {
      owner = String(data.owner.ObjectOwner);
    } else {
      owner = Object.keys(data.owner)[0] ?? null;
    }
  }

  return {
    objectId: data.objectId,
    version: data.version ?? null,
    digest: data.digest ?? null,
    objectType: data.type ?? null,
    owner,
    content: data.content ? JSON.stringify(data.content, null, 2) : null,
  };
}