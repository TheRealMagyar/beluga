import type { CoinStruct } from "@mysten/sui/client";
import { Transaction, type TransactionObjectArgument } from "@mysten/sui/transactions";
import { DEFI_SANDBOX_FILES } from "../../../helper/defi-sandbox-defaults";
import type { PlaygroundBuildResult, PlaygroundNetwork } from "./types";
import {
  SUI_COIN_TYPE,
  type SandboxCoinInfo,
  sandboxTokenA,
  sandboxTokenB,
  tokenAType,
  tokenBType,
} from "./defi-coin-catalog";
import { formatUnits } from "./defi-sandbox-utils";
import {
  createSuiClient,
  publishPackage,
  resolvePackageIdFromPublish,
  signAndExecuteTransaction,
  type PlaygroundSignerId,
} from "./utils";

export { tokenAType, tokenBType };

export const DEFI_SANDBOX_STORAGE_KEY = "beluga-defi-sandbox-deployment-v2";
export const DEFI_SANDBOX_STORAGE_KEY_LEGACY = "beluga-defi-sandbox-deployment-v1";
export const DEFI_BALANCE_MANAGER_KEY = "PLAYGROUND_MANAGER";

export interface SandboxPoolRecord {
  poolId: string;
  coinA: SandboxCoinInfo;
  coinB: SandboxCoinInfo;
  createdAt: number;
}

export interface DefiSandboxDeployment {
  packageId: string;
  digest: string;
  network: PlaygroundNetwork;
  publishedAt: number;
  faucetAId?: string;
  faucetBId?: string;
  pools: SandboxPoolRecord[];
  activePoolId?: string;
  /** @deprecated Migrated into `pools` */
  poolId?: string;
  /** @deprecated Migrated into `pools` */
  coinA?: SandboxCoinInfo;
  /** @deprecated Migrated into `pools` */
  coinB?: SandboxCoinInfo;
}

export function formatPoolPairLabel(pool: SandboxPoolRecord): string {
  const a = pool.coinA?.symbol ?? "A";
  const b = pool.coinB?.symbol ?? "B";
  return `${a}/${b}`;
}

export function listSandboxPools(deployment: DefiSandboxDeployment): SandboxPoolRecord[] {
  return deployment.pools ?? [];
}

export function resolveActivePool(
  deployment: DefiSandboxDeployment,
): SandboxPoolRecord | null {
  const pools = listSandboxPools(deployment);
  if (pools.length === 0) return null;
  if (deployment.activePoolId) {
    const match = pools.find((pool) => pool.poolId === deployment.activePoolId);
    if (match) return match;
  }
  return pools[pools.length - 1] ?? null;
}

export function setActiveSandboxPool(
  deployment: DefiSandboxDeployment,
  poolId: string,
): DefiSandboxDeployment {
  if (!listSandboxPools(deployment).some((pool) => pool.poolId === poolId)) {
    throw new Error("Pool not found in saved deployment.");
  }
  const next = { ...deployment, activePoolId: poolId };
  saveDefiSandboxDeployment(next);
  return next;
}

function isValidPoolRecord(pool: SandboxPoolRecord | null | undefined): pool is SandboxPoolRecord {
  return Boolean(
    pool?.poolId &&
      pool.coinA?.coinType &&
      pool.coinB?.coinType &&
      pool.coinA.coinType !== pool.coinB.coinType,
  );
}

function normalizeDeployment(raw: DefiSandboxDeployment): DefiSandboxDeployment {
  const sanitizedPools = (Array.isArray(raw.pools) ? raw.pools : []).filter(
    isValidPoolRecord,
  );

  if (sanitizedPools.length > 0) {
    const activePoolId =
      raw.activePoolId &&
      sanitizedPools.some((pool) => pool.poolId === raw.activePoolId)
        ? raw.activePoolId
        : sanitizedPools[sanitizedPools.length - 1]?.poolId;
    return {
      ...raw,
      pools: sanitizedPools,
      activePoolId,
    };
  }

  if (raw.poolId && raw.coinA && raw.coinB) {
    const pool: SandboxPoolRecord = {
      poolId: raw.poolId,
      coinA: raw.coinA,
      coinB: raw.coinB,
      createdAt: raw.publishedAt ?? Date.now(),
    };
    return {
      ...raw,
      pools: [pool],
      activePoolId: raw.poolId,
    };
  }

  return { ...raw, pools: [], activePoolId: undefined };
}

type ObjectChange = {
  type?: string;
  objectType?: string;
  objectId?: string;
};

export function resolvePoolCoins(
  deployment: DefiSandboxDeployment,
  pool?: SandboxPoolRecord | null,
): { coinA: SandboxCoinInfo; coinB: SandboxCoinInfo } {
  const active = pool ?? resolveActivePool(deployment);
  if (active) {
    return { coinA: active.coinA, coinB: active.coinB };
  }
  return {
    coinA: sandboxTokenA(deployment.packageId),
    coinB: sandboxTokenB(deployment.packageId),
  };
}

function poolTypeArgs(
  deployment: DefiSandboxDeployment,
  pool?: SandboxPoolRecord | null,
): [string, string] {
  const { coinA, coinB } = resolvePoolCoins(deployment, pool);
  return [coinA.coinType, coinB.coinType];
}

function requireActivePool(deployment: DefiSandboxDeployment): SandboxPoolRecord {
  const pool = resolveActivePool(deployment);
  if (!pool) {
    throw new Error("Select or create a pool first.");
  }
  return pool;
}

export function loadDefiSandboxDeployment(): DefiSandboxDeployment | null {
  try {
    const fromV2 = localStorage.getItem(DEFI_SANDBOX_STORAGE_KEY);
    const fromLegacy = localStorage.getItem(DEFI_SANDBOX_STORAGE_KEY_LEGACY);
    const raw = fromV2 ?? fromLegacy;
    if (!raw) return null;

    const parsed = JSON.parse(raw) as DefiSandboxDeployment;
    const deployment = normalizeDeployment(parsed);
    const migrated =
      !fromV2 || fromLegacy || !Array.isArray(parsed.pools);
    if (migrated) {
      saveDefiSandboxDeployment(deployment);
    }
    return deployment;
  } catch {
    return null;
  }
}

export function saveDefiSandboxDeployment(deployment: DefiSandboxDeployment) {
  localStorage.setItem(DEFI_SANDBOX_STORAGE_KEY, JSON.stringify(deployment));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("beluga-defi-deployment-changed"));
  }
}

export function clearDefiSandboxDeployment() {
  localStorage.removeItem(DEFI_SANDBOX_STORAGE_KEY);
}

function extractSharedObjectIds(
  changes: ObjectChange[] | null | undefined,
  typeSuffix: string,
): string[] {
  return (changes ?? [])
    .filter(
      (change) =>
        change.type === "created" &&
        typeof change.objectType === "string" &&
        change.objectType.includes(typeSuffix) &&
        typeof change.objectId === "string",
    )
    .map((change) => change.objectId as string);
}

function extractFirstSharedObjectId(
  changes: ObjectChange[] | null | undefined,
  typeSuffix: string,
): string | null {
  return extractSharedObjectIds(changes, typeSuffix)[0] ?? null;
}

export async function buildDefiSandboxPackage(): Promise<PlaygroundBuildResult> {
  return window.playground.build(
    DEFI_SANDBOX_FILES.map((file) => ({
      path: file.path,
      content: file.content,
    })),
  );
}

export async function publishDefiSandboxPackage(
  buildResult: PlaygroundBuildResult,
  address: string,
  network: PlaygroundNetwork,
  signerId: PlaygroundSignerId = "beluga",
): Promise<DefiSandboxDeployment> {
  const suiClient = createSuiClient(network);
  const result = await publishPackage(
    suiClient,
    address,
    buildResult.modules,
    buildResult.dependencies,
    network,
    signerId,
  );

  const packageId = await resolvePackageIdFromPublish(suiClient, {
    digest: result.digest,
    objectChanges: result.objectChanges,
  });

  const faucetAId = extractFirstSharedObjectId(
    result.objectChanges,
    "::token_a::TokenAFaucet",
  );
  const faucetBId = extractFirstSharedObjectId(
    result.objectChanges,
    "::token_b::TokenBFaucet",
  );

  const deployment: DefiSandboxDeployment = {
    packageId,
    digest: result.digest,
    network,
    publishedAt: Date.now(),
    faucetAId: faucetAId ?? undefined,
    faucetBId: faucetBId ?? undefined,
    pools: [],
    activePoolId: undefined,
  };
  saveDefiSandboxDeployment(deployment);
  return deployment;
}

async function executeSandboxTx(
  address: string,
  network: PlaygroundNetwork,
  buildTx: (tx: Transaction) => void,
  signerId: PlaygroundSignerId = "beluga",
) {
  const suiClient = createSuiClient(network);
  const tx = new Transaction();
  buildTx(tx);
  return signAndExecuteTransaction(
    suiClient,
    address,
    tx,
    network,
    signerId,
  );
}

export async function createDefiPool(
  deployment: DefiSandboxDeployment,
  address: string,
  coinA: SandboxCoinInfo,
  coinB: SandboxCoinInfo,
  signerId: PlaygroundSignerId = "beluga",
) {
  if (coinA.coinType === coinB.coinType) {
    throw new Error("Pick two different coins for the pool pair.");
  }

  const result = await executeSandboxTx(
    address,
    deployment.network,
    (tx) => {
      tx.moveCall({
        target: `${deployment.packageId}::pool::create_pool`,
        typeArguments: [coinA.coinType, coinB.coinType],
        arguments: [],
      });
    },
    signerId,
  );

  const poolId = extractFirstSharedObjectId(
    result.objectChanges,
    "::pool::Pool",
  );
  if (poolId) {
    const record: SandboxPoolRecord = {
      poolId,
      coinA,
      coinB,
      createdAt: Date.now(),
    };
    const next: DefiSandboxDeployment = {
      ...deployment,
      pools: [...(deployment.pools ?? []), record],
      activePoolId: poolId,
    };
    saveDefiSandboxDeployment(next);
    return { result, deployment: next, pool: record };
  }

  return { result, deployment };
}

function requireSandboxFaucets(deployment: DefiSandboxDeployment) {
  const { faucetAId, faucetBId } = deployment;
  if (!faucetAId || !faucetBId) {
    throw new Error(
      "Faucet object IDs are missing. Republish the sandbox package.",
    );
  }
  return { faucetAId, faucetBId };
}

export async function mintSandboxTokenA(
  deployment: DefiSandboxDeployment,
  address: string,
  amount: bigint,
  signerId: PlaygroundSignerId = "beluga",
) {
  const { faucetAId } = requireSandboxFaucets(deployment);
  const { packageId, network } = deployment;

  return executeSandboxTx(
    address,
    network,
    (tx) => {
      tx.moveCall({
        target: `${packageId}::token_a::mint`,
        arguments: [tx.object(faucetAId), tx.pure.u64(amount)],
      });
    },
    signerId,
  );
}

export async function mintSandboxTokenB(
  deployment: DefiSandboxDeployment,
  address: string,
  amount: bigint,
  signerId: PlaygroundSignerId = "beluga",
) {
  const { faucetBId } = requireSandboxFaucets(deployment);
  const { packageId, network } = deployment;

  return executeSandboxTx(
    address,
    network,
    (tx) => {
      tx.moveCall({
        target: `${packageId}::token_b::mint`,
        arguments: [tx.object(faucetBId), tx.pure.u64(amount)],
      });
    },
    signerId,
  );
}

export async function mintSandboxTokensBoth(
  deployment: DefiSandboxDeployment,
  address: string,
  amountA: bigint,
  amountB: bigint,
  signerId: PlaygroundSignerId = "beluga",
) {
  const { faucetAId, faucetBId } = requireSandboxFaucets(deployment);
  const { packageId, network } = deployment;

  return executeSandboxTx(
    address,
    network,
    (tx) => {
      tx.moveCall({
        target: `${packageId}::token_a::mint`,
        arguments: [tx.object(faucetAId), tx.pure.u64(amountA)],
      });
      tx.moveCall({
        target: `${packageId}::token_b::mint`,
        arguments: [tx.object(faucetBId), tx.pure.u64(amountB)],
      });
    },
    signerId,
  );
}

export async function mintSandboxTokens(
  deployment: DefiSandboxDeployment,
  address: string,
  amount: bigint,
  signerId: PlaygroundSignerId = "beluga",
) {
  return mintSandboxTokensBoth(deployment, address, amount, amount, signerId);
}

/** Keep a small SUI buffer on the gas coin for transaction fees. */
const SUI_GAS_RESERVE_MIST = 50_000_000n;

async function fetchAllCoins(
  address: string,
  network: PlaygroundNetwork,
  coinType: string,
): Promise<CoinStruct[]> {
  const suiClient = createSuiClient(network);
  const coins: CoinStruct[] = [];
  let cursor: string | null | undefined = undefined;

  do {
    const page = await suiClient.getCoins({ owner: address, coinType, cursor });
    coins.push(...page.data);
    cursor = page.hasNextPage ? page.nextCursor : null;
  } while (cursor);

  return coins;
}

async function requireCoinBalance(
  address: string,
  network: PlaygroundNetwork,
  coin: SandboxCoinInfo,
  amount: bigint,
  options?: { reserveGas?: boolean },
) {
  const reserve =
    options?.reserveGas && coin.coinType === SUI_COIN_TYPE
      ? SUI_GAS_RESERVE_MIST
      : 0n;
  const suiClient = createSuiClient(network);
  const { totalBalance } = await suiClient.getBalance({
    owner: address,
    coinType: coin.coinType,
  });
  const total = BigInt(totalBalance);
  const needed = amount + reserve;

  if (total < needed) {
    const haveLabel = formatUnits(total, coin.decimals);
    const needLabel = formatUnits(amount, coin.decimals);
    const reserveLabel =
      reserve > 0n ? ` (+ ${formatUnits(reserve, coin.decimals)} gas reserve)` : "";
    throw new Error(
      `Insufficient ${coin.symbol}: wallet has ${haveLabel}, but ${needLabel}${reserveLabel} is required. ` +
        (coin.coinType === SUI_COIN_TYPE
          ? "Request SUI from the Playground faucet first."
          : "Use the sandbox faucet or mint tokens first."),
    );
  }
}

function splitCoinAmountInTx(
  tx: Transaction,
  coins: CoinStruct[],
  coinType: string,
  amount: bigint,
): TransactionObjectArgument {
  if (coins.length === 0) {
    throw new Error(`No ${coinType} coins in your wallet.`);
  }

  if (coinType === SUI_COIN_TYPE) {
    const [, ...others] = coins;
    if (others.length > 0) {
      tx.mergeCoins(
        tx.gas,
        others.map((coin) => tx.object(coin.coinObjectId)),
      );
    }
    const [split] = tx.splitCoins(tx.gas, [tx.pure.u64(amount)]);
    return split;
  }

  const [primary, ...rest] = coins;
  if (rest.length > 0) {
    tx.mergeCoins(
      tx.object(primary.coinObjectId),
      rest.map((coin) => tx.object(coin.coinObjectId)),
    );
  }
  const [split] = tx.splitCoins(tx.object(primary.coinObjectId), [
    tx.pure.u64(amount),
  ]);
  return split;
}

export async function addSandboxLiquidity(
  deployment: DefiSandboxDeployment,
  address: string,
  amountA: bigint,
  amountB: bigint,
  signerId: PlaygroundSignerId = "beluga",
) {
  const pool = requireActivePool(deployment);
  const { poolId } = pool;
  const { packageId, network } = deployment;

  const { coinA, coinB } = resolvePoolCoins(deployment, pool);
  const [typeA, typeB] = poolTypeArgs(deployment, pool);

  await requireCoinBalance(address, network, coinA, amountA, { reserveGas: true });
  await requireCoinBalance(address, network, coinB, amountB);

  const [coinsA, coinsB] = await Promise.all([
    fetchAllCoins(address, network, coinA.coinType),
    fetchAllCoins(address, network, coinB.coinType),
  ]);

  const result = await executeSandboxTx(
    address,
    network,
    (tx) => {
      const splitA = splitCoinAmountInTx(tx, coinsA, coinA.coinType, amountA);
      const splitB = splitCoinAmountInTx(tx, coinsB, coinB.coinType, amountB);
      tx.moveCall({
        target: `${packageId}::pool::add_liquidity`,
        typeArguments: [typeA, typeB],
        arguments: [tx.object(poolId), splitA, splitB],
      });
    },
    signerId,
  );

  return result;
}

export async function swapSandboxAForB(
  deployment: DefiSandboxDeployment,
  address: string,
  amountIn: bigint,
  minOut = 0n,
  signerId: PlaygroundSignerId = "beluga",
) {
  const pool = requireActivePool(deployment);
  const { poolId } = pool;
  const { packageId, network } = deployment;

  const { coinA } = resolvePoolCoins(deployment, pool);
  const [typeA, typeB] = poolTypeArgs(deployment, pool);

  await requireCoinBalance(address, network, coinA, amountIn, { reserveGas: true });
  const coinsA = await fetchAllCoins(address, network, coinA.coinType);

  const result = await executeSandboxTx(
    address,
    network,
    (tx) => {
      const splitA = splitCoinAmountInTx(tx, coinsA, coinA.coinType, amountIn);
      tx.moveCall({
        target: `${packageId}::pool::swap_a_for_b`,
        typeArguments: [typeA, typeB],
        arguments: [tx.object(poolId), splitA, tx.pure.u64(minOut)],
      });
    },
    signerId,
  );

  return result;
}

export async function swapSandboxBForA(
  deployment: DefiSandboxDeployment,
  address: string,
  amountIn: bigint,
  minOut = 0n,
  signerId: PlaygroundSignerId = "beluga",
) {
  const pool = requireActivePool(deployment);
  const { poolId } = pool;
  const { packageId, network } = deployment;

  const { coinB } = resolvePoolCoins(deployment, pool);
  const [typeA, typeB] = poolTypeArgs(deployment, pool);

  await requireCoinBalance(address, network, coinB, amountIn, {
    reserveGas: coinB.coinType === SUI_COIN_TYPE,
  });
  const coinsB = await fetchAllCoins(address, network, coinB.coinType);

  const result = await executeSandboxTx(
    address,
    network,
    (tx) => {
      const splitB = splitCoinAmountInTx(tx, coinsB, coinB.coinType, amountIn);
      tx.moveCall({
        target: `${packageId}::pool::swap_b_for_a`,
        typeArguments: [typeA, typeB],
        arguments: [tx.object(poolId), splitB, tx.pure.u64(minOut)],
      });
    },
    signerId,
  );

  return result;
}

function readBalanceField(value: unknown): bigint {
  if (typeof value === "string" || typeof value === "number") {
    return BigInt(value);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("value" in record) {
      return readBalanceField(record.value);
    }
    if ("fields" in record && record.fields && typeof record.fields === "object") {
      return readBalanceField((record.fields as Record<string, unknown>).value);
    }
  }
  return 0n;
}

export interface SandboxPoolSnapshot {
  poolId: string;
  packageId: string;
  coinA: SandboxCoinInfo;
  coinB: SandboxCoinInfo;
  reserveA: bigint;
  reserveB: bigint;
  walletBalanceA: bigint;
  walletBalanceB: bigint;
}

export async function fetchSandboxPoolSnapshot(
  deployment: DefiSandboxDeployment,
  walletAddress: string | null,
  pool?: SandboxPoolRecord | null,
): Promise<SandboxPoolSnapshot | null> {
  const active = pool ?? resolveActivePool(deployment);
  if (!active) return null;

  const { coinA, coinB } = resolvePoolCoins(deployment, active);
  const suiClient = createSuiClient(deployment.network);

  const [poolObject, balanceA, balanceB] = await Promise.all([
    suiClient.getObject({
      id: active.poolId,
      options: { showContent: true },
    }),
    walletAddress
      ? suiClient.getBalance({ owner: walletAddress, coinType: coinA.coinType })
      : Promise.resolve(null),
    walletAddress
      ? suiClient.getBalance({ owner: walletAddress, coinType: coinB.coinType })
      : Promise.resolve(null),
  ]);

  const fields = (poolObject.data?.content as { fields?: Record<string, unknown> })
    ?.fields;
  if (!fields) return null;

  return {
    poolId: active.poolId,
    packageId: deployment.packageId,
    coinA,
    coinB,
    reserveA: readBalanceField(fields.reserve_a),
    reserveB: readBalanceField(fields.reserve_b),
    walletBalanceA: balanceA ? BigInt(balanceA.totalBalance) : 0n,
    walletBalanceB: balanceB ? BigInt(balanceB.totalBalance) : 0n,
  };
}

export interface SandboxPoolListItem {
  pool: SandboxPoolRecord;
  reserveA: bigint;
  reserveB: bigint;
}

export async function fetchSandboxPoolSummaries(
  deployment: DefiSandboxDeployment,
): Promise<SandboxPoolListItem[]> {
  const pools = listSandboxPools(deployment);
  if (pools.length === 0) return [];

  const suiClient = createSuiClient(deployment.network);
  const summaries = await Promise.all(
    pools.map(async (pool) => {
      try {
        const object = await suiClient.getObject({
          id: pool.poolId,
          options: { showContent: true },
        });
        const fields = (object.data?.content as { fields?: Record<string, unknown> })
          ?.fields;
        if (!fields) {
          return { pool, reserveA: 0n, reserveB: 0n };
        }
        return {
          pool,
          reserveA: readBalanceField(fields.reserve_a),
          reserveB: readBalanceField(fields.reserve_b),
        };
      } catch {
        return { pool, reserveA: 0n, reserveB: 0n };
      }
    }),
  );
  return summaries;
}