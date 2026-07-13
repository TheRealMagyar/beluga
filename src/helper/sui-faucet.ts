import {
  FaucetRateLimitError,
  getFaucetHost,
  requestSuiFromFaucetV2,
} from "@mysten/sui/faucet";

export type FaucetNetwork = "testnet" | "devnet" | "localnet";

const FAUCET_PROBE_ADDRESS =
  "0x0000000000000000000000000000000000000000000000000000000000000001";

/** True when the local Sui faucet HTTP service accepts fund requests. */
export async function probeLocalFaucetReady(
  host = "http://127.0.0.1:9123",
): Promise<boolean> {
  try {
    const response = await fetch(new URL("/v2/gas", host).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        FixedAmountRequest: {
          recipient: FAUCET_PROBE_ADDRESS,
        },
      }),
      signal: AbortSignal.timeout(5_000),
    });

    if (response.status === 429) {
      return true;
    }

    if (!response.ok) {
      return false;
    }

    const payload = (await response.json()) as {
      status?: string | { Failure?: { internal?: string } };
    };

    if (payload.status === "Success") {
      return true;
    }

    return typeof payload.status === "object" && payload.status != null;
  } catch (err) {
    if (err instanceof FaucetRateLimitError) {
      return true;
    }
    return false;
  }
}

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