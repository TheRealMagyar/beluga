import type { PlaygroundNetwork } from "./types";
import { createSuiClient } from "./utils";

export const SUI_COIN_TYPE = "0x2::sui::SUI";

export function tokenAType(packageId: string) {
  return `${packageId}::token_a::TOKEN_A`;
}

export function tokenBType(packageId: string) {
  return `${packageId}::token_b::TOKEN_B`;
}

export interface SandboxCoinInfo {
  coinType: string;
  symbol: string;
  name: string;
  decimals: number;
  /** True for built-in TA/TB sandbox faucets */
  sandboxFaucet?: "a" | "b";
}

export function sandboxTokenA(packageId: string): SandboxCoinInfo {
  return {
    coinType: tokenAType(packageId),
    symbol: "TA",
    name: "Token A (sandbox)",
    decimals: 9,
    sandboxFaucet: "a",
  };
}

export function sandboxTokenB(packageId: string): SandboxCoinInfo {
  return {
    coinType: tokenBType(packageId),
    symbol: "TB",
    name: "Token B (sandbox)",
    decimals: 9,
    sandboxFaucet: "b",
  };
}

export function isSandboxFaucetPair(
  coinA: SandboxCoinInfo,
  coinB: SandboxCoinInfo,
): boolean {
  const types = new Set([coinA.sandboxFaucet, coinB.sandboxFaucet]);
  return types.has("a") && types.has("b");
}

export function coinLabel(coin: SandboxCoinInfo): string {
  return `${coin.symbol} — ${shortCoinType(coin.coinType)}`;
}

export function shortCoinType(coinType: string): string {
  const parts = coinType.split("::");
  if (parts.length >= 3) {
    return `${parts[parts.length - 2]}::${parts[parts.length - 1]}`;
  }
  return coinType.length > 24 ? `${coinType.slice(0, 10)}…` : coinType;
}

export async function fetchCoinInfo(
  network: PlaygroundNetwork,
  coinType: string,
): Promise<SandboxCoinInfo> {
  if (coinType === SUI_COIN_TYPE) {
    return {
      coinType,
      symbol: "SUI",
      name: "Sui",
      decimals: 9,
    };
  }

  const client = createSuiClient(network);
  try {
    const meta = await client.getCoinMetadata({ coinType });
    const tail = coinType.split("::").pop() ?? "COIN";
    return {
      coinType,
      symbol: meta?.symbol ?? tail,
      name: meta?.name ?? tail,
      decimals: meta?.decimals ?? 9,
      sandboxFaucet:
        coinType.includes("::token_a::TOKEN_A")
          ? "a"
          : coinType.includes("::token_b::TOKEN_B")
            ? "b"
            : undefined,
    };
  } catch {
    const tail = coinType.split("::").pop() ?? "COIN";
    return {
      coinType,
      symbol: tail,
      name: tail,
      decimals: 9,
    };
  }
}

export async function listPoolCoinOptions(
  network: PlaygroundNetwork,
  walletAddress: string | null,
  packageId?: string,
): Promise<SandboxCoinInfo[]> {
  const byType = new Map<string, SandboxCoinInfo>();

  const add = (coin: SandboxCoinInfo) => {
    if (!byType.has(coin.coinType)) {
      byType.set(coin.coinType, coin);
    }
  };

  add(await fetchCoinInfo(network, SUI_COIN_TYPE));
  if (packageId) {
    add(sandboxTokenA(packageId));
    add(sandboxTokenB(packageId));
  }

  if (walletAddress) {
    const client = createSuiClient(network);
    try {
      const balances = await client.getAllBalances({ owner: walletAddress });
      for (const entry of balances) {
        if (BigInt(entry.totalBalance) <= 0n) continue;
        add(await fetchCoinInfo(network, entry.coinType));
      }
    } catch {
      // Wallet scan is best-effort.
    }
  }

  return Array.from(byType.values()).sort((a, b) => {
    if (a.coinType === SUI_COIN_TYPE) return -1;
    if (b.coinType === SUI_COIN_TYPE) return 1;
    return a.symbol.localeCompare(b.symbol);
  });
}

export function findCoinByType(
  options: SandboxCoinInfo[],
  coinType: string,
): SandboxCoinInfo | undefined {
  return options.find((coin) => coin.coinType === coinType);
}