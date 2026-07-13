import { ArrowDownUp, ArrowLeftRight } from "lucide-react";
import type { SandboxCoinInfo } from "./defi-coin-catalog";
import {
  formatPoolPairLabel,
  type SandboxPoolListItem,
  type SandboxPoolRecord,
  type SandboxPoolSnapshot,
} from "./defi-playground";
import {
  SANDBOX_FEE_BPS,
  formatPriceBPerA,
  formatUnits,
  formatUnitsRaw,
} from "./defi-sandbox-utils";
import { SandboxPoolPanel } from "./SandboxPoolPanel";
import { DefiPrimaryButton, DefiStatGrid } from "./defi-ui";

export function SandboxSwapTab({
  pools,
  activePool,
  poolSnapshot,
  poolLoading,
  poolCoins,
  swapAmount,
  swapDirection,
  swapEstimate,
  busy,
  onRefreshPool,
  onSelectPool,
  onSwapAmountChange,
  onFlipDirection,
  onSwap,
}: {
  pools: SandboxPoolListItem[];
  activePool: SandboxPoolRecord | null;
  poolSnapshot: SandboxPoolSnapshot | null;
  poolLoading: boolean;
  poolCoins: { coinA: SandboxCoinInfo; coinB: SandboxCoinInfo } | null;
  swapAmount: string;
  swapDirection: "a-for-b" | "b-for-a";
  swapEstimate: bigint | null;
  busy: string | null;
  onRefreshPool: () => void;
  onSelectPool: (poolId: string) => void;
  onSwapAmountChange: (v: string) => void;
  onFlipDirection: () => void;
  onSwap: () => void;
}) {
  const activePoolId = activePool?.poolId ?? null;
  const hasPool = Boolean(activePool);
  const inCoin =
    swapDirection === "a-for-b" ? poolCoins?.coinA : poolCoins?.coinB;
  const outCoin =
    swapDirection === "a-for-b" ? poolCoins?.coinB : poolCoins?.coinA;

  const price =
    poolSnapshot && poolCoins
      ? formatPriceBPerA(
          poolSnapshot.reserveA,
          poolSnapshot.reserveB,
          poolCoins.coinA.decimals,
          poolCoins.coinB.decimals,
        )
      : null;

  const walletIn =
    swapDirection === "a-for-b"
      ? poolSnapshot?.walletBalanceA
      : poolSnapshot?.walletBalanceB;

  const hasLiquidity = Boolean(
    poolSnapshot &&
      poolSnapshot.reserveA > 0n &&
      poolSnapshot.reserveB > 0n,
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,480px)_1fr] gap-5 items-start">
      <div className="w-full max-w-[480px] mx-auto xl:mx-0">
        <div className="rounded-2xl border border-[#34d399]/20 bg-gradient-to-b from-[#12121a] to-[#0d1210] p-1 shadow-[0_20px_60px_-30px_rgba(52,211,153,0.35)]">
          <div className="rounded-[14px] bg-[#12121a] p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-[16px] font-semibold text-[#f0f0f5]">Swap</h2>
                <p className="text-[11px] text-[#55556a] mt-0.5">
                  Constant-product AMM · {(SANDBOX_FEE_BPS / 100).toFixed(2)}% fee
                </p>
              </div>
              <button
                onClick={onFlipDirection}
                disabled={!poolCoins}
                title="Flip direction"
                className="h-9 w-9 rounded-xl border border-[#2a2a3c] bg-[#0d0d14] text-[#8888a0] hover:text-[#34d399] cursor-pointer disabled:opacity-40 flex items-center justify-center"
              >
                <ArrowDownUp size={16} />
              </button>
            </div>

            {pools.length > 0 ? (
              <label className="block">
                <span className="text-[11px] text-[#8888a0]">Pool</span>
                <select
                  value={activePoolId ?? ""}
                  onChange={(e) => onSelectPool(e.target.value)}
                  className="mt-1.5 w-full h-10 px-3 rounded-xl text-[12px] bg-[#0d0d14] border border-[#2a2a3c] text-[#f0f0f5] outline-none"
                >
                  {pools.map(({ pool }) => (
                    <option key={pool.poolId} value={pool.poolId}>
                      {formatPoolPairLabel(pool)}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="text-[11px] text-[#55556a] rounded-xl border border-dashed border-[#2a2a3c] px-3 py-2.5">
                Create a pool in the Pools tab first.
              </p>
            )}

            <SwapTokenBox
              label="You pay"
              symbol={inCoin?.symbol ?? "—"}
              amount={swapAmount}
              onAmountChange={onSwapAmountChange}
              walletBalance={walletIn}
              decimals={inCoin?.decimals}
              editable
            />

            <div className="flex justify-center -my-1">
              <div className="h-8 w-8 rounded-lg border border-[#2a2a3c] bg-[#0d0d14] flex items-center justify-center text-[#55556a]">
                <ArrowLeftRight size={14} />
              </div>
            </div>

            <SwapTokenBox
              label="You receive (est.)"
              symbol={outCoin?.symbol ?? "—"}
              amount={
                swapEstimate != null && outCoin
                  ? formatUnits(swapEstimate, outCoin.decimals)
                  : ""
              }
              decimals={outCoin?.decimals}
              editable={false}
              muted
            />

            {price && poolCoins && (
              <p className="text-[11px] text-[#55556a] text-center">
                1 {poolCoins.coinA.symbol} ≈ {price} {poolCoins.coinB.symbol}
              </p>
            )}

            {!hasLiquidity && hasPool && !poolLoading && (
              <p className="text-[11px] text-[#ffb347] text-center">
                Pool needs liquidity on both sides before swapping.
              </p>
            )}

            <DefiPrimaryButton
              onClick={onSwap}
              disabled={
                !!busy ||
                !hasPool ||
                !hasLiquidity ||
                poolLoading ||
                !swapAmount.trim()
              }
              loading={busy === "swap-ab" || busy === "swap-ba"}
              className="w-full"
            >
              {!hasPool
                ? "Create a pool first"
                : !hasLiquidity
                  ? "Add liquidity first"
                  : busy === "swap-ab" || busy === "swap-ba"
                    ? "Swapping…"
                    : `Swap ${inCoin?.symbol ?? ""} → ${outCoin?.symbol ?? ""}`}
            </DefiPrimaryButton>
          </div>
        </div>
      </div>

      <div className="space-y-5 min-w-0">
        <SandboxPoolPanel
          snapshot={poolSnapshot}
          loading={poolLoading}
          onRefresh={onRefreshPool}
        />

        {poolSnapshot && poolCoins && (
          <div className="rounded-2xl border border-[#2a2a3c] bg-[#12121a] p-5">
            <h3 className="text-[13px] font-semibold text-[#f0f0f5] mb-3">
              Market info
            </h3>
            <DefiStatGrid
              items={[
                {
                  label: "Pair",
                  value: `${poolCoins.coinA.symbol}/${poolCoins.coinB.symbol}`,
                },
                {
                  label: "Fee",
                  value: `${(SANDBOX_FEE_BPS / 100).toFixed(2)}%`,
                },
                {
                  label: "Reserve A",
                  value: `${formatUnits(poolSnapshot.reserveA, poolCoins.coinA.decimals)} ${poolCoins.coinA.symbol}`,
                  accent: "#4ca3ff",
                },
                {
                  label: "Reserve B",
                  value: `${formatUnits(poolSnapshot.reserveB, poolCoins.coinB.decimals)} ${poolCoins.coinB.symbol}`,
                  accent: "#34d399",
                },
              ]}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function SwapTokenBox({
  label,
  symbol,
  amount,
  onAmountChange,
  walletBalance,
  decimals = 9,
  editable,
  muted,
}: {
  label: string;
  symbol: string;
  amount: string;
  onAmountChange?: (v: string) => void;
  walletBalance?: bigint;
  decimals?: number;
  editable?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        muted
          ? "border-[#2a2a3c] bg-[#0d0d14]/50"
          : "border-[#2a2a3c] bg-[#0d0d14]"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-[#8888a0]">{label}</span>
        {walletBalance !== undefined && editable && (
          <button
            type="button"
            onClick={() => onAmountChange?.(formatUnitsRaw(walletBalance, decimals))}
            className="text-[10px] text-[#4ca3ff] bg-transparent border-none cursor-pointer hover:underline"
          >
            Balance: {formatUnits(walletBalance, decimals)}
          </button>
        )}
      </div>
      <div className="flex items-center gap-3">
        <input
          value={amount}
          onChange={(e) => onAmountChange?.(e.target.value)}
          readOnly={!editable}
          inputMode="decimal"
          placeholder="0.0"
          className={`flex-1 min-w-0 bg-transparent border-none outline-none text-[22px] font-mono ${
            muted ? "text-[#8888a0]" : "text-[#f0f0f5]"
          }`}
        />
        <span className="h-9 px-3 rounded-xl border border-[#2a2a3c] bg-[#12121a] text-[12px] font-semibold text-[#f0f0f5] flex items-center">
          {symbol}
        </span>
      </div>
    </div>
  );
}