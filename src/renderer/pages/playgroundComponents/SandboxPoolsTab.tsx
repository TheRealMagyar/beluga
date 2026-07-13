import { Droplets, Layers, Plus, RefreshCw } from "lucide-react";
import type {
  DefiSandboxDeployment,
  SandboxPoolListItem,
  SandboxPoolRecord,
} from "./defi-playground";
import { formatPoolPairLabel } from "./defi-playground";
import type { SandboxCoinInfo } from "./defi-coin-catalog";
import { coinLabel } from "./defi-coin-catalog";
import type { SandboxPoolSnapshot } from "./defi-playground";
import {
  formatUnits,
  formatUnitsRaw,
  shortObjectId,
} from "./defi-sandbox-utils";
import { SandboxPoolPanel } from "./SandboxPoolPanel";
import {
  DefiCopyableText,
  DefiHeaderButton,
  DefiHeaderLink,
  DefiPanel,
  DefiPoolCardSkeleton,
  DefiPrimaryButton,
} from "./defi-ui";


export function SandboxPoolsTab({
  deployment,
  pools,
  activePool,
  poolSnapshot,
  poolLoading,
  poolCoins,
  coinOptions,
  selectedCoinTypeA,
  selectedCoinTypeB,
  pendingCoinA,
  pendingCoinB,
  liquidityAmountA,
  liquidityAmountB,
  busy,
  onRefreshPool,
  onRefreshPools,
  onRefreshCoins,
  onSelectPool,
  onSelectCoinA,
  onSelectCoinB,
  onLiquidityAChange,
  onLiquidityBChange,
  onCreatePool,
  onAddLiquidity,
}: {
  deployment: DefiSandboxDeployment | null;
  pools: SandboxPoolListItem[];
  activePool: SandboxPoolRecord | null;
  poolSnapshot: SandboxPoolSnapshot | null;
  poolLoading: boolean;
  poolCoins: { coinA: SandboxCoinInfo; coinB: SandboxCoinInfo } | null;
  coinOptions: SandboxCoinInfo[];
  selectedCoinTypeA: string;
  selectedCoinTypeB: string;
  pendingCoinA: SandboxCoinInfo | undefined;
  pendingCoinB: SandboxCoinInfo | undefined;
  liquidityAmountA: string;
  liquidityAmountB: string;
  busy: string | null;
  onRefreshPool: () => void;
  onRefreshPools: () => void;
  onRefreshCoins: () => void;
  onSelectPool: (poolId: string) => void;
  onSelectCoinA: (type: string) => void;
  onSelectCoinB: (type: string) => void;
  onLiquidityAChange: (v: string) => void;
  onLiquidityBChange: (v: string) => void;
  onCreatePool: () => void;
  onAddLiquidity: () => void;
}) {
  const hasActivePool = Boolean(activePool);

  return (
    <div className="space-y-5">
      <DefiPanel
        title="Your pools"
        subtitle="Create multiple AMM pools per deployment. Select one to add liquidity or swap."
        action={
          <DefiHeaderButton
            onClick={onRefreshPools}
            disabled={poolLoading}
            icon={
              <RefreshCw
                size={12}
                className={`flex-shrink-0 ${poolLoading ? "animate-spin" : ""}`}
              />
            }
          >
            Refresh all
          </DefiHeaderButton>
        }
      >
        {poolLoading && pools.length === 0 && (deployment?.pools?.length ?? 0) > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: Math.min(deployment?.pools?.length ?? 1, 3) }).map(
              (_, index) => (
                <DefiPoolCardSkeleton key={index} />
              ),
            )}
          </div>
        ) : pools.length === 0 ? (
          <p className="text-[12px] text-[#55556a]">
            No pools yet. Create your first pair below.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pools.map(({ pool, reserveA, reserveB }) => (
              <PoolListCard
                key={pool.poolId}
                pool={pool}
                reserveA={reserveA}
                reserveB={reserveB}
                active={pool.poolId === activePool?.poolId}
                onSelect={() => onSelectPool(pool.poolId)}
              />
            ))}
          </div>
        )}
      </DefiPanel>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-5">
        <div className="space-y-5 min-w-0">
          {hasActivePool ? (
            <>
              <SandboxPoolPanel
                snapshot={poolSnapshot}
                loading={poolLoading}
                onRefresh={onRefreshPool}
              />
              {hasActivePool && poolCoins && (
                <DefiPanel
                  title="Active pool reserves"
                  subtitle={`${poolCoins.coinA.symbol}/${poolCoins.coinB.symbol}`}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <ReserveTile
                      symbol={poolCoins.coinA.symbol}
                      amount={poolSnapshot?.reserveA ?? 0n}
                      decimals={poolCoins.coinA.decimals}
                      wallet={poolSnapshot?.walletBalanceA}
                      accent="#4ca3ff"
                    />
                    <ReserveTile
                      symbol={poolCoins.coinB.symbol}
                      amount={poolSnapshot?.reserveB ?? 0n}
                      decimals={poolCoins.coinB.decimals}
                      wallet={poolSnapshot?.walletBalanceB}
                      accent="#34d399"
                    />
                  </div>
                </DefiPanel>
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#2a2a3c] bg-[#12121a]/50 p-8 text-center">
              <Layers className="mx-auto text-[#44445a] mb-3" size={28} />
              <p className="text-[13px] text-[#8888a0]">
                Select a pool above or create a new one.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-5">
          {hasActivePool && poolCoins && (
            <DefiPanel
              title="Add liquidity"
              subtitle={
                activePool
                  ? `Deposit into ${formatPoolPairLabel(activePool)}.`
                  : "Deposit into the selected pool."
              }
            >
              <div className="space-y-3">
                <LiquidityAmountInput
                  label={poolCoins.coinA.symbol}
                  value={liquidityAmountA}
                  walletBalance={poolSnapshot?.walletBalanceA}
                  decimals={poolCoins.coinA.decimals}
                  onChange={onLiquidityAChange}
                />
                <LiquidityAmountInput
                  label={poolCoins.coinB.symbol}
                  value={liquidityAmountB}
                  walletBalance={poolSnapshot?.walletBalanceB}
                  decimals={poolCoins.coinB.decimals}
                  onChange={onLiquidityBChange}
                />
                <DefiPrimaryButton
                  onClick={onAddLiquidity}
                  disabled={!!busy}
                  loading={busy === "liquidity"}
                  className="w-full"
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    <Droplets size={15} />
                    {busy === "liquidity" ? "Adding…" : "Add liquidity"}
                  </span>
                </DefiPrimaryButton>
              </div>
            </DefiPanel>
          )}

          <DefiPanel
            title="Create new pool"
            subtitle="Each pair creates a separate on-chain Pool object."
            action={
              <DefiHeaderLink onClick={onRefreshCoins}>Refresh coins</DefiHeaderLink>
            }
          >
            <div className="space-y-3">
              <CoinSelect
                label="Base (Coin A)"
                value={selectedCoinTypeA}
                options={coinOptions}
                disabled={!deployment?.packageId}
                onChange={onSelectCoinA}
              />
              <CoinSelect
                label="Quote (Coin B)"
                value={selectedCoinTypeB}
                options={coinOptions.filter((c) => c.coinType !== selectedCoinTypeA)}
                disabled={!deployment?.packageId}
                onChange={onSelectCoinB}
              />
              {!deployment?.packageId && (
                <p className="text-[11px] text-[#55556a]">
                  Deploy the sandbox package in Setup first.
                </p>
              )}
              <DefiPrimaryButton
                onClick={onCreatePool}
                disabled={
                  !!busy ||
                  !deployment?.packageId ||
                  !pendingCoinA ||
                  !pendingCoinB ||
                  pendingCoinA.coinType === pendingCoinB.coinType
                }
                loading={busy === "pool"}
                variant="blue"
                className="w-full"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <Plus size={15} />
                  {busy === "pool" ? "Creating…" : "Create pool"}
                </span>
              </DefiPrimaryButton>
            </div>
          </DefiPanel>
        </div>
      </div>
    </div>
  );
}

function PoolListCard({
  pool,
  reserveA,
  reserveB,
  active,
  onSelect,
}: {
  pool: SandboxPoolRecord;
  reserveA: bigint;
  reserveB: bigint;
  active: boolean;
  onSelect: () => void;
}) {
  const hasLiquidity = reserveA > 0n && reserveB > 0n;

  return (
    <button
      onClick={onSelect}
      className={`text-left rounded-xl border p-4 cursor-pointer transition-all duration-200 active:scale-[0.99] ${
        active
          ? "border-[#4ca3ff]/40 bg-[#4ca3ff]/10 ring-1 ring-[#4ca3ff]/20"
          : "border-[#2a2a3c] bg-[#0d0d14]/60 hover:border-[#4ca3ff]/25 hover:bg-[#0d0d14]"
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2 min-w-0">
        <p className="text-[14px] font-semibold text-[#f0f0f5] truncate min-w-0">
          {formatPoolPairLabel(pool)}
        </p>
        <span
          className={`text-[9px] uppercase tracking-wide px-2 py-0.5 rounded-full flex-shrink-0 ${
            hasLiquidity
              ? "bg-[#34d399]/15 text-[#34d399]"
              : "bg-[#ffb347]/15 text-[#ffb347]"
          }`}
        >
          {hasLiquidity ? "Active" : "Empty"}
        </span>
      </div>
      <div className="mb-2" onClick={(e) => e.stopPropagation()}>
        <DefiCopyableText
          value={pool.poolId}
          display={shortObjectId(pool.poolId, 8, 6)}
          truncate
          textClassName="text-[10px] text-[#55556a]"
        />
      </div>
      <div className="flex flex-wrap gap-x-2 gap-y-1 text-[11px] font-mono text-[#8888a0]">
        <span className="truncate max-w-full">
          {formatUnits(reserveA, pool.coinA.decimals)} {pool.coinA.symbol}
        </span>
        <span className="text-[#44445a] hidden sm:inline">·</span>
        <span className="truncate max-w-full">
          {formatUnits(reserveB, pool.coinB.decimals)} {pool.coinB.symbol}
        </span>
      </div>
    </button>
  );
}

function ReserveTile({
  symbol,
  amount,
  decimals,
  wallet,
  accent,
}: {
  symbol: string;
  amount: bigint;
  decimals: number;
  wallet?: bigint;
  accent: string;
}) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: `${accent}33`, background: `${accent}08` }}
    >
      <p className="text-[10px] text-[#8888a0] uppercase tracking-wide">Reserve</p>
      <p className="text-[22px] font-semibold text-[#f0f0f5] mt-1 leading-none">
        {formatUnits(amount, decimals)}
      </p>
      <p className="text-[12px] font-medium mt-1" style={{ color: accent }}>
        {symbol}
      </p>
      {wallet !== undefined && (
        <p className="text-[10px] text-[#55556a] mt-2">
          Wallet: {formatUnits(wallet, decimals)} {symbol}
        </p>
      )}
    </div>
  );
}

function CoinSelect({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: SandboxCoinInfo[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[11px] text-[#8888a0]">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full h-10 px-3 rounded-xl text-[12px] bg-[#0d0d14] border border-[#2a2a3c] text-[#f0f0f5] outline-none disabled:opacity-60"
      >
        <option value="">Select coin…</option>
        {options.map((coin) => (
          <option key={coin.coinType} value={coin.coinType}>
            {coinLabel(coin)}
          </option>
        ))}
      </select>
    </label>
  );
}

function LiquidityAmountInput({
  label,
  value,
  onChange,
  walletBalance,
  decimals = 9,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  walletBalance?: bigint;
  decimals?: number;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] text-[#8888a0]">{label}</span>
        {walletBalance !== undefined && (
          <button
            type="button"
            onClick={() => onChange(formatUnitsRaw(walletBalance, decimals))}
            className="text-[10px] text-[#4ca3ff] bg-transparent border-none cursor-pointer hover:underline"
          >
            Max: {formatUnits(walletBalance, decimals)}
          </button>
        )}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        placeholder="0.0"
        className="w-full h-12 px-4 rounded-xl text-[15px] font-mono bg-[#0d0d14] border border-[#2a2a3c] text-[#f0f0f5] outline-none focus:border-[#34d399]/40"
      />
    </label>
  );
}