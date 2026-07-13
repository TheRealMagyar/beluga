import { Droplets } from "lucide-react";
import type { SandboxCoinInfo } from "./defi-coin-catalog";
import { DefiPanel, DefiPrimaryButton } from "./defi-ui";

export function SandboxFaucetTab({
  tokenA,
  tokenB,
  faucetAmountA,
  faucetAmountB,
  busy,
  onFaucetAChange,
  onFaucetBChange,
  onFaucetA,
  onFaucetB,
  onFaucetBoth,
}: {
  tokenA: SandboxCoinInfo;
  tokenB: SandboxCoinInfo;
  faucetAmountA: string;
  faucetAmountB: string;
  busy: string | null;
  onFaucetAChange: (v: string) => void;
  onFaucetBChange: (v: string) => void;
  onFaucetA: () => void;
  onFaucetB: () => void;
  onFaucetBoth: () => void;
}) {
  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <DefiPanel
        title="Sandbox token faucet"
        subtitle="Mint TA and TB for testing liquidity and swaps. Works with any pool pair."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FaucetCard
            coin={tokenA}
            amount={faucetAmountA}
            onAmountChange={onFaucetAChange}
            onFaucet={onFaucetA}
            busy={busy === "faucet-a"}
            disabled={!!busy}
            accent="#4ca3ff"
          />
          <FaucetCard
            coin={tokenB}
            amount={faucetAmountB}
            onAmountChange={onFaucetBChange}
            onFaucet={onFaucetB}
            busy={busy === "faucet-b"}
            disabled={!!busy}
            accent="#34d399"
          />
        </div>

        <div className="mt-5 pt-5 border-t border-[#2a2a3c] flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <p className="text-[11px] text-[#55556a] flex-1">
            Mint both tokens in one transaction with independent amounts.
          </p>
          <DefiPrimaryButton
            onClick={onFaucetBoth}
            disabled={!!busy}
            loading={busy === "faucet-both"}
            variant="blue"
          >
            {busy === "faucet-both"
              ? "Minting…"
              : `Mint ${tokenA.symbol} + ${tokenB.symbol}`}
          </DefiPrimaryButton>
        </div>
      </DefiPanel>
    </div>
  );
}

function FaucetCard({
  coin,
  amount,
  onAmountChange,
  onFaucet,
  busy,
  disabled,
  accent,
}: {
  coin: SandboxCoinInfo;
  amount: string;
  onAmountChange: (v: string) => void;
  onFaucet: () => void;
  busy: boolean;
  disabled: boolean;
  accent: string;
}) {
  return (
    <div
      className="rounded-2xl border p-4 flex flex-col"
      style={{ borderColor: `${accent}33`, background: `${accent}06` }}
    >
      <div className="flex items-center gap-3 mb-4">
        <span
          className="h-10 w-10 rounded-full border flex items-center justify-center text-[12px] font-bold"
          style={{ color: accent, borderColor: `${accent}55`, background: `${accent}18` }}
        >
          {coin.symbol.slice(0, 3)}
        </span>
        <div>
          <p className="text-[14px] font-semibold text-[#f0f0f5]">{coin.symbol}</p>
          <p className="text-[11px] text-[#55556a]">{coin.name}</p>
        </div>
      </div>

      <label className="block flex-1">
        <span className="text-[11px] text-[#8888a0]">Amount</span>
        <input
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          inputMode="decimal"
          className="mt-1.5 w-full h-11 px-3 rounded-xl text-[15px] font-mono bg-[#0d0d14] border border-[#2a2a3c] text-[#f0f0f5] outline-none focus:border-[#34d399]/40"
        />
        <p className="mt-1 text-[10px] text-[#44445a]">
          {coin.decimals} decimals · raw preview{" "}
          {amount.trim() ? "on submit" : "—"}
        </p>
      </label>

      <DefiPrimaryButton
        onClick={onFaucet}
        disabled={disabled}
        loading={busy}
        className="w-full mt-4"
      >
        <span className="inline-flex items-center justify-center gap-2">
          <Droplets size={14} />
          {busy ? "Minting…" : `Mint ${coin.symbol}`}
        </span>
      </DefiPrimaryButton>
    </div>
  );
}