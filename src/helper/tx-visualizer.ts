import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { isValidSuiAddress, normalizeSuiAddress } from "@mysten/sui/utils";
type ObjectOwner =
  | { AddressOwner: string }
  | { ObjectOwner: string }
  | { Shared: { initial_shared_version: number } }
  | { Immutable: string };

export type VisualizerNetwork = "mainnet" | "testnet" | "devnet";

export interface TxEdge {
  digest: string;
  from: string;
  to: string;
  amountSui: number;
  timestampMs: string | null;
  coinType: string;
}

export interface AddressGraphResult {
  address: string;
  edges: TxEdge[];
  counterparties: string[];
}

function createClient(network: VisualizerNetwork) {
  return new SuiJsonRpcClient({
    url: getJsonRpcFullnodeUrl(network),
    network,
  });
}

function ownerAddress(owner: ObjectOwner): string | null {
  if ("AddressOwner" in owner) return owner.AddressOwner;
  return null;
}

function parseEdgesFromTransaction(tx: {
  digest: string;
  timestampMs?: string | null;
  balanceChanges?: Array<{
    amount: string;
    coinType: string;
    owner: ObjectOwner;
  }> | null;
  transaction?: {
    data?: { sender?: string };
  } | null;
}): TxEdge[] {
  const changes = tx.balanceChanges ?? [];
  if (!changes.length) return [];

  const edges: TxEdge[] = [];
  const seen = new Set<string>();
  const sender = tx.transaction?.data?.sender ?? null;

  const positives = changes.filter((change) => Number(change.amount) > 0);
  const negatives = changes.filter((change) => Number(change.amount) < 0);

  const pushEdge = (from: string, to: string, amount: string, coinType: string) => {
    if (!from || !to || from === to) return;
    const key = `${tx.digest}:${from}:${to}:${coinType}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({
      digest: tx.digest,
      from,
      to,
      amountSui: Math.abs(Number(amount)) / 1_000_000_000,
      timestampMs: tx.timestampMs ?? null,
      coinType,
    });
  };

  if (sender) {
    for (const positive of positives) {
      const to = ownerAddress(positive.owner);
      if (!to) continue;
      pushEdge(sender, to, positive.amount, positive.coinType);
    }
  }

  if (!edges.length) {
    for (const negative of negatives) {
      const from = ownerAddress(negative.owner);
      if (!from) continue;
      for (const positive of positives) {
        const to = ownerAddress(positive.owner);
        if (!to) continue;
        pushEdge(from, to, positive.amount, positive.coinType);
      }
    }
  }

  return edges;
}

async function fetchTransactionsForAddress(
  client: SuiJsonRpcClient,
  address: string,
  limit: number,
) {
  const options = {
    showBalanceChanges: true,
    showInput: true,
  };

  const [fromResult, toResult] = await Promise.all([
    client.queryTransactionBlocks({
      filter: { FromAddress: address },
      options,
      order: "descending",
      limit,
    }),
    client.queryTransactionBlocks({
      filter: { ToAddress: address },
      options,
      order: "descending",
      limit,
    }),
  ]);

  const merged = new Map<string, (typeof fromResult.data)[number]>();
  for (const tx of [...(fromResult.data ?? []), ...(toResult.data ?? [])]) {
    merged.set(tx.digest, tx);
  }
  return Array.from(merged.values());
}

export async function fetchAddressGraph(
  address: string,
  network: VisualizerNetwork,
  limit = 25,
): Promise<AddressGraphResult> {
  if (!isValidSuiAddress(address)) {
    throw new Error("Invalid Sui address.");
  }

  const normalized = normalizeSuiAddress(address);
  const client = createClient(network);
  const transactions = await fetchTransactionsForAddress(
    client,
    normalized,
    limit,
  );

  const edgeMap = new Map<string, TxEdge>();
  for (const tx of transactions) {
    for (const edge of parseEdgesFromTransaction(tx)) {
      if (edge.from !== normalized && edge.to !== normalized) continue;
      edgeMap.set(`${edge.digest}:${edge.from}:${edge.to}`, edge);
    }
  }

  const edges = Array.from(edgeMap.values());
  const counterparties = new Set<string>();
  for (const edge of edges) {
    if (edge.from !== normalized) counterparties.add(edge.from);
    if (edge.to !== normalized) counterparties.add(edge.to);
  }

  return {
    address: normalized,
    edges,
    counterparties: Array.from(counterparties),
  };
}