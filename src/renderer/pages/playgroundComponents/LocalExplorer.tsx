import { useCallback, useEffect, useState } from "react";
import {
  X,
  RefreshCw,
  Loader2,
  Search,
  Copy,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  List,
  Wallet,
} from "lucide-react";
import { LocalExplorerWallets } from "./LocalExplorerWallets";

type LocalTx = Awaited<
  ReturnType<typeof window.playground.getLocalRecentTransactions>
>[number];
type TxDetail = Awaited<
  ReturnType<typeof window.playground.getLocalTransactionDetail>
>;
type Overview = Awaited<
  ReturnType<typeof window.playground.getLocalNetworkOverview>
>;

const CHANGE_COLORS: Record<string, string> = {
  created: "#00d4aa",
  mutated: "#4ca3ff",
  deleted: "#ff4d6d",
  published: "#c4c0ff",
  transferred: "#7dd3fc",
};

export function formatTime(timestampMs: string | null) {
  if (!timestampMs) return "—";
  const date = new Date(Number(timestampMs));
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function short(value: string, head = 10, tail = 8) {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

function formatSui(mist: string | null) {
  if (!mist) return "—";
  const n = Number(mist);
  if (Number.isNaN(n)) return mist;
  return `${(n / 1_000_000_000).toFixed(4)} SUI`;
}

type LocalEvent = TxDetail["events"][number];

function eventStructName(fullType: string): string {
  const parts = fullType.split("::");
  return parts[parts.length - 1] ?? fullType;
}

function formatEventJson(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function EventCard({ event, index }: { event: LocalEvent; index: number }) {
  const payload = formatEventJson(event.parsedJson);
  const structName = eventStructName(event.type || `${event.module}::Event`);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#12121a] p-3">
      <div className="flex items-start gap-2 mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md text-[#c4c0ff] bg-[#c4c0ff]/15 border border-[#c4c0ff]/25">
          #{index + 1} {structName}
        </span>
        {event.eventSeq && (
          <span className="text-[10px] font-mono text-[#55556a]">
            seq {event.eventSeq}
          </span>
        )}
      </div>

      <div className="flex items-start gap-2 mb-2">
        <p className="flex-1 text-[12px] font-mono text-[#c7c7d8] break-all leading-relaxed">
          {event.type || `${event.packageId}::${event.module}`}
        </p>
        {event.type && <CopyBtn value={event.type} />}
      </div>

      {event.sender && (
        <div className="flex items-start gap-2 mb-2 rounded-lg bg-[#0d0d14] px-2.5 py-2">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-[#666680] mb-0.5">Sender</p>
            <p className="text-[11px] font-mono text-[#a8b0c8] break-all">
              {event.sender}
            </p>
          </div>
          <CopyBtn value={event.sender} />
        </div>
      )}

      {payload ? (
        <div className="rounded-lg border border-white/[0.04] bg-[#0d0d14] overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-b border-white/[0.04]">
            <span className="text-[10px] font-medium uppercase tracking-wide text-[#666680]">
              Event data
            </span>
            <CopyBtn value={payload} />
          </div>
          <pre className="text-[11px] font-mono text-[#a8b0c8] px-2.5 py-2 m-0 overflow-x-auto whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
            {payload}
          </pre>
        </div>
      ) : (
        <p className="text-[11px] text-[#55556a] italic">
          No parsed event payload returned by RPC.
        </p>
      )}
    </div>
  );
}

export function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }}
      className="h-6 w-6 flex items-center justify-center rounded-md text-[#55556a] hover:text-[#f0f0f5] hover:bg-white/[0.06] cursor-pointer"
      title="Copy"
    >
      {copied ? (
        <CheckCircle2 size={12} className="text-[#00d4aa]" />
      ) : (
        <Copy size={12} />
      )}
    </button>
  );
}

export function MetaRow({
  label,
  value,
  mono = true,
  copyValue,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyValue?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-white/[0.04] last:border-0">
      <span className="text-[12px] text-[#8888a0] flex-shrink-0">{label}</span>
      <div className="flex items-start gap-1 min-w-0">
        <span
          className={`text-[12px] text-[#e8e8f0] text-right break-all ${mono ? "font-mono" : ""}`}
          title={copyValue}
        >
          {value}
        </span>
        {copyValue && <CopyBtn value={copyValue} />}
      </div>
    </div>
  );
}

export function TxDetailView({
  detail,
  loading,
}: {
  detail: TxDetail | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#8888a0] gap-2">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-[13px]">Loading transaction…</span>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#55556a] text-[13px] px-8 text-center leading-relaxed">
        Select a transaction from the list to view sender, gas, object changes,
        and events.
      </div>
    );
  }

  const success = detail.status === "success";

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="p-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 mb-3">
          <span
            className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${
              success
                ? "bg-[#00d4aa]/15 text-[#00d4aa] border border-[#00d4aa]/25"
                : "bg-[#ff4d6d]/15 text-[#ff4d6d] border border-[#ff4d6d]/25"
            }`}
          >
            {success ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
            {detail.status ?? "unknown"}
          </span>
          {detail.checkpoint && (
            <span className="text-[11px] text-[#55556a] font-mono">
              checkpoint #{detail.checkpoint}
            </span>
          )}
        </div>

        <div className="flex items-start gap-2 mb-4">
          <p className="flex-1 text-[13px] font-mono text-[#c7c7d8] break-all leading-relaxed">
            {detail.digest}
          </p>
          <CopyBtn value={detail.digest} />
        </div>

        <div className="rounded-xl bg-[#12121a] border border-white/[0.06] px-4">
          <MetaRow
            label="Sender"
            value={detail.sender ? short(detail.sender, 12, 10) : "—"}
            copyValue={detail.sender ?? undefined}
          />
          <MetaRow label="Timestamp" value={formatTime(detail.timestampMs)} mono={false} />
          <MetaRow label="Gas used" value={formatSui(detail.gasUsed)} />
          <MetaRow
            label="Computation"
            value={detail.computationCost ? formatSui(detail.computationCost) : "—"}
          />
          <MetaRow
            label="Storage cost"
            value={detail.storageCost ? formatSui(detail.storageCost) : "—"}
          />
        </div>

        {detail.error && (
          <p className="mt-3 text-[12px] text-[#ff4d6d] bg-[#ff4d6d]/10 border border-[#ff4d6d]/20 rounded-lg px-3 py-2">
            {detail.error}
          </p>
        )}
      </div>

      {detail.objectChanges.length > 0 && (
        <div className="p-5 border-b border-white/[0.06]">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#8888a0] mb-3">
            Object changes
          </h3>
          <div className="space-y-2">
            {detail.objectChanges.map((change, i) => {
              const color = CHANGE_COLORS[change.type] ?? "#8888a0";
              return (
                <div
                  key={`${change.type}-${change.objectId ?? i}`}
                  className="rounded-xl border border-white/[0.06] bg-[#12121a] p-3"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md"
                      style={{
                        color,
                        background: `${color}18`,
                        border: `1px solid ${color}30`,
                      }}
                    >
                      {change.type}
                    </span>
                    {change.packageId && (
                      <span className="text-[10px] font-mono text-[#55556a] truncate">
                        pkg {short(change.packageId, 8, 6)}
                      </span>
                    )}
                  </div>
                  {change.objectId && (
                    <div className="flex items-start gap-2">
                      <p className="flex-1 text-[12px] font-mono text-[#a8b0c8] break-all">
                        {change.objectId}
                      </p>
                      <CopyBtn value={change.objectId} />
                    </div>
                  )}
                  {change.objectType && (
                    <p className="text-[11px] font-mono text-[#55556a] mt-1 truncate">
                      {change.objectType}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="p-5 border-b border-white/[0.06]">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#8888a0] mb-3">
          Emitted events
          <span className="ml-2 text-[#55556a] font-mono normal-case">
            ({detail.events.length})
          </span>
        </h3>
        {detail.events.length > 0 ? (
          <div className="space-y-3">
            {detail.events.map((event, i) => (
              <EventCard
                key={`${event.type}-${event.eventSeq ?? i}`}
                event={event}
                index={i}
              />
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-[#55556a]">
            This transaction did not emit any Move events.
          </p>
        )}
      </div>

      {detail.objectChanges.length === 0 && detail.events.length === 0 && (
        <div className="p-5 text-[12px] text-[#55556a]">
          No object changes recorded for this transaction.
        </div>
      )}
    </div>
  );
}

type ExplorerPanel = "transactions" | "wallets";

export function LocalExplorer({
  open,
  walletAddress,
  onClose,
  onLog,
}: {
  open: boolean;
  walletAddress: string | null;
  onClose: () => void;
  onLog: (level: "info" | "success" | "warn" | "error", message: string) => void;
}) {
  const [panel, setPanel] = useState<ExplorerPanel>("transactions");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [transactions, setTransactions] = useState<LocalTx[]>([]);
  const [selectedDigest, setSelectedDigest] = useState<string | null>(null);
  const [detail, setDetail] = useState<TxDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [addressFilter, setAddressFilter] = useState("");
  const [search, setSearch] = useState("");

  const selectTx = useCallback(
    async (digest: string) => {
      setSelectedDigest(digest);
      setDetailLoading(true);
      setDetail(null);
      try {
        setDetail(await window.playground.getLocalTransactionDetail({ digest }));
      } catch (e: any) {
        onLog("error", e.message || "Failed to load transaction.");
      }
      setDetailLoading(false);
    },
    [onLog],
  );

  const refreshList = useCallback(async () => {
    setListLoading(true);
    try {
      const status = await window.playground.getLocalNetworkStatus();
      if (!status.rpcReady) {
        setOverview(null);
        setTransactions([]);
        return;
      }

      const filter = addressFilter.trim();
      const [ov, txs] = await Promise.all([
        window.playground.getLocalNetworkOverview(),
        filter
          ? window.playground.getLocalTransactions({ address: filter, limit: 50 })
          : window.playground.getLocalRecentTransactions({ limit: 50 }),
      ]);
      setOverview(ov);
      setTransactions(txs);
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Explorer refresh failed.";
      if (/localnet rpc unreachable|local network is not running/i.test(message)) {
        setOverview(null);
        setTransactions([]);
        return;
      }
      onLog("error", message);
    }
    setListLoading(false);
  }, [addressFilter, onLog]);

  useEffect(() => {
    if (!open) return;
    setAddressFilter(walletAddress ?? "");
    setSelectedDigest(null);
    setDetail(null);
  }, [open, walletAddress]);

  useEffect(() => {
    if (!open) return;
    const delay = addressFilter ? 400 : 0;
    const t = window.setTimeout(() => {
      setSelectedDigest(null);
      setDetail(null);
      refreshList();
    }, delay);
    return () => window.clearTimeout(t);
  }, [open, addressFilter, refreshList]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(refreshList, 8000);
    return () => window.clearInterval(timer);
  }, [open, refreshList]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const runSearch = async () => {
    const q = search.trim();
    if (!q) return;
    if (q.startsWith("0x")) {
      setAddressFilter(q);
      return;
    }
    await selectTx(q);
  };

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#0a0a0f]">
      <header className="flex-shrink-0 flex items-center gap-3 px-5 h-14 border-b border-white/[0.08] bg-[#12121a]/90">
        <button
          onClick={onClose}
          className="h-8 w-8 flex items-center justify-center rounded-lg border border-[#2a2a3c] text-[#8888a0] hover:text-[#f0f0f5] cursor-pointer"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-[15px] font-semibold text-[#f0f0f5]">
            Localnet Explorer
          </h2>
          <p className="text-[11px] text-[#55556a] font-mono truncate">
            {overview?.rpcUrl ?? "127.0.0.1:9000"}
          </p>
        </div>

        <div className="flex items-center rounded-xl border border-[#2a2a3c] bg-[#0d0d14] p-0.5">
          <button
            type="button"
            onClick={() => setPanel("transactions")}
            className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] border-none cursor-pointer transition-colors ${
              panel === "transactions"
                ? "bg-[#7dd3fc]/14 text-[#7dd3fc] font-medium"
                : "bg-transparent text-[#8888a0] hover:text-[#f0f0f5]"
            }`}
          >
            <List size={12} />
            Transactions
          </button>
          <button
            type="button"
            onClick={() => setPanel("wallets")}
            className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] border-none cursor-pointer transition-colors ${
              panel === "wallets"
                ? "bg-[#7dd3fc]/14 text-[#7dd3fc] font-medium"
                : "bg-transparent text-[#8888a0] hover:text-[#f0f0f5]"
            }`}
          >
            <Wallet size={12} />
            Wallets
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-[#8888a0]">
          <span className="px-2.5 py-1 rounded-lg bg-[#1e1e1e] border border-[#2a2a3c]">
            CP {overview?.latestCheckpoint ?? "—"}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-[#1e1e1e] border border-[#2a2a3c]">
            {overview?.totalTransactions ?? "—"} tx
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-[#1e1e1e] border border-[#2a2a3c]">
            epoch {overview?.epoch ?? "—"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#55556a]"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="Digest or 0x address"
              className="w-44 h-8 pl-8 pr-3 rounded-lg text-[12px] font-mono bg-[#1e1e1e] border border-[#2a2a3c] text-[#f0f0f5] outline-none placeholder:text-[#55556a]"
            />
          </div>
          <button
            onClick={refreshList}
            disabled={listLoading}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-[#2a2a3c] text-[#8888a0] hover:text-[#f0f0f5] cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={listLoading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-[#2a2a3c] text-[#8888a0] hover:text-[#f0f0f5] cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex">
        {panel === "wallets" ? (
          <LocalExplorerWallets walletAddress={walletAddress} onLog={onLog} />
        ) : (
        <>
        <aside className="w-[min(340px,38%)] flex-shrink-0 border-r border-white/[0.08] flex flex-col bg-[#0d0d14]">
          <div className="flex-shrink-0 p-3 border-b border-white/[0.06]">
            <input
              value={addressFilter}
              onChange={(e) => setAddressFilter(e.target.value)}
              placeholder="Filter by sender address (empty = all)"
              className="w-full h-9 px-3 rounded-lg text-[12px] font-mono bg-[#1e1e1e] border border-[#2a2a3c] text-[#f0f0f5] outline-none placeholder:text-[#55556a]"
            />
            {walletAddress && (
              <button
                onClick={() => setAddressFilter(walletAddress)}
                className="mt-2 text-[11px] text-[#4ca3ff] hover:underline cursor-pointer bg-transparent border-none p-0"
              >
                Use active playground wallet
              </button>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {listLoading && transactions.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-16 text-[#8888a0] text-[13px]">
                <Loader2 size={16} className="animate-spin" />
                Loading…
              </div>
            ) : transactions.length === 0 ? (
              <p className="px-4 py-16 text-[13px] text-[#55556a] text-center leading-relaxed">
                No transactions yet.
              </p>
            ) : (
              transactions.map((tx) => {
                const selected = selectedDigest === tx.digest;
                const ok = tx.status === "success";
                return (
                  <button
                    key={tx.digest}
                    onClick={() => selectTx(tx.digest)}
                    className={`w-full text-left px-4 py-3 border-b border-white/[0.04] cursor-pointer transition-colors ${
                      selected
                        ? "bg-[#7dd3fc]/[0.08] border-l-2 border-l-[#7dd3fc]"
                        : "hover:bg-white/[0.03] border-l-2 border-l-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[12px] font-mono text-[#d0d0e0]">
                        {short(tx.digest, 14, 10)}
                      </span>
                      <span
                        className={`text-[10px] ${ok ? "text-[#00d4aa]" : "text-[#ff4d6d]"}`}
                      >
                        {tx.status ?? "?"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[11px] text-[#55556a]">
                      <span className="font-mono truncate">
                        {tx.sender ? short(tx.sender, 6, 4) : "—"}
                      </span>
                      <span className="flex-shrink-0">
                        {formatTime(tx.timestampMs)}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <main className="flex-1 min-w-0 flex flex-col bg-[#0a0a0f]">
          <TxDetailView detail={detail} loading={detailLoading} />
        </main>
        </>
        )}
      </div>
    </div>
  );
}