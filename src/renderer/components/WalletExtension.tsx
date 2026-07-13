import { useState } from "react";
import { useWallet } from "./Walletcontext";
import { NetworkSwitcher } from "./NetworkSwitcher";
import { SUI_NETWORKS } from "../types/network";
import type { Transaction, WalletInfo } from "../types/wallet";
import {
  Gem,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowUpDown,
  Repeat2,
  CircleDollarSign,
  Loader2,
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  Trash2,
  Settings as SettingsIcon,
  X,
  ChevronRight,
  AlertTriangle,
  Zap,
  Fuel,
  Sparkles,
  Import as ImportIcon,
  LayoutGrid,
  Receipt,
  Info,
} from "lucide-react";

interface WalletExtensionProps {
  onClose: () => void;
}

type Tab = "dashboard" | "send" | "receive" | "swap" | "settings";
type SetupTab = "new" | "import";

const ASSETS = ["USDC", "SUI", "USDsui"];
const GASLESS = ["USDC", "USDsui"];
const SWAP_ASSETS = [
  "USDC",
  "SUI",
  "USDsui",
  "wBTC",
  "ETH",
  "CETUS",
  "DEEP",
  "WAL",
];

const TX_ICONS: Record<
  string,
  { Icon: typeof ArrowUpRight; color: string; bg: string }
> = {
  send: { Icon: ArrowUpRight, color: "text-[#4ca3ff]", bg: "bg-[#4ca3ff]/10" },
  receive: {
    Icon: ArrowDownLeft,
    color: "text-green-400",
    bg: "bg-green-500/10",
  },
  swap: { Icon: Repeat2, color: "text-amber-400", bg: "bg-amber-500/10" },
  pay: {
    Icon: CircleDollarSign,
    color: "text-violet-400",
    bg: "bg-violet-400/10",
  },
};

function shortAddr(addr: string) {
  if (!addr) return "";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

function formatDate(ts?: number | string) {
  if (!ts) return "";
  return new Date(Number(ts)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function QRCode({ value, size = 140 }: { value: string; size?: number }) {
  const src = value
    ? `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&bgcolor=ffffff&color=000000&margin=0`
    : null;
  if (!src)
    return (
      <div
        style={{ width: size, height: size }}
        className="bg-neutral-800 rounded-lg"
      />
    );
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt="QR code"
      className="rounded-lg block"
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  );
}

// ─── Sub-views ────────────────────────────────────────────────────────────────

function Dashboard({ setTab }: { setTab: (t: Tab) => void }) {
  const {
    balance,
    transactions,
    refreshing,
    lastUpdated,
    refresh,
    network,
    walletInfo,
  } = useWallet();
  const [faucetLoading, setFaucetLoading] = useState(false);
  const [faucetMessage, setFaucetMessage] = useState<string | null>(null);
  const raw = balance as any;

  const usdc =
    raw?.stables?.USDC != null ? Number(raw.stables.USDC).toFixed(2) : "—";
  const usdSui =
    raw?.stables?.USDsui != null ? Number(raw.stables.USDsui).toFixed(2) : null;
  const sui =
    raw?.gasReserve?.sui != null ? Number(raw.gasReserve.sui).toFixed(4) : "—";
  const total = raw?.total != null ? `$${Number(raw.total).toFixed(2)}` : "—";

  const rows = [
    { val: usdc, label: "USDC" },
    ...(usdSui ? [{ val: usdSui, label: "USDsui" }] : []),
    { val: sui, label: "SUI" },
    { val: total, label: "Total" },
  ];

  const networkLabel = SUI_NETWORKS[network].label;
  const networkConfig = SUI_NETWORKS[network];

  async function handleRequestFaucet() {
    if (
      !walletInfo?.address ||
      !networkConfig.faucet ||
      network === "mainnet" ||
      faucetLoading
    ) {
      return;
    }

    const {
      checkFaucetThrottle,
      faucetDebounceMessage,
      formatFaucetRateLimitMessage,
      isFaucetRateLimitError,
      markFaucetRequested,
    } = await import("../../helper/faucet-throttle");

    const throttle = checkFaucetThrottle();
    if (!throttle.allowed && throttle.waitSeconds) {
      setFaucetMessage(
        faucetDebounceMessage(throttle.waitSeconds, networkLabel),
      );
      return;
    }

    setFaucetLoading(true);
    setFaucetMessage(null);
    markFaucetRequested();

    if (network === "localnet") {
      const result = await window.playground.requestLocalFaucet(
        walletInfo.address,
      );
      setFaucetLoading(false);
      setFaucetMessage(result.message);
      refresh();
      return;
    }

    const result = await window.sui.requestFaucet({
      network,
      recipient: walletInfo.address,
    });
    setFaucetLoading(false);
    if (result.success) {
      setFaucetMessage(
        `Received ${result.amountSui?.toFixed(2) ?? "some"} SUI from the faucet.`,
      );
      refresh();
    } else {
      const error = result.error || "Faucet request failed.";
      if (isFaucetRateLimitError(error)) {
        setFaucetMessage(formatFaucetRateLimitMessage(networkLabel));
      } else {
        setFaucetMessage(error);
      }
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {network !== "mainnet" && (
        <div
          className="flex items-start gap-2 px-2.5 py-2 rounded-xl text-[11px] border"
          style={{
            color: networkConfig.accent,
            borderColor: `${networkConfig.accent}33`,
            background: `${networkConfig.accent}14`,
          }}
        >
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            You are on {networkLabel}. Send and swap are only available on
            Mainnet.
            {networkConfig.faucet
              ? " Request test SUI below or from the Playground faucet."
              : ""}
          </span>
        </div>
      )}

      {networkConfig.faucet && (
        <div className="flex flex-col gap-2">
          <button
            onClick={handleRequestFaucet}
            disabled={faucetLoading || !walletInfo?.address}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border font-semibold text-xs cursor-pointer disabled:opacity-60 transition-colors"
            style={{
              color: networkConfig.accent,
              borderColor: `${networkConfig.accent}40`,
              background: `${networkConfig.accent}14`,
            }}
          >
            {faucetLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Requesting...
              </>
            ) : (
              <>
                <CircleDollarSign className="w-3.5 h-3.5" /> Request SUI (
                {networkLabel})
              </>
            )}
          </button>
          {faucetMessage && (
            <div className="px-2.5 py-2 bg-white/[0.04] border border-white/[0.06] rounded-lg text-[10px] text-neutral-400">
              {faucetMessage}
            </div>
          )}
        </div>
      )}

      {/* Balance */}
      <div className="relative bg-[#0f0f1a] rounded-xl p-3 border border-white/[0.06]">
        <button
          onClick={refresh}
          className="absolute top-2 right-2 bg-transparent border-none text-neutral-600 hover:text-neutral-300 cursor-pointer transition-colors"
          title="Refresh"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
          />
        </button>
        <div className="text-[10px] font-semibold text-neutral-600 uppercase tracking-widest mb-2">
          Balance
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {rows.map((r) => (
            <div
              key={r.label}
              className="bg-white/[0.04] rounded-lg py-2 px-2 text-center"
            >
              <div className="text-sm font-bold text-neutral-100">{r.val}</div>
              <div className="text-[10px] text-neutral-500 mt-0.5">
                {r.label}
              </div>
            </div>
          ))}
        </div>
        {lastUpdated && (
          <div className="text-[9px] text-neutral-700 mt-2 text-right">
            Updated:{" "}
            {lastUpdated.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-3 gap-1.5">
        <button
          onClick={() => setTab("send")}
          className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-[#14141f] border border-[#4ca3ff]/15 text-[#4ca3ff] cursor-pointer hover:bg-[#4ca3ff]/10 active:scale-[0.97] transition-all"
        >
          <ArrowUpRight className="w-4 h-4" />
          <span className="text-[10px] font-semibold">Send</span>
        </button>
        <button
          onClick={() => setTab("receive")}
          className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-[#14141f] border border-green-500/15 text-green-400 cursor-pointer hover:bg-green-500/10 active:scale-[0.97] transition-all"
        >
          <ArrowDownLeft className="w-4 h-4" />
          <span className="text-[10px] font-semibold">Receive</span>
        </button>
        <button
          onClick={() => setTab("swap")}
          className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-[#14141f] border border-amber-500/15 text-amber-400 cursor-pointer hover:bg-amber-500/10 active:scale-[0.97] transition-all"
        >
          <Repeat2 className="w-4 h-4" />
          <span className="text-[10px] font-semibold">Swap</span>
        </button>
      </div>

      {/* Transactions */}
      <div className="flex flex-col gap-1.5">
        <div className="text-[10px] font-semibold text-neutral-600 uppercase tracking-widest">
          Transactions
        </div>
        {transactions.length === 0 ? (
          <div className="flex items-center justify-center gap-1.5 py-5 text-center text-neutral-600 text-xs bg-[#14141f] rounded-xl border border-white/[0.06]">
            {refreshing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...
              </>
            ) : (
              "No transactions yet"
            )}
          </div>
        ) : (
          transactions.map((tx, i) => {
            const type = tx.type || "send";
            const { Icon, color, bg } = TX_ICONS[type] || TX_ICONS.send;
            return (
              <div
                key={tx.digest || i}
                className="flex items-center gap-2.5 bg-[#14141f] border border-white/[0.06] rounded-xl px-3 py-2.5"
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${bg} ${color}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-mono text-neutral-400 overflow-hidden text-ellipsis whitespace-nowrap">
                    {shortAddr(tx.digest || "")}
                  </div>
                  <div className="text-[10px] text-neutral-600 mt-0.5">
                    {formatDate(tx.timestamp)} · {tx.type || "transaction"}
                  </div>
                </div>
                {tx.amount != null && (
                  <div
                    className={`text-[11px] font-semibold flex-shrink-0 ${color}`}
                  >
                    {tx.amount > 0 ? "+" : ""}
                    {tx.amount} {tx.asset || "SUI"}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function Send({ onDone }: { onDone: () => void }) {
  const { balance, refresh, network } = useWallet();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [asset, setAsset] = useState("USDC");
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState<any>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const raw = balance as any;

  const isGasless = GASLESS.includes(asset);

  function getAvailable(a: string): number | null {
    if (!raw) return null;
    if (a === "USDC") return raw?.stables?.USDC ?? null;
    if (a === "USDsui") return raw?.stables?.USDsui ?? null;
    if (a === "SUI") return raw?.gasReserve?.sui ?? null;
    return null;
  }

  const available = getAvailable(asset);

  if (network !== "mainnet") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <AlertTriangle className="w-8 h-8 text-[#ffb347]" />
        <p className="text-sm text-neutral-300 font-medium">Mainnet only</p>
        <p className="text-[11px] text-neutral-500 leading-relaxed px-2">
          Sending assets is only supported on Mainnet. Switch network in the
          wallet header or request test SUI from the faucet.
        </p>
        <button
          onClick={onDone}
          className="mt-1 px-4 py-2 rounded-xl border border-white/[0.08] text-xs text-neutral-300 cursor-pointer bg-transparent hover:bg-white/5"
        >
          Back to wallet
        </button>
      </div>
    );
  }

  async function resolveRecipient(val: string) {
    setResolved(null);
    if (!val || val.startsWith("0x")) return;
    setResolving(true);
    const res = await window.sui.resolveRecipient(val);
    setResolving(false);
    if (res?.success) setResolved(res.resolved);
  }

  async function handleSend() {
    setError("");
    const num = parseFloat(amount);
    if (!to.trim()) return setError("Please enter a recipient address");
    if (!num || num <= 0) return setError("Please enter an amount");
    if (available != null && num > available)
      return setError(`Insufficient ${asset} balance`);
    setLoading(true);
    const result = await window.sui.send({ to: to.trim(), amount, asset });
    setLoading(false);
    if (result.success) {
      setSuccess(result.digest);
      refresh();
    } else {
      setError(result.error || "Transaction failed");
    }
  }

  if (success)
    return (
      <div className="flex flex-col items-center text-center gap-3 p-5 bg-green-500/10 border border-green-500/20 rounded-xl">
        <CheckCircle2 className="w-9 h-9 text-green-400" />
        <div className="font-bold text-sm text-neutral-100">Sent!</div>
        <div className="text-[10px] font-mono text-neutral-500 break-all">
          {success}
        </div>
        <button
          onClick={onDone}
          className="mt-1 px-5 py-2 rounded-xl border border-white/[0.06] bg-[#0f0f1a] text-neutral-200 font-semibold text-xs cursor-pointer hover:bg-white/5 transition-colors"
        >
          Back
        </button>
      </div>
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5">
        {ASSETS.map((a) => (
          <button
            key={a}
            onClick={() => {
              setAsset(a);
              setError("");
            }}
            className={`flex-1 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-colors
              ${
                asset === a
                  ? "bg-[#4ca3ff]/15 border-[#4ca3ff]/35 text-[#4ca3ff]"
                  : "bg-[#14141f] border-white/[0.06] text-neutral-400 hover:text-neutral-200"
              }`}
          >
            {a}
          </button>
        ))}
      </div>

      <div className="bg-[#14141f] border border-white/[0.06] rounded-xl p-3 flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-1">
            Recipient
            {resolving && (
              <Loader2 className="w-2.5 h-2.5 animate-spin text-neutral-600" />
            )}
          </label>
          <input
            className="w-full px-3 py-2 bg-[#0f0f1a] border border-white/[0.06] rounded-lg text-neutral-100 text-xs font-mono outline-none placeholder:text-neutral-600 focus:border-[#4ca3ff]/40 transition-colors"
            placeholder="0x... or alice.sui"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              resolveRecipient(e.target.value);
            }}
          />
          {resolved && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-green-500/10 border border-green-500/20 rounded-lg text-[11px] font-mono text-green-400">
              <Check className="w-3 h-3 flex-shrink-0" />
              {resolved.suinsName || shortAddr(resolved.address)} →{" "}
              {resolved.address?.slice(0, 8)}...
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
            Amount
            {available != null && (
              <span className="ml-1.5 text-neutral-600 normal-case font-normal">
                · max:{" "}
                <span className="text-neutral-400">
                  {Number(available).toFixed(asset === "SUI" ? 4 : 2)} {asset}
                </span>
              </span>
            )}
          </label>
          <div className="flex gap-2">
            <input
              className="flex-1 px-3 py-2 bg-[#0f0f1a] border border-white/[0.06] rounded-lg text-neutral-100 text-sm outline-none placeholder:text-neutral-600 focus:border-[#4ca3ff]/40 transition-colors"
              placeholder="0.00"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {available != null && Number(available) > 0 && (
              <button
                onClick={() => setAmount(String(available))}
                className="px-2.5 py-2 bg-[#4ca3ff]/10 border border-[#4ca3ff]/25 rounded-lg text-[#4ca3ff] text-[10px] font-semibold cursor-pointer hover:bg-[#4ca3ff]/20 transition-colors"
              >
                MAX
              </button>
            )}
          </div>
        </div>

        {isGasless ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-green-500/10 border border-green-500/20 rounded-lg text-[11px] text-green-400">
            <Zap className="w-3 h-3 flex-shrink-0" /> Gasless transaction
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[11px] text-amber-400">
            <Fuel className="w-3 h-3 flex-shrink-0" /> ~0.002 SUI gas fee
          </div>
        )}

        {error && (
          <div className="px-2.5 py-2 bg-red-500/10 border border-red-500/25 rounded-lg text-xs text-red-400">
            {error}
          </div>
        )}

        <button
          onClick={handleSend}
          disabled={loading}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-[#4ca3ff] to-[#1a6fff] text-white font-bold text-xs cursor-pointer border-none disabled:opacity-60 hover:brightness-110 active:scale-[0.98] transition-all"
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...
            </>
          ) : (
            <>
              <ArrowUpRight className="w-3.5 h-3.5" /> Send {asset}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function Receive() {
  const { walletInfo, network } = useWallet();
  const [copied, setCopied] = useState(false);
  const address = walletInfo?.address ?? "";

  async function copyAddress() {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="bg-white p-2.5 rounded-xl">
        <QRCode value={address} size={140} />
      </div>
      <div className="w-full px-3 py-2.5 bg-[#0f0f1a] border border-white/[0.06] rounded-xl font-mono text-[11px] text-neutral-400 break-all text-center leading-relaxed">
        {address}
      </div>
      <button
        onClick={copyAddress}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-green-500/25 bg-green-500/10 text-green-400 font-semibold text-xs cursor-pointer hover:bg-green-500/15 active:scale-[0.98] transition-all"
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5" /> Copied!
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5" /> Copy address
          </>
        )}
      </button>
      <div className="flex items-center justify-center gap-1.5 text-[11px] text-neutral-600 text-center leading-relaxed">
        <Info className="w-3 h-3 flex-shrink-0" />
        {network === "mainnet"
          ? "Only send Sui Mainnet tokens to this address."
          : `This address is active on ${SUI_NETWORKS[network].label}.`}
      </div>
    </div>
  );
}

function Swap({ onDone }: { onDone: () => void }) {
  const { refresh, network } = useWallet();
  const [from, setFrom] = useState("USDC");
  const [to, setTo] = useState("SUI");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<any>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<any>(null);

  const fromAssets = SWAP_ASSETS.filter((a) => a !== to);
  const toAssets = SWAP_ASSETS.filter((a) => a !== from);

  if (network !== "mainnet") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <AlertTriangle className="w-8 h-8 text-[#ffb347]" />
        <p className="text-sm text-neutral-300 font-medium">Mainnet only</p>
        <p className="text-[11px] text-neutral-500 leading-relaxed px-2">
          Swapping is only supported on Mainnet. Switch network in the wallet
          header to use Send and Swap features.
        </p>
        <button
          onClick={onDone}
          className="mt-1 px-4 py-2 rounded-xl border border-white/[0.08] text-xs text-neutral-300 cursor-pointer bg-transparent hover:bg-white/5"
        >
          Back to wallet
        </button>
      </div>
    );
  }

  async function fetchQuote() {
    if (!amount || parseFloat(amount) <= 0)
      return setError("Please enter an amount");
    setError("");
    setLoadingQuote(true);
    const res = await window.sui.swapQuote({ from, to, amount });
    setLoadingQuote(false);
    if (res.success) setQuote(res.quote);
    else setError(res.error ?? "Unknown error");
  }

  async function handleSwap() {
    if (!amount || parseFloat(amount) <= 0)
      return setError("Please enter an amount");
    setError("");
    setLoading(true);
    const res = await window.sui.swap({ from, to, amount, slippage: 1 });
    setLoading(false);
    if (res.success) {
      setSuccess(res.result);
      refresh();
    } else setError(res.error ?? "Unknown error");
  }

  if (success)
    return (
      <div className="flex flex-col items-center text-center gap-3 p-5 bg-green-500/10 border border-green-500/20 rounded-xl">
        <CheckCircle2 className="w-9 h-9 text-green-400" />
        <div className="font-bold text-sm text-neutral-100">
          Swap successful!
        </div>
        <div className="text-[10px] font-mono text-neutral-500 break-all">
          {success.digest || JSON.stringify(success)}
        </div>
        <button
          onClick={onDone}
          className="mt-1 px-5 py-2 rounded-xl border border-white/[0.06] bg-[#0f0f1a] text-neutral-200 font-semibold text-xs cursor-pointer hover:bg-white/5 transition-colors"
        >
          Back
        </button>
      </div>
    );

  return (
    <div className="bg-[#14141f] border border-white/[0.06] rounded-xl p-3 flex flex-col gap-3">
      <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
        Cetus Aggregator
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-neutral-600">From</label>
        <select
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setQuote(null);
          }}
          className="w-full px-3 py-2 bg-[#0f0f1a] border border-white/[0.06] rounded-lg text-neutral-100 text-xs outline-none cursor-pointer focus:border-[#4ca3ff]/40 transition-colors"
        >
          {fromAssets.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-neutral-600">Amount</label>
        <input
          className="w-full px-3 py-2 bg-[#0f0f1a] border border-white/[0.06] rounded-lg text-neutral-100 text-sm outline-none placeholder:text-neutral-600 focus:border-[#4ca3ff]/40 transition-colors"
          placeholder="0.00"
          type="number"
          min="0"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            setQuote(null);
          }}
        />
      </div>

      <div className="flex justify-center">
        <button
          onClick={() => {
            setFrom(to);
            setTo(from);
            setQuote(null);
            setAmount("");
          }}
          className="w-8 h-8 rounded-full bg-[#0f0f1a] border border-white/[0.06] text-[#4ca3ff] cursor-pointer flex items-center justify-center hover:bg-white/5 active:scale-95 transition-all"
        >
          <ArrowUpDown className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-neutral-600">To</label>
        <select
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setQuote(null);
          }}
          className="w-full px-3 py-2 bg-[#0f0f1a] border border-white/[0.06] rounded-lg text-neutral-100 text-xs outline-none cursor-pointer focus:border-[#4ca3ff]/40 transition-colors"
        >
          {toAssets.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[11px] text-amber-400">
        <Fuel className="w-3 h-3 flex-shrink-0" /> ~0.05 SUI gas fee required
      </div>

      {quote && (
        <div className="p-2.5 bg-[#4ca3ff]/5 border border-[#4ca3ff]/15 rounded-xl flex flex-col gap-1.5">
          {[
            { label: "You receive", val: `${quote.outputAmount} ${to}` },
            { label: "Price impact", val: `${quote.priceImpact ?? "< 0.1"}%` },
            { label: "Slippage", val: "1%" },
          ].map((r) => (
            <div key={r.label} className="flex justify-between text-[11px]">
              <span className="text-neutral-500">{r.label}</span>
              <span className="text-neutral-100 font-semibold">{r.val}</span>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="px-2.5 py-2 bg-red-500/10 border border-red-500/25 rounded-lg text-xs text-red-400">
          {error}
        </div>
      )}

      <button
        onClick={fetchQuote}
        disabled={loadingQuote}
        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-[#4ca3ff]/25 bg-[#4ca3ff]/10 text-[#4ca3ff] font-semibold text-xs cursor-pointer disabled:opacity-60 active:scale-[0.98] transition-all"
      >
        {loadingQuote ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Fetching quote...
          </>
        ) : (
          <>
            <Receipt className="w-3.5 h-3.5" /> Get quote
          </>
        )}
      </button>
      <button
        onClick={handleSwap}
        disabled={loading}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold text-xs cursor-pointer border-none disabled:opacity-60 hover:brightness-110 active:scale-[0.98] transition-all"
      >
        {loading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Swapping...
          </>
        ) : (
          <>
            <Repeat2 className="w-3.5 h-3.5" /> {from} → {to}
          </>
        )}
      </button>
    </div>
  );
}

function Settings() {
  const { walletInfo, logout, network } = useWallet();
  const [modal, setModal] = useState<null | "export" | "delete">(null);
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loadingKey, setLoadingKey] = useState(false);

  async function handleExport() {
    setModal("export");
    setLoadingKey(true);
    const key = await window.sui.exportPrivateKey();
    setLoadingKey(false);
    setPrivateKey(key);
  }

  async function copyKey() {
    if (!privateKey) return;
    await navigator.clipboard.writeText(privateKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-[#14141f] border border-white/[0.06] rounded-xl p-3 flex flex-col gap-2">
        <div className="flex justify-between items-center gap-2">
          <span className="text-[11px] text-neutral-500 flex-shrink-0">
            Network
          </span>
          <NetworkSwitcher />
        </div>
        <div className="h-px bg-white/[0.06]" />
        {[
          { label: "Address", val: walletInfo?.address },
          { label: "Public key", val: walletInfo?.publicKey },
          { label: "Active network", val: SUI_NETWORKS[network].label },
        ]
          .filter((r) => r.val)
          .map((r) => (
            <div
              key={r.label}
              className="flex justify-between items-center gap-2"
            >
              <span className="text-[11px] text-neutral-500 flex-shrink-0">
                {r.label}
              </span>
              <span className="text-[11px] font-mono text-neutral-400 overflow-hidden text-ellipsis whitespace-nowrap max-w-[55%]">
                {r.val}
              </span>
            </div>
          ))}
      </div>

      <div className="bg-[#14141f] border border-white/[0.06] rounded-xl overflow-hidden">
        <button
          onClick={handleExport}
          className="w-full flex items-center gap-3 px-3 py-3 border-b border-white/[0.06] hover:bg-white/5 transition-colors text-left cursor-pointer bg-transparent"
        >
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center flex-shrink-0">
            <KeyRound className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1">
            <div className="text-xs font-medium text-neutral-200">
              Export private key
            </div>
            <div className="text-[10px] text-neutral-600 mt-0.5">
              Save it in a secure location
            </div>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-neutral-600" />
        </button>
        <button
          onClick={() => setModal("delete")}
          className="w-full flex items-center gap-3 px-3 py-3 hover:bg-white/5 transition-colors text-left cursor-pointer bg-transparent"
        >
          <div className="w-7 h-7 rounded-lg bg-red-500/15 text-red-400 flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1">
            <div className="text-xs font-medium text-red-400">
              Delete wallet
            </div>
            <div className="text-[10px] text-neutral-600 mt-0.5">
              The key will be permanently removed
            </div>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-neutral-600" />
        </button>
      </div>

      {modal === "export" && (
        <div className="bg-[#14141f] border border-amber-500/20 rounded-xl p-3 flex flex-col gap-3">
          <div className="flex items-center gap-1.5 text-sm font-bold text-neutral-100">
            <KeyRound className="w-4 h-4 text-amber-400" /> Private key
          </div>
          <div className="flex items-start gap-1.5 px-2.5 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[11px] text-amber-400 leading-relaxed">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            Never share this with anyone.
          </div>
          {loadingKey ? (
            <div className="flex items-center justify-center gap-1.5 py-4 text-neutral-500 text-xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...
            </div>
          ) : (
            <div className="px-2.5 py-2.5 bg-[#0f0f1a] border border-amber-500/20 rounded-xl font-mono text-[11px] text-amber-300 break-all leading-relaxed">
              {privateKey}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setModal(null)}
              className="flex-1 py-2 rounded-xl border border-white/[0.06] bg-[#0f0f1a] text-neutral-200 font-semibold text-xs cursor-pointer hover:bg-white/5 transition-colors"
            >
              Close
            </button>
            <button
              onClick={copyKey}
              disabled={!privateKey}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-[#4ca3ff]/25 bg-[#4ca3ff]/10 text-[#4ca3ff] font-semibold text-xs cursor-pointer disabled:opacity-50 hover:bg-[#4ca3ff]/20 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" /> Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Copy
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {modal === "delete" && (
        <div className="bg-[#14141f] border border-red-500/20 rounded-xl p-3 flex flex-col gap-3">
          <div className="flex items-center gap-1.5 text-sm font-bold text-neutral-100">
            <Trash2 className="w-4 h-4 text-red-400" /> Delete wallet
          </div>
          <div className="text-xs text-neutral-400 leading-relaxed">
            The private key will be permanently removed. If you have no backup,
            you will lose access to this wallet.
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setModal(null)}
              className="flex-1 py-2 rounded-xl border border-white/[0.06] bg-[#0f0f1a] text-neutral-200 font-semibold text-xs cursor-pointer hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={logout}
              className="flex-1 py-2 rounded-xl border border-red-500/25 bg-red-500/10 text-red-400 font-semibold text-xs cursor-pointer hover:bg-red-500/20 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Setup ────────────────────────────────────────────────────────────────────

function Setup() {
  const { setWalletInfo } = useWallet();
  const [tab, setTab] = useState<SetupTab>("new");
  const [privateKeyInput, setPrivateKeyInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    setLoading(true);
    setError("");
    const result = await window.sui.generateWallet();
    setLoading(false);
    if (result.success)
      setWalletInfo({ address: result.address, publicKey: result.publicKey });
    else setError(result.error ?? "Unknown error");
  }

  async function handleImport() {
    if (!privateKeyInput.trim())
      return setError("Please enter your private key");
    setLoading(true);
    setError("");
    const result = await window.sui.importWallet(privateKeyInput.trim());
    setLoading(false);
    if (result.success)
      setWalletInfo({ address: result.address, publicKey: result.publicKey });
    else setError("Invalid private key");
  }

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <div className="text-xs text-neutral-500 text-center leading-relaxed mb-5 mt-5">
        Create a new wallet or import one using your private key.
      </div>
      <div className="flex w-full rounded-lg overflow-hidden border border-white/[0.08]">
        {(["new", "import"] as SetupTab[]).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setError("");
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium border-none cursor-pointer transition-colors
              ${tab === t ? "bg-[#4ca3ff]/12 text-[#4ca3ff]" : "bg-transparent text-neutral-500 hover:text-neutral-300"}`}
          >
            {t === "new" ? (
              <>
                <Sparkles className="w-3.5 h-3.5" /> New wallet
              </>
            ) : (
              <>
                <ImportIcon className="w-3.5 h-3.5" /> Import
              </>
            )}
          </button>
        ))}
      </div>
      {tab === "import" && (
        <textarea
          className="w-full min-h-[64px] p-2.5 bg-[#0f0f1a] border border-white/[0.06] rounded-xl text-neutral-100 text-xs font-mono outline-none resize-none placeholder:text-neutral-600 focus:border-[#4ca3ff]/40 transition-colors"
          placeholder="suiprivkey... or hex private key"
          value={privateKeyInput}
          onChange={(e) => setPrivateKeyInput(e.target.value)}
        />
      )}
      {error && (
        <div className="w-full px-3 py-2 bg-red-500/10 border border-red-500/25 rounded-xl text-xs text-red-400">
          {error}
        </div>
      )}
      <button
        onClick={tab === "new" ? handleGenerate : handleImport}
        disabled={loading || (tab === "import" && !privateKeyInput)}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-[#4ca3ff] to-[#1a6fff] text-white font-semibold text-xs cursor-pointer border-none disabled:opacity-60 hover:brightness-110 active:scale-[0.98] transition-all"
      >
        {loading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing...
          </>
        ) : tab === "new" ? (
          <>
            <Sparkles className="w-3.5 h-3.5" /> Generate wallet
          </>
        ) : (
          <>
            <ImportIcon className="w-3.5 h-3.5" /> Import wallet
          </>
        )}
      </button>
    </div>
  );
}

// ─── Address bar ──────────────────────────────────────────────────────────────

function AddressBar() {
  const { walletInfo } = useWallet();
  const [copied, setCopied] = useState(false);
  const address = walletInfo?.address ?? "";

  async function copy() {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.04] rounded-xl">
      <span className="flex-1 text-[11px] font-mono text-neutral-500 overflow-hidden text-ellipsis whitespace-nowrap">
        {address}
      </span>
      <button
        onClick={copy}
        className="bg-transparent border-none text-neutral-600 hover:text-neutral-300 cursor-pointer transition-colors"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

const NAV: { id: Tab; Icon: typeof ArrowUpRight; label: string }[] = [
  { id: "dashboard", Icon: LayoutGrid, label: "Wallet" },
  { id: "send", Icon: ArrowUpRight, label: "Send" },
  { id: "swap", Icon: Repeat2, label: "Swap" },
  { id: "receive", Icon: ArrowDownLeft, label: "Receive" },
  { id: "settings", Icon: SettingsIcon, label: "Settings" },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function WalletExtension({ onClose }: WalletExtensionProps) {
  const { walletInfo, loading } = useWallet();
  const [tab, setTab] = useState<Tab>("dashboard");

  return (
    <div
      data-wallet-extension
      className="w-72 bg-[#0f0f1a] border border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden ring-1 ring-white/[0.03]"
      style={{ maxHeight: "520px" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.06] flex-shrink-0">
        <span className="text-sm font-semibold text-neutral-100 flex-1">
          Beluga Wallet
        </span>
        {walletInfo && <NetworkSwitcher compact placement="top" />}
        <button
          onClick={onClose}
          className="bg-transparent border-none text-neutral-600 hover:text-neutral-300 cursor-pointer ml-1 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-neutral-600">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : !walletInfo ? (
          <Setup />
        ) : (
          <>
            <AddressBar />
            <div className="mt-3">
              {tab === "dashboard" && <Dashboard setTab={setTab} />}
              {tab === "send" && <Send onDone={() => setTab("dashboard")} />}
              {tab === "receive" && <Receive />}
              {tab === "swap" && <Swap onDone={() => setTab("dashboard")} />}
              {tab === "settings" && <Settings />}
            </div>
          </>
        )}
      </div>

      {/* Bottom nav */}
      {walletInfo && (
        <nav className="flex border-t border-white/[0.06] flex-shrink-0">
          {NAV.map(({ id, Icon, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 bg-transparent border-none cursor-pointer transition-colors text-[9px] font-medium
                ${tab === id ? "text-[#4ca3ff]" : "text-neutral-600 hover:text-neutral-400"}`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
