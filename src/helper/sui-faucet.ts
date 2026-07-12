import {
  getFaucetHost,
  requestSuiFromFaucetV2,
} from "@mysten/sui/faucet";

export type FaucetNetwork = "testnet" | "devnet" | "localnet";

export async function requestFaucetCoins(
  network: FaucetNetwork,
  recipient: string,
) {
  if (network === "localnet") {
    return requestLocalFaucetCoins(recipient);
  }

  const host = getFaucetHost(network);
  const response = await requestSuiFromFaucetV2({ host, recipient });
  const amount =
    response.coins_sent?.reduce((sum, coin) => sum + coin.amount, 0) ?? 0;
  const digest = response.coins_sent?.[0]?.transferTxDigest ?? null;

  return {
    amountSui: amount / 1_000_000_000,
    digest,
    coinsSent: response.coins_sent?.length ?? 0,
  };
}

export async function requestLocalFaucetCoins(
  recipient: string,
  host = "http://127.0.0.1:9123",
) {
  const response = await requestSuiFromFaucetV2({ host, recipient });
  const amount =
    response.coins_sent?.reduce((sum, coin) => sum + coin.amount, 0) ?? 0;
  const digest = response.coins_sent?.[0]?.transferTxDigest ?? null;

  return {
    amountSui: amount / 1_000_000_000,
    digest,
    coinsSent: response.coins_sent?.length ?? 0,
    message:
      response.coins_sent?.length
        ? `Received ${(amount / 1_000_000_000).toFixed(2)} SUI on localnet.`
        : "Faucet request submitted.",
  };
}