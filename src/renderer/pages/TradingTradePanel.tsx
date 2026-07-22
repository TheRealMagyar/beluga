import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "../components/Walletcontext";

const TRADE_ASSETS = [
  "SUI",
  "USDC",
  "USDsui",
  "wBTC",
  "ETH",
  "CETUS",
  "DEEP",
  "WAL",
  "NAVX",
  "IKA",
] as const;

const MARKETS = ["SUI", "WAL", "DEEP", "CETUS", "ETH", "wBTC", "NAVX", "IKA"] as const;

type TabId = "swap" | "long" | "short" | "positions";

interface TradingTradePanelProps {
  /** Preferred market from the active chart symbol (e.g. SUI, WAL) */
  preferredMarket?: string | null;
}

function shortAddr(addr: string) {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function digestOf(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  if (typeof r.tx === "string") return r.tx;
  if (typeof r.digest === "string") return r.digest;
  if (r.result && typeof r.result === "object") {
    const inner = r.result as Record<string, unknown>;
    if (typeof inner.tx === "string") return inner.tx;
    if (typeof inner.digest === "string") return inner.digest;
  }
  return null;
}

export function TradingTradePanel({ preferredMarket }: TradingTradePanelProps) {
  const { walletInfo, balance, network, refresh } = useWallet();
  const [tab, setTab] = useState<TabId>("long");

  // Swap
  const [from, setFrom] = useState("USDC");
  const [to, setTo] = useState("SUI");
  const [swapAmount, setSwapAmount] = useState("");
  const [quote, setQuote] = useState<{
    toAmount?: number;
    priceImpact?: number;
    route?: string;
  } | null>(null);

  // Long / Short
  const [market, setMarket] = useState<string>("SUI");
  const [tradeAmount, setTradeAmount] = useState("");
  const [leverage, setLeverage] = useState(1);
  const [slippage, setSlippage] = useState(1);
  const [tradeQuote, setTradeQuote] = useState<{
    toAmount?: number;
    priceImpact?: number;
    route?: string;
  } | null>(null);

  // Positions / NAVI
  const [positions, setPositions] = useState<
    Array<{
      protocol: string;
      asset: string;
      type: "save" | "borrow";
      amount: number;
      amountUsd?: number;
      apy: number;
    }>
  >([]);
  const [health, setHealth] = useState<{
    healthFactor: number;
    supplied: number;
    borrowed: number;
    maxBorrow: number;
  } | null>(null);
  const [collateralAmount, setCollateralAmount] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const connected = Boolean(walletInfo?.address);
  const mainnet = network === "mainnet";

  useEffect(() => {
    if (!preferredMarket) return;
    const m = preferredMarket.toUpperCase().replace(/^DB:/, "").split("_")[0];
    if (MARKETS.includes(m as (typeof MARKETS)[number])) {
      setMarket(m);
      if (tab === "swap" && from === "USDC") setTo(m);
    }
  }, [preferredMarket]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadPositions = useCallback(async () => {
    if (!connected || !mainnet) return;
    try {
      const [posRes, healthRes] = await Promise.all([
        window.sui.naviPositions(),
        window.sui.naviHealth(),
      ]);
      if (posRes.success && posRes.result?.positions) {
        setPositions(posRes.result.positions);
      }
      if (healthRes.success && healthRes.health) {
        setHealth(healthRes.health as typeof health);
      }
    } catch {
      /* ignore */
    }
  }, [connected, mainnet]);

  useEffect(() => {
    if (tab === "positions") void loadPositions();
  }, [tab, loadPositions]);

  const balanceLabel = useMemo(() => {
    if (!balance) return null;
    // Balance shape may vary; show total if present
    const anyBal = balance as { totalBalance?: string; sui?: number; total?: number };
    if (typeof anyBal.sui === "number") return `${anyBal.sui.toFixed(4)} SUI`;
    if (typeof anyBal.total === "number") return String(anyBal.total);
    return null;
  }, [balance]);

  const clearMsg = () => {
    setError("");
    setSuccess("");
  };

  const runSwapQuote = async () => {
    clearMsg();
    if (!swapAmount || Number(swapAmount) <= 0) {
      setError("Enter amount");
      return;
    }
    setBusy(true);
    try {
      const res = await window.sui.swapQuote({
        from,
        to,
        amount: swapAmount,
      });
      if (!res.success) throw new Error(res.error || "Quote failed");
      setQuote(res.quote as typeof quote);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setQuote(null);
    } finally {
      setBusy(false);
    }
  };

  const runSwap = async () => {
    clearMsg();
    if (!swapAmount || Number(swapAmount) <= 0) {
      setError("Enter amount");
      return;
    }
    setBusy(true);
    try {
      const res = await window.sui.swap({
        from,
        to,
        amount: swapAmount,
        slippage,
      });
      if (!res.success) throw new Error(res.error || "Swap failed");
      const d = digestOf(res.result) || digestOf(res);
      setSuccess(d ? `Swap ok · ${d.slice(0, 12)}…` : "Swap successful");
      setQuote(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const runTradeQuote = async (side: "long" | "short") => {
    clearMsg();
    if (!tradeAmount || Number(tradeAmount) <= 0) {
      setError("Enter amount");
      return;
    }
    const fromAsset = side === "long" ? "USDC" : market;
    const toAsset = side === "long" ? market : "USDC";
    const spend =
      leverage > 1
        ? String(Number(tradeAmount) * leverage)
        : tradeAmount;
    setBusy(true);
    try {
      const res = await window.sui.swapQuote({
        from: fromAsset,
        to: toAsset,
        amount: spend,
      });
      if (!res.success) throw new Error(res.error || "Quote failed");
      setTradeQuote(res.quote as typeof tradeQuote);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setTradeQuote(null);
    } finally {
      setBusy(false);
    }
  };

  const runTrade = async (side: "long" | "short") => {
    clearMsg();
    if (!tradeAmount || Number(tradeAmount) <= 0) {
      setError("Enter amount");
      return;
    }
    setBusy(true);
    try {
      const res = await window.sui.openTrade({
        side,
        market,
        amount: tradeAmount,
        slippage,
        leverage,
        quoteAsset: "USDC",
      });
      if (!res.success) throw new Error(res.error || "Trade failed");
      const last = res.steps?.[res.steps.length - 1]?.result;
      const d = digestOf(last);
      setSuccess(
        d
          ? `${side.toUpperCase()} ${market} · ${d.slice(0, 12)}…`
          : `${side.toUpperCase()} ${market} opened`,
      );
      setTradeQuote(null);
      await refresh();
      void loadPositions();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const depositCollateral = async () => {
    clearMsg();
    if (!collateralAmount || Number(collateralAmount) <= 0) {
      setError("Enter collateral amount");
      return;
    }
    setBusy(true);
    try {
      const res = await window.sui.naviSave({
        amount: Number(collateralAmount),
        asset: "USDC",
      });
      if (!res.success) throw new Error(res.error || "Deposit failed");
      setSuccess("Collateral deposited to NAVI");
      setCollateralAmount("");
      await refresh();
      void loadPositions();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const repayAll = async (asset: string) => {
    clearMsg();
    setBusy(true);
    try {
      const res = await window.sui.naviRepay({ amount: "all", asset });
      if (!res.success) throw new Error(res.error || "Repay failed");
      setSuccess(`Repaid ${asset}`);
      await refresh();
      void loadPositions();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!connected) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
        <div className="text-sm text-[#a8a8c0]">Connect Beluga wallet</div>
        <div className="text-[11px] text-[#55556a]">
          Use the wallet button in the sidebar (T2000 agent)
        </div>
      </div>
    );
  }

  if (!mainnet) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
        <div className="text-sm text-[#fbbf24]">Mainnet required</div>
        <div className="text-[11px] leading-relaxed text-[#66667a]">
          T2000 swap &amp; NAVI trades run on mainnet. Switch network in the wallet.
        </div>
      </div>
    );
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "long", label: "Long" },
    { id: "short", label: "Short" },
    { id: "swap", label: "Swap" },
    { id: "positions", label: "Pos" },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
        <div className="text-xs font-semibold text-[#e8e8f0]">Trade</div>
        <div className="font-mono text-[10px] text-[#55556a]">
          {shortAddr(walletInfo!.address)}
          {balanceLabel ? ` · ${balanceLabel}` : ""}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 border-b border-white/[0.04] p-1.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              clearMsg();
              setQuote(null);
              setTradeQuote(null);
            }}
            className={`flex-1 rounded-md py-1.5 text-[11px] font-semibold transition-colors ${
              tab === t.id
                ? t.id === "long"
                  ? "bg-[#0ecb81]/15 text-[#0ecb81]"
                  : t.id === "short"
                    ? "bg-[#f6465d]/15 text-[#f6465d]"
                    : "bg-[#4ca3ff]/15 text-[#4ca3ff]"
                : "text-[#6b6b80] hover:bg-white/[0.04] hover:text-[#c8c8d8]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-3 overflow-auto p-3">
        {(tab === "long" || tab === "short") && (
          <>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-[#55556a]">
                Market
              </label>
              <select
                value={market}
                onChange={(e) => {
                  setMarket(e.target.value);
                  setTradeQuote(null);
                }}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-sm text-[#f0f0f5] outline-none focus:border-[#4ca3ff]/40"
              >
                {MARKETS.map((m) => (
                  <option key={m} value={m}>
                    {m}/USDC
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-[#55556a]">
                {tab === "long" ? "Pay (USDC)" : `Sell (${market})`}
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={tradeAmount}
                onChange={(e) => {
                  setTradeAmount(e.target.value);
                  setTradeQuote(null);
                }}
                placeholder="0.00"
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 font-mono text-sm text-[#f0f0f5] outline-none placeholder:text-[#444] focus:border-[#4ca3ff]/40"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-[#55556a]">
                <span>Leverage</span>
                <span className="font-mono text-[#a8a8c0]">{leverage.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                step={0.5}
                value={leverage}
                onChange={(e) => {
                  setLeverage(Number(e.target.value));
                  setTradeQuote(null);
                }}
                className="w-full accent-[#4ca3ff]"
              />
              <div className="mt-0.5 flex justify-between text-[9px] text-[#444]">
                <span>1x spot</span>
                <span>5x NAVI</span>
              </div>
              {leverage > 1 && (
                <p className="mt-1 text-[10px] leading-snug text-[#66667a]">
                  {tab === "long"
                    ? `Borrows ~${(Number(tradeAmount || 0) * (leverage - 1)).toFixed(4)} USDC on NAVI, then swaps ${leverage}× size → ${market}.`
                    : `Borrows ~${(Number(tradeAmount || 0) * (leverage - 1)).toFixed(4)} ${market} on NAVI, then sells ${leverage}× size → USDC.`}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <label className="text-[10px] text-[#55556a]">Slippage %</label>
              <input
                type="number"
                min={0.1}
                max={5}
                step={0.1}
                value={slippage}
                onChange={(e) => setSlippage(Number(e.target.value) || 1)}
                className="w-16 rounded border border-white/[0.08] bg-white/[0.03] px-2 py-1 font-mono text-xs text-[#f0f0f5] outline-none"
              />
            </div>

            {tradeQuote && (
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-[11px] text-[#a8a8c0]">
                <div className="flex justify-between">
                  <span>Est. out</span>
                  <span className="font-mono text-[#e8e8f0]">
                    {tradeQuote.toAmount != null
                      ? Number(tradeQuote.toAmount).toPrecision(6)
                      : "—"}{" "}
                    {tab === "long" ? market : "USDC"}
                  </span>
                </div>
                {tradeQuote.priceImpact != null && (
                  <div className="mt-1 flex justify-between">
                    <span>Impact</span>
                    <span className="font-mono">
                      {(Number(tradeQuote.priceImpact) * 100).toFixed(3)}%
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => runTradeQuote(tab)}
                className="flex-1 rounded-lg border border-white/[0.1] py-2 text-xs font-medium text-[#c8c8d8] hover:bg-white/[0.04] disabled:opacity-40"
              >
                Quote
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => runTrade(tab)}
                className={`flex-[1.4] rounded-lg py-2 text-xs font-bold text-white disabled:opacity-40 ${
                  tab === "long"
                    ? "bg-[#0ecb81] hover:bg-[#0bb870]"
                    : "bg-[#f6465d] hover:bg-[#e03e54]"
                }`}
              >
                {busy
                  ? "…"
                  : tab === "long"
                    ? `Long ${market}`
                    : `Short ${market}`}
              </button>
            </div>
          </>
        )}

        {tab === "swap" && (
          <>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-[#55556a]">
                From
              </label>
              <select
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setQuote(null);
                }}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-sm outline-none"
              >
                {TRADE_ASSETS.filter((a) => a !== to).map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-[#55556a]">
                Amount
              </label>
              <input
                type="number"
                min="0"
                value={swapAmount}
                onChange={(e) => {
                  setSwapAmount(e.target.value);
                  setQuote(null);
                }}
                placeholder="0.00"
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 font-mono text-sm outline-none placeholder:text-[#444]"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setFrom(to);
                setTo(from);
                setQuote(null);
              }}
              className="mx-auto flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.08] text-xs text-[#888] hover:bg-white/[0.05]"
            >
              ↕
            </button>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-[#55556a]">
                To
              </label>
              <select
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setQuote(null);
                }}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-sm outline-none"
              >
                {TRADE_ASSETS.filter((a) => a !== from).map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            {quote && (
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-[11px] text-[#a8a8c0]">
                <div className="flex justify-between">
                  <span>You get</span>
                  <span className="font-mono text-[#e8e8f0]">
                    {quote.toAmount != null
                      ? Number(quote.toAmount).toPrecision(6)
                      : "—"}{" "}
                    {to}
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={runSwapQuote}
                className="flex-1 rounded-lg border border-white/[0.1] py-2 text-xs font-medium text-[#c8c8d8] hover:bg-white/[0.04] disabled:opacity-40"
              >
                Quote
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={runSwap}
                className="flex-[1.4] rounded-lg bg-[#4ca3ff] py-2 text-xs font-bold text-white hover:bg-[#3b92ee] disabled:opacity-40"
              >
                {busy ? "…" : "Swap"}
              </button>
            </div>
          </>
        )}

        {tab === "positions" && (
          <>
            {health && (
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 text-[11px]">
                <div>
                  <div className="text-[#55556a]">Health</div>
                  <div
                    className={`font-mono font-semibold ${
                      health.healthFactor < 1.2
                        ? "text-[#f6465d]"
                        : health.healthFactor < 1.5
                          ? "text-[#fbbf24]"
                          : "text-[#0ecb81]"
                    }`}
                  >
                    {health.healthFactor === Infinity || health.healthFactor > 100
                      ? "∞"
                      : health.healthFactor.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-[#55556a]">Supplied</div>
                  <div className="font-mono text-[#e8e8f0]">
                    ${health.supplied?.toFixed?.(2) ?? health.supplied}
                  </div>
                </div>
                <div>
                  <div className="text-[#55556a]">Borrowed</div>
                  <div className="font-mono text-[#e8e8f0]">
                    ${health.borrowed?.toFixed?.(2) ?? health.borrowed}
                  </div>
                </div>
                <div>
                  <div className="text-[#55556a]">Max borrow</div>
                  <div className="font-mono text-[#e8e8f0]">
                    ${health.maxBorrow?.toFixed?.(2) ?? health.maxBorrow}
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-[#55556a]">
                Deposit USDC collateral (NAVI)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  value={collateralAmount}
                  onChange={(e) => setCollateralAmount(e.target.value)}
                  placeholder="0.00"
                  className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 font-mono text-sm outline-none"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={depositCollateral}
                  className="rounded-lg bg-[#6c63ff]/20 px-3 text-xs font-semibold text-[#a8a0ff] hover:bg-[#6c63ff]/30 disabled:opacity-40"
                >
                  Deposit
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-[#55556a]">
                Open positions
              </span>
              <button
                type="button"
                onClick={() => void loadPositions()}
                className="text-[10px] text-[#4ca3ff] hover:underline"
              >
                Refresh
              </button>
            </div>

            {positions.length === 0 ? (
              <div className="py-6 text-center text-[11px] text-[#55556a]">
                No NAVI positions
              </div>
            ) : (
              <div className="space-y-1.5">
                {positions.map((p, i) => (
                  <div
                    key={`${p.protocol}-${p.asset}-${p.type}-${i}`}
                    className="flex items-center justify-between rounded-lg border border-white/[0.05] px-2.5 py-2"
                  >
                    <div>
                      <div className="text-xs font-medium text-[#e8e8f0]">
                        {p.asset}{" "}
                        <span
                          className={
                            p.type === "borrow"
                              ? "text-[#f6465d]"
                              : "text-[#0ecb81]"
                          }
                        >
                          {p.type}
                        </span>
                      </div>
                      <div className="font-mono text-[10px] text-[#666]">
                        {p.amount.toPrecision(5)}
                        {p.apy != null ? ` · ${(p.apy * 100).toFixed(1)}% APY` : ""}
                      </div>
                    </div>
                    {p.type === "borrow" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => repayAll(p.asset)}
                        className="rounded border border-white/[0.08] px-2 py-1 text-[10px] text-[#c8c8d8] hover:bg-white/[0.04] disabled:opacity-40"
                      >
                        Repay
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {error && (
          <div className="rounded-lg border border-[#f6465d]/30 bg-[#f6465d]/10 px-2.5 py-2 text-[11px] text-[#f87171]">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg border border-[#0ecb81]/30 bg-[#0ecb81]/10 px-2.5 py-2 text-[11px] text-[#34d399]">
            {success}
          </div>
        )}
      </div>

      <div className="border-t border-white/[0.04] px-3 py-1.5 text-[9px] text-[#3a3a48]">
        T2000 agent · Cetus swap · NAVI lend
      </div>
    </div>
  );
}
