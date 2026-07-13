import { loadWalletNetwork } from "../../types/network";
import {
  SUI_COIN_TYPE,
  fetchCoinInfo,
  sandboxTokenA,
  sandboxTokenB,
  type SandboxCoinInfo,
} from "./defi-coin-catalog";
import {
  addSandboxLiquidity,
  buildDefiSandboxPackage,
  createDefiPool,
  fetchSandboxPoolSnapshot,
  fetchSandboxPoolSummaries,
  listSandboxPools,
  loadDefiSandboxDeployment,
  publishDefiSandboxPackage,
  resolveActivePool,
  setActiveSandboxPool,
  mintSandboxTokenA,
  mintSandboxTokenB,
  mintSandboxTokensBoth,
  swapSandboxAForB,
  swapSandboxBForA,
  type DefiSandboxDeployment,
  type SandboxPoolRecord,
} from "./defi-playground";
import {
  estimateSwapOutput,
  formatUnits,
  minSwapOutput,
  parseUnits,
} from "./defi-sandbox-utils";
import type { PlaygroundNetwork } from "./types";
import { getWalletAddress } from "./utils";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

function serializeBigints(value: unknown): JsonValue {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(serializeBigints) as JsonValue;
  if (value && typeof value === "object") {
    const out: Record<string, JsonValue> = {};
    for (const [key, entry] of Object.entries(value)) {
      out[key] = serializeBigints(entry);
    }
    return out;
  }
  return value as JsonValue;
}

async function requireWallet(): Promise<string> {
  const address = await getWalletAddress();
  if (!address) {
    throw new Error("Connect or create a Beluga wallet first.");
  }
  return address;
}

function resolveNetwork(requested?: string): PlaygroundNetwork {
  const network = (requested?.trim() || loadWalletNetwork()) as PlaygroundNetwork;
  if (network === "mainnet") {
    throw new Error(
      "DeFi sandbox deploy is not supported on mainnet. Switch to localnet or testnet.",
    );
  }
  return network;
}

function requireDeployment(): DefiSandboxDeployment {
  const deployment = loadDefiSandboxDeployment();
  if (!deployment?.packageId) {
    throw new Error(
      "No DeFi sandbox deployment found. Call playground_defi_deploy_sandbox first.",
    );
  }
  return deployment;
}

async function resolveCoinRef(
  ref: string,
  deployment: DefiSandboxDeployment,
  network: PlaygroundNetwork,
): Promise<SandboxCoinInfo> {
  const normalized = ref.trim().toLowerCase();
  if (!normalized) {
    throw new Error("Coin reference is required.");
  }

  if (normalized === "sui") {
    return fetchCoinInfo(network, SUI_COIN_TYPE);
  }
  if (normalized === "ta" || normalized === "token_a" || normalized === "token a") {
    return sandboxTokenA(deployment.packageId);
  }
  if (normalized === "tb" || normalized === "token_b" || normalized === "token b") {
    return sandboxTokenB(deployment.packageId);
  }

  const coinType = ref.includes("::") ? ref : `${deployment.packageId}::${ref}`;
  return fetchCoinInfo(network, coinType);
}

function resolvePool(
  deployment: DefiSandboxDeployment,
  poolId?: string,
): SandboxPoolRecord {
  const pools = listSandboxPools(deployment);
  if (pools.length === 0) {
    throw new Error("No pools yet. Create one with playground_defi_create_pool.");
  }

  if (poolId) {
    const match = pools.find((pool) => pool.poolId === poolId);
    if (!match) {
      throw new Error(`Pool ${poolId} not found in saved deployment.`);
    }
    return match;
  }

  const active = resolveActivePool(deployment);
  if (!active) {
    throw new Error("No active pool. Pass pool_id or set one with playground_defi_set_active_pool.");
  }
  return active;
}

function withActivePool(
  deployment: DefiSandboxDeployment,
  pool: SandboxPoolRecord,
): DefiSandboxDeployment {
  if (deployment.activePoolId === pool.poolId) return deployment;
  return setActiveSandboxPool(deployment, pool.poolId);
}

export async function mcpDefiDeploySandbox(params?: {
  network?: string;
}) {
  const address = await requireWallet();
  const network = resolveNetwork(params?.network);

  const build = await buildDefiSandboxPackage();
  const deployment = await publishDefiSandboxPackage(build, address, network);

  return {
    message: `Deployed beluga_defi on ${network}`,
    deployment: serializeBigints(deployment),
  };
}

export async function mcpDefiGetDeployment() {
  const deployment = loadDefiSandboxDeployment();
  if (!deployment) {
    return { deployment: null };
  }

  const pools = listSandboxPools(deployment);
  const active = resolveActivePool(deployment);

  return {
    deployment: serializeBigints(deployment),
    poolCount: pools.length,
    activePoolId: active?.poolId ?? null,
    activePair: active ? `${active.coinA.symbol}/${active.coinB.symbol}` : null,
  };
}

export async function mcpDefiCreatePool(params: {
  coin_a: string;
  coin_b: string;
}) {
  const address = await requireWallet();
  const deployment = requireDeployment();
  const network = deployment.network;

  const coinA = await resolveCoinRef(params.coin_a, deployment, network);
  const coinB = await resolveCoinRef(params.coin_b, deployment, network);

  const { deployment: next, pool, result } = await createDefiPool(
    deployment,
    address,
    coinA,
    coinB,
  );

  return {
    message: `Created pool ${coinA.symbol}/${coinB.symbol}`,
    digest: result.digest,
    pool: pool ? serializeBigints(pool) : null,
    deployment: serializeBigints(next ?? deployment),
  };
}

export async function mcpDefiFaucet(params: {
  token?: string;
  amount?: string;
  amount_a?: string;
  amount_b?: string;
}) {
  const address = await requireWallet();
  const deployment = requireDeployment();

  const token = (params.token ?? "both").trim().toLowerCase();
  const defaultAmount = params.amount ?? "1000";

  let digest: string | undefined;

  if (token === "a" || token === "ta" || token === "token_a") {
    const amount = parseUnits(params.amount_a ?? defaultAmount);
    const result = await mintSandboxTokenA(deployment, address, amount);
    digest = result.digest;
    return {
      message: `Minted ${formatUnits(amount)} TA`,
      digest,
      token: "a",
      amount: amount.toString(),
    };
  }

  if (token === "b" || token === "tb" || token === "token_b") {
    const amount = parseUnits(params.amount_b ?? defaultAmount);
    const result = await mintSandboxTokenB(deployment, address, amount);
    digest = result.digest;
    return {
      message: `Minted ${formatUnits(amount)} TB`,
      digest,
      token: "b",
      amount: amount.toString(),
    };
  }

  if (token === "both" || token === "all") {
    const amountA = parseUnits(params.amount_a ?? defaultAmount);
    const amountB = parseUnits(params.amount_b ?? defaultAmount);
    const result = await mintSandboxTokensBoth(deployment, address, amountA, amountB);
    digest = result.digest;
    return {
      message: `Minted ${formatUnits(amountA)} TA and ${formatUnits(amountB)} TB`,
      digest,
      token: "both",
      amountA: amountA.toString(),
      amountB: amountB.toString(),
    };
  }

  throw new Error(
    'token must be "a", "b", or "both" (aliases: ta, tb, token_a, token_b).',
  );
}

export async function mcpDefiAddLiquidity(params: {
  amount_a: string;
  amount_b: string;
  pool_id?: string;
}) {
  const address = await requireWallet();
  let deployment = requireDeployment();
  const pool = resolvePool(deployment, params.pool_id);
  deployment = withActivePool(deployment, pool);

  const amountA = parseUnits(params.amount_a, pool.coinA.decimals);
  const amountB = parseUnits(params.amount_b, pool.coinB.decimals);

  const result = await addSandboxLiquidity(deployment, address, amountA, amountB);

  return {
    message: `Added liquidity to ${pool.coinA.symbol}/${pool.coinB.symbol}`,
    digest: result.digest,
    poolId: pool.poolId,
    amountA: amountA.toString(),
    amountB: amountB.toString(),
  };
}

export async function mcpDefiSwap(params: {
  direction: string;
  amount_in: string;
  pool_id?: string;
  slippage_bps?: number;
}) {
  const address = await requireWallet();
  let deployment = requireDeployment();
  const pool = resolvePool(deployment, params.pool_id);
  deployment = withActivePool(deployment, pool);

  const direction = params.direction.trim().toLowerCase();
  const isAForB =
    direction === "a_for_b" ||
    direction === "a-for-b" ||
    direction === "a_to_b" ||
    direction === "a→b" ||
    direction === "ab";
  const isBForA =
    direction === "b_for_a" ||
    direction === "b-for-a" ||
    direction === "b_to_a" ||
    direction === "b→a" ||
    direction === "ba";

  if (!isAForB && !isBForA) {
    throw new Error(
      'direction must be "a_for_b" (sell coin A for B) or "b_for_a" (sell coin B for A).',
    );
  }

  const inCoin = isAForB ? pool.coinA : pool.coinB;
  const outCoin = isAForB ? pool.coinB : pool.coinA;
  const amountIn = parseUnits(params.amount_in, inCoin.decimals);

  const snapshot = await fetchSandboxPoolSnapshot(deployment, address, pool);
  if (!snapshot) {
    throw new Error("Could not load pool reserves. Try again after refresh.");
  }

  const reserveIn = isAForB ? snapshot.reserveA : snapshot.reserveB;
  const reserveOut = isAForB ? snapshot.reserveB : snapshot.reserveA;

  if (reserveIn <= 0n || reserveOut <= 0n) {
    throw new Error("Pool has no liquidity. Add liquidity before swapping.");
  }

  const estimatedOut = estimateSwapOutput(amountIn, reserveIn, reserveOut);
  const slippageBps = Math.min(Math.max(Number(params.slippage_bps) || 100, 0), 5000);
  const minOut = minSwapOutput(estimatedOut, slippageBps);

  const result = isAForB
    ? await swapSandboxAForB(deployment, address, amountIn, minOut)
    : await swapSandboxBForA(deployment, address, amountIn, minOut);

  return {
    message: `Swapped ${formatUnits(amountIn, inCoin.decimals)} ${inCoin.symbol} → ~${formatUnits(estimatedOut, outCoin.decimals)} ${outCoin.symbol}`,
    digest: result.digest,
    direction: isAForB ? "a_for_b" : "b_for_a",
    amountIn: amountIn.toString(),
    estimatedOut: estimatedOut.toString(),
    minOut: minOut.toString(),
    slippageBps,
    poolId: pool.poolId,
  };
}

export async function mcpDefiGetPoolSnapshot(params?: { pool_id?: string }) {
  const address = await getWalletAddress();
  const deployment = requireDeployment();
  const pool = resolvePool(deployment, params?.pool_id);

  const snapshot = await fetchSandboxPoolSnapshot(deployment, address, pool);
  if (!snapshot) {
    throw new Error(`Could not read pool ${pool.poolId}.`);
  }

  return {
    snapshot: serializeBigints(snapshot),
    pair: `${snapshot.coinA.symbol}/${snapshot.coinB.symbol}`,
    reserveAFormatted: formatUnits(snapshot.reserveA, snapshot.coinA.decimals),
    reserveBFormatted: formatUnits(snapshot.reserveB, snapshot.coinB.decimals),
  };
}

export async function mcpDefiListPools() {
  const deployment = requireDeployment();
  const summaries = await fetchSandboxPoolSummaries(deployment);
  const active = resolveActivePool(deployment);

  return {
    activePoolId: active?.poolId ?? null,
    pools: summaries.map(({ pool, reserveA, reserveB }) => ({
      poolId: pool.poolId,
      pair: `${pool.coinA.symbol}/${pool.coinB.symbol}`,
      coinA: pool.coinA.coinType,
      coinB: pool.coinB.coinType,
      reserveA: reserveA.toString(),
      reserveB: reserveB.toString(),
      reserveAFormatted: formatUnits(reserveA, pool.coinA.decimals),
      reserveBFormatted: formatUnits(reserveB, pool.coinB.decimals),
      isActive: pool.poolId === active?.poolId,
    })),
  };
}

export async function mcpDefiSetActivePool(params: { pool_id: string }) {
  const deployment = requireDeployment();
  const next = setActiveSandboxPool(deployment, params.pool_id.trim());
  const pool = resolveActivePool(next);

  return {
    message: `Active pool set to ${pool ? `${pool.coinA.symbol}/${pool.coinB.symbol}` : params.pool_id}`,
    activePoolId: next.activePoolId ?? null,
    deployment: serializeBigints(next),
  };
}