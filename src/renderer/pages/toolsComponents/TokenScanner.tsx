import { useState } from "react";
import {
  Search,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Info,
  Droplets,
  Lock,
  Unlock,
  HelpCircle,
} from "lucide-react";
import type { SuiNetwork } from "../../types/network";
import { SUI_NETWORKS } from "../../types/network";

type ScanResult = Awaited<ReturnType<typeof window.tools.scanToken>>;

function shortType(coinType: string) {
  const parts = coinType.split("::");
  if (parts.length < 3) return coinType;
  const pkg = parts[0];
  return `${pkg.slice(0, 6)}…${pkg.slice(-4)}::${parts[1]}::${parts[2]}`;
}

const RISK_STYLES: Record<
  ScanResult["riskLevel"],
  { label: string; color: string; bg: string; border: string }
> = {
  low: {
    label: "Low risk",
    color: "#00d4aa",
    bg: "#00d4aa15",
    border: "#00d4aa35",
  },
  medium: {
    label: "Medium risk",
    color: "#ffb347",
    bg: "#ffb34715",
    border: "#ffb34735",
  },
  high: {
    label: "High risk",
    color: "#ff7b5f",
    bg: "#ff7b5f15",
    border: "#ff7b5f35",
  },
  critical: {
    label: "Critical risk",
    color: "#ff4d6d",
    bg: "#ff4d6d15",
    border: "#ff4d6d35",
  },
};

function SignalIcon({ severity }: { severity: ScanResult["signals"][number]["severity"] }) {
  if (severity === "danger") return <ShieldAlert size={14} className="text-[#ff4d6d]" />;
  if (severity === "warning") return <AlertTriangle size={14} className="text-[#ffb347]" />;
  if (severity === "good") return <ShieldCheck size={14} className="text-[#00d4aa]" />;
  return <Info size={14} className="text-[#4ca3ff]" />;
}

function LockStatus({ locked }: { locked: boolean | null }) {
  if (locked === true) {
    return (
      <span className="inline-flex items-center gap-1 text-[#00d4aa]">
        <Lock size={12} /> Locked
      </span>
    );
  }
  if (locked === false) {
    return (
      <span className="inline-flex items-center gap-1 text-[#ff7b5f]">
        <Unlock size={12} /> Unlocked
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[#8888a0]">
      <HelpCircle size={12} /> Unknown
    </span>
  );
}

export function TokenScanner({ network }: { network: SuiNetwork }) {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async () => {
    const trimmed = input.trim();
    if (!trimmed) {
      setError("Enter a coin type, package ID, or token object ID.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const scan = await window.tools.scanToken({
        input: trimmed,
        network,
      });
      setResult(scan);
    } catch (e: any) {
      setError(e.message || "Failed to scan token.");
      setResult(null);
    }
    setLoading(false);
  };

  const riskStyle = result ? RISK_STYLES[result.riskLevel] : null;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-shrink-0 px-6 py-5 border-b border-white/[0.06]">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[280px]">
            <h2 className="text-xl font-bold text-[#f0f0f5] mb-1">Token Scanner</h2>
            <p className="text-sm text-[#8888a0] max-w-2xl">
              Analyze a Sui token for mint authority, upgradeability, metadata quality,
              and DEX liquidity. Paste a coin type, package ID, or token object ID.
            </p>
          </div>
          <div className="text-[12px] px-3 py-1.5 rounded-full border border-[#4ca3ff]/25 text-[#4ca3ff] bg-[#4ca3ff]/10">
            {SUI_NETWORKS[network].label}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-4">
          <div className="relative flex-1 min-w-[320px] max-w-xl">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8888a0]"
            />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleScan()}
              placeholder="0x...::module::COIN or package / object ID"
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#1e1e1e] border border-[#2a2a3c] text-sm font-mono outline-none focus:border-[#4ca3ff]/40"
            />
          </div>
          <button
            onClick={handleScan}
            disabled={loading}
            className="h-11 px-5 rounded-xl bg-[#4ca3ff] text-white text-sm font-medium cursor-pointer disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <ShieldAlert size={15} />
            )}
            Scan token
          </button>
        </div>

        {error && (
          <div className="mt-3 px-4 py-2.5 rounded-xl border border-[#ff4d6d]/25 bg-[#ff4d6d]/10 text-[13px] text-[#ff4d6d]">
            {error}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
        {!result ? (
          <div className="h-full min-h-[320px] flex flex-col items-center justify-center text-center px-8">
            <ShieldAlert size={42} className="text-[#2a2a3c] mb-4" />
            <p className="text-[15px] font-medium text-[#f0f0f5] mb-2">
              No scan results yet
            </p>
            <p className="text-[13px] text-[#8888a0] max-w-md">
              Enter a token contract address and run a scan to see mint risk, package
              status, and liquidity signals.
            </p>
          </div>
        ) : (
          <div className="max-w-5xl space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-4">
              <div className="rounded-2xl border border-[#2a2a3c] bg-[#12121a] p-5">
                <div className="flex items-start gap-4">
                  {result.metadata?.iconUrl ? (
                    <img
                      src={result.metadata.iconUrl}
                      alt={result.metadata.symbol}
                      className="w-14 h-14 rounded-full border border-[#2a2a3c] bg-[#1e1e1e] object-cover"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full border border-[#2a2a3c] bg-[#1e1e1e] flex items-center justify-center text-[#55556a] text-lg font-bold">
                      {(result.metadata?.symbol ?? "?").slice(0, 2)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xl font-semibold text-[#f0f0f5]">
                      {result.metadata?.name ?? "Unknown token"}
                    </h3>
                    <p className="text-sm text-[#8888a0] mt-0.5">
                      {result.metadata?.symbol ?? "—"} ·{" "}
                      {result.metadata?.decimals ?? "?"} decimals
                    </p>
                    <p className="text-[11px] font-mono text-[#55556a] mt-2 break-all">
                      {result.coinType}
                    </p>
                    {result.metadata?.description && (
                      <p className="text-[12px] text-[#8888a0] mt-3 leading-relaxed">
                        {result.metadata.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div
                className="rounded-2xl border p-5"
                style={{
                  borderColor: riskStyle?.border,
                  backgroundColor: riskStyle?.bg,
                }}
              >
                <p className="text-[11px] uppercase tracking-[1.2px] text-[#8888a0] mb-2">
                  Risk score
                </p>
                <div className="flex items-end gap-3">
                  <span
                    className="text-4xl font-bold leading-none"
                    style={{ color: riskStyle?.color }}
                  >
                    {result.riskScore}
                  </span>
                  <span className="text-sm font-medium text-[#f0f0f5] mb-1">
                    / 100
                  </span>
                </div>
                <p
                  className="text-sm font-semibold mt-2"
                  style={{ color: riskStyle?.color }}
                >
                  {riskStyle?.label}
                </p>
                <div className="mt-4 h-2 rounded-full bg-[#1e1e1e] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${result.riskScore}%`,
                      backgroundColor: riskStyle?.color,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-[#2a2a3c] bg-[#12121a] p-4">
                <p className="text-[10px] uppercase tracking-wide text-[#55556a] mb-2">
                  Total supply
                </p>
                <p className="text-lg font-semibold text-[#f0f0f5]">
                  {result.supply?.formatted ?? "Unknown"}
                </p>
              </div>
              <div className="rounded-2xl border border-[#2a2a3c] bg-[#12121a] p-4">
                <p className="text-[10px] uppercase tracking-wide text-[#55556a] mb-2">
                  Mint authority
                </p>
                <p className="text-lg font-semibold text-[#f0f0f5]">
                  {result.treasuryCap.exists ? "Active" : "Not found"}
                </p>
                {result.treasuryCap.ownerType && (
                  <p className="text-[11px] text-[#8888a0] mt-1">
                    Owner: {result.treasuryCap.ownerType}
                  </p>
                )}
              </div>
              <div className="rounded-2xl border border-[#2a2a3c] bg-[#12121a] p-4">
                <p className="text-[10px] uppercase tracking-wide text-[#55556a] mb-2">
                  Package
                </p>
                <p className="text-lg font-semibold text-[#f0f0f5]">
                  {result.packageInfo?.immutable
                    ? "Immutable"
                    : result.packageInfo?.upgradeCapHeld
                      ? "Upgradeable"
                      : "Unknown"}
                </p>
                <p className="text-[11px] font-mono text-[#8888a0] mt-1 break-all">
                  {shortType(result.packageId)}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-[#2a2a3c] bg-[#12121a] p-5">
              <div className="flex items-center gap-2 mb-4">
                <Droplets size={16} className="text-[#4ca3ff]" />
                <h4 className="text-[15px] font-semibold text-[#f0f0f5]">
                  Liquidity pools
                </h4>
              </div>

              {!result.liquidity.checked ? (
                <p className="text-[13px] text-[#8888a0]">
                  DEX route scanning is only available on mainnet.
                </p>
              ) : result.liquidity.pools.length === 0 ? (
                <p className="text-[13px] text-[#8888a0]">
                  No swap routes to SUI were found for this token.
                </p>
              ) : (
                <div className="space-y-3">
                  {result.liquidity.pools.map((pool) => (
                    <div
                      key={`${pool.dex}:${pool.poolId}`}
                      className="rounded-xl border border-[#2a2a3c] bg-[#1e1e1e] px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-[13px] font-medium text-[#f0f0f5]">
                            {pool.dex}
                          </p>
                          <p className="text-[12px] text-[#8888a0]">{pool.pair}</p>
                        </div>
                        <LockStatus locked={pool.locked} />
                      </div>
                      <p className="text-[10px] font-mono text-[#55556a] mt-2 break-all">
                        {pool.poolId}
                      </p>
                      <p className="text-[11px] text-[#8888a0] mt-1">
                        {pool.lockDetail}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-[#2a2a3c] bg-[#12121a] p-5">
              <h4 className="text-[15px] font-semibold text-[#f0f0f5] mb-4">
                Risk signals
              </h4>
              <div className="space-y-3">
                {result.signals.map((signal) => (
                  <div
                    key={signal.id}
                    className="flex gap-3 rounded-xl border border-[#2a2a3c] bg-[#1e1e1e] px-4 py-3"
                  >
                    <div className="mt-0.5">
                      <SignalIcon severity={signal.severity} />
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-[#f0f0f5]">
                        {signal.title}
                      </p>
                      <p className="text-[12px] text-[#8888a0] mt-1 leading-relaxed">
                        {signal.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-[#55556a] leading-relaxed pb-4">
              This scan uses on-chain metadata, TreasuryCap ownership, package upgrade
              status, and aggregated DEX routes. It is not financial advice — always
              verify LP lock/burn status manually before trading.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}