import { Droplets, RefreshCw, Wallet } from "lucide-react";
import type { SandboxCoinInfo } from "./defi-coin-catalog";
import { SANDBOX_FEE_BPS, formatPriceBPerA, formatUnits, shortObjectId } from "./defi-sandbox-utils";
import type { SandboxPoolSnapshot } from "./defi-playground";

import { DefiCopyableText, DefiSkeleton } from "./defi-ui";

export function SandboxPoolPanel({
  snapshot,
  loading,
  onRefresh,
}: {
  snapshot: SandboxPoolSnapshot | null;
  loading?: boolean;
  onRefresh: () => void;
}) {
  if (loading && !snapshot) {
    return (
      <section className="rounded-2xl border border-[#2a2a3c] bg-[#12121a] p-4 space-y-3">
        <div className="flex justify-between">
          <DefiSkeleton className="h-5 w-32" />
          <DefiSkeleton className="h-8 w-8 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <DefiSkeleton className="h-24" />
          <DefiSkeleton className="h-24" />
        </div>
        <DefiSkeleton className="h-10" />
      </section>
    );
  }

  if (!snapshot) {
    return (
      <section className="rounded-2xl border border-[#2a2a3c] bg-[#12121a] p-4">
        <p className="text-[12px] text-[#55556a]">
          No pool selected. Create or pick a pool from the list.
        </p>
      </section>
    );
  }

  const { coinA, coinB } = snapshot;
  const price = formatPriceBPerA(
    snapshot.reserveA,
    snapshot.reserveB,
    coinA.decimals,
    coinB.decimals,
  );
  const hasLiquidity = snapshot.reserveA > 0n && snapshot.reserveB > 0n;

  return (
    <section
      className={`rounded-2xl border border-[#34d399]/25 bg-gradient-to-br from-[#12121a] to-[#0d1412] p-4 transition-opacity duration-200 ${
        loading ? "opacity-70" : "opacity-100"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              <CoinBadge symbol={coinA.symbol} accent="#4ca3ff" />
              <CoinBadge symbol={coinB.symbol} accent="#34d399" />
            </div>
            <div>
              <h3 className="text-[14px] font-semibold text-[#f0f0f5]">
                {coinA.symbol} / {coinB.symbol}
              </h3>
              <DefiCopyableText
                value={snapshot.poolId}
                display={shortObjectId(snapshot.poolId, 8, 6)}
                textClassName="text-[10px] text-[#55556a]"
              />
            </div>
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="h-8 w-8 flex items-center justify-center rounded-xl border border-[#2a2a3c] bg-[#0d0d14] text-[#8888a0] hover:text-[#f0f0f5] cursor-pointer disabled:opacity-50"
          title="Refresh pool"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <ReserveCard coin={coinA} amount={snapshot.reserveA} accent="#4ca3ff" />
        <ReserveCard coin={coinB} amount={snapshot.reserveB} accent="#34d399" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-[11px]">
        <Stat
          label="Price"
          value={
            price
              ? `1 ${coinA.symbol} ≈ ${price} ${coinB.symbol}`
              : "—"
          }
        />
        <Stat label="Fee" value={`${(SANDBOX_FEE_BPS / 100).toFixed(2)}%`} />
        <Stat
          label="Pool TVL"
          value={
            hasLiquidity
              ? `${formatUnits(snapshot.reserveA, coinA.decimals)} ${coinA.symbol}`
              : "Empty"
          }
        />
        <Stat
          label="Status"
          value={hasLiquidity ? "Active" : "Needs liquidity"}
          accent={hasLiquidity ? "#34d399" : "#ffb347"}
        />
      </div>

      <div className="rounded-xl border border-[#2a2a3c] bg-[#0d0d14]/80 px-3 py-2.5 flex items-center gap-2">
        <Wallet size={13} className="text-[#8888a0] flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] text-[#55556a] uppercase tracking-wide mb-0.5">
            Your wallet
          </p>
          <p className="text-[12px] font-mono text-[#d8d8ea] truncate">
            {formatUnits(snapshot.walletBalanceA, coinA.decimals)} {coinA.symbol}
            <span className="text-[#55556a] mx-1.5">·</span>
            {formatUnits(snapshot.walletBalanceB, coinB.decimals)} {coinB.symbol}
          </p>
        </div>
      </div>
    </section>
  );
}

function CoinBadge({ symbol, accent }: { symbol: string; accent: string }) {
  return (
    <span
      className="h-7 w-7 rounded-full border flex items-center justify-center text-[10px] font-bold"
      style={{
        color: accent,
        borderColor: `${accent}66`,
        background: `${accent}22`,
      }}
    >
      {symbol.slice(0, 3)}
    </span>
  );
}

function ReserveCard({
  coin,
  amount,
  accent,
}: {
  coin: SandboxCoinInfo;
  amount: bigint;
  accent: string;
}) {
  return (
    <div
      className="rounded-xl border bg-[#0d0d14]/60 p-3"
      style={{ borderColor: `${accent}33` }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <Droplets size={12} style={{ color: accent }} />
        <span className="text-[10px] text-[#8888a0] uppercase tracking-wide">
          Reserve
        </span>
      </div>
      <p className="text-[18px] font-semibold text-[#f0f0f5] leading-tight">
        {formatUnits(amount, coin.decimals)}
      </p>
      <p className="text-[11px] font-medium mt-0.5" style={{ color: accent }}>
        {coin.symbol}
      </p>
      <p className="text-[10px] text-[#55556a] mt-0.5">{coin.name}</p>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-[#2a2a3c] bg-[#0d0d14]/50 px-2.5 py-2">
      <p className="text-[9px] text-[#55556a] uppercase tracking-wide">{label}</p>
      <p
        className="text-[11px] font-medium mt-0.5 truncate"
        style={{ color: accent ?? "#c7c7d8" }}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}