import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";

export type RpcNetwork = "mainnet" | "testnet" | "devnet" | "localnet";

const LOCALNET_RPC = "http://127.0.0.1:9000";

function createClient(network: RpcNetwork) {
  const url =
    network === "localnet"
      ? LOCALNET_RPC
      : getJsonRpcFullnodeUrl(network);
  return new SuiJsonRpcClient({
    url,
    network: network === "localnet" ? "testnet" : network,
  });
}

export async function getSimpleWalletBalance(
  address: string,
  network: RpcNetwork,
) {
  const client = createClient(network);
  const balance = await client.getBalance({ owner: address });
  const sui = Number(balance.totalBalance) / 1_000_000_000;

  return {
    gasReserve: { sui },
    stables: {},
    total: sui,
  };
}

export async function getSimpleTransactionHistory(
  address: string,
  network: RpcNetwork,
  limit = 20,
) {
  const client = createClient(network);
  const result = await client.queryTransactionBlocks({
    filter: { FromAddress: address },
    options: { showEffects: true, showBalanceChanges: true },
    order: "descending",
    limit,
  });

  return (result.data ?? []).map((tx) => {
    const change = tx.balanceChanges?.find(
      (entry) => entry.owner?.AddressOwner === address,
    );
    const amount = change?.amount
      ? Number(change.amount) / 1_000_000_000
      : undefined;

    return {
      digest: tx.digest,
      type: amount != null && amount > 0 ? "receive" : "send",
      timestamp: tx.timestampMs,
      amount,
      asset: "SUI",
    };
  });
}