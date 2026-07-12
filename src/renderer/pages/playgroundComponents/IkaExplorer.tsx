import { useCallback, useEffect, useState } from "react";
import {
  X,
  RefreshCw,
  Loader2,
  Search,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import {
  MetaRow,
  TxDetailView,
  formatTime,
  short,
} from "./LocalExplorer";
import { CopyButton } from "../../components/CopyButton";

type Overview = Awaited<
  ReturnType<typeof window.playground.getIkaExplorerOverview>
>;
type IkaTx = Awaited<
  ReturnType<typeof window.playground.getIkaRelatedTransactions>
>[number];
type TxDetail = Awaited<
  ReturnType<typeof window.playground.getLocalTransactionDetail>
>;
type ObjectDetail = Awaited<
  ReturnType<typeof window.playground.getLocalObject>
>;

type SideTab = "chain" | "transactions";

function StatusBadge({
  ok,
  label,
  pending,
}: {
  ok: boolean;
  label: string;
  pending?: boolean;
}) {
  const color = ok
    ? "border-[#00d4aa]/30 text-[#00d4aa] bg-[#00d4aa]/10"
    : pending
      ? "border-[#ffb347]/30 text-[#ffb347] bg-[#ffb347]/10"
      : "border-[#8888a0]/20 text-[#8888a0] bg-white/[0.03]";
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border ${color}`}
    >
      {ok ? (
        <CheckCircle2 size={11} />
      ) : pending ? (
        <AlertCircle size={11} />
      ) : (
        <XCircle size={11} />
      )}
      {label}
    </span>
  );
}

function IdRow({
  label,
  value,
  onInspect,
}: {
  label: string;
  value: string | null;
  onInspect?: (id: string) => void;
}) {
  if (!value) {
    return <MetaRow label={label} value="—" />;
  }
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-white/[0.04] last:border-0">
      <span className="text-[12px] text-[#8888a0] flex-shrink-0">{label}</span>
      <div className="flex items-start gap-1 min-w-0">
        <button
          type="button"
          onClick={() => onInspect?.(value)}
          className={`text-[12px] font-mono text-right break-all bg-transparent border-none p-0 cursor-pointer ${
            onInspect
              ? "text-[#7dd3fc] hover:underline"
              : "text-[#e8e8f0]"
          }`}
          title={onInspect ? "Inspect object" : undefined}
        >
          {short(value, 12, 10)}
        </button>
        <CopyButton text={value} className="h-6 w-6 flex-shrink-0" />
      </div>
    </div>
  );
}

function ChainOverview({
  overview,
  onInspectObject,
}: {
  overview: Overview;
  onInspectObject: (objectId: string) => void;
}) {
  const system = overview.objects.system;
  const coordinator = overview.objects.coordinator;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
      <section className="rounded-xl border border-white/[0.06] bg-[#12121a] px-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#8888a0] py-3 border-b border-white/[0.04]">
          Localnet status
        </h3>
        <MetaRow
          label="Sui RPC"
          value={overview.rpcReady ? overview.rpcUrl : "not reachable"}
          mono={false}
        />
        <MetaRow label="Chain ID" value={overview.chainId ?? "—"} />
        <MetaRow label="Sui epoch" value={overview.suiEpoch ?? "—"} />
        <MetaRow
          label="Ika process"
          value={
            overview.ikaRunning
              ? `running (pid ${overview.ikaPid ?? "?"})`
              : "stopped"
          }
          mono={false}
        />
        <MetaRow
          label="Config sync"
          value={
            overview.stateOutOfSync
              ? "out of sync — reset required"
              : overview.configMatchesPersisted
                ? "ika_config.json ↔ network.yaml"
                : "persisted config missing"
          }
          mono={false}
        />
        <MetaRow
          label="Resume"
          value={
            overview.canResumeIka
              ? "available"
              : overview.resumeAvailable
                ? "session saved"
                : "not ready"
          }
          mono={false}
        />
        {overview.sessionSavedAt != null && (
          <MetaRow
            label="Session saved"
            value={formatTime(String(overview.sessionSavedAt))}
            mono={false}
          />
        )}
      </section>

      <section className="rounded-xl border border-white/[0.06] bg-[#12121a] px-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#8888a0] py-3 border-b border-white/[0.04]">
          Network DKG
        </h3>
        <MetaRow
          label="DKG ready"
          value={overview.networkDkgReady ? "yes (chunks on chain)" : "no"}
          mono={false}
        />
        {overview.suiCheckpointLag != null && (
          <MetaRow
            label="Sui checkpoint lag"
            value={`${overview.suiCheckpointLag} (informational — not a health signal)`}
            mono={false}
          />
        )}
        <MetaRow
          label="Encryption keys"
          value={String(overview.dkg.encryptionKeyCount)}
        />
        <MetaRow
          label="DKG chunks"
          value={String(overview.dkg.totalChunkCount)}
        />
        <IdRow
          label="Coordinator inner"
          value={overview.dkg.coordinatorInnerId}
          onInspect={onInspectObject}
        />
        <IdRow
          label="Keys table"
          value={overview.dkg.keysTableId}
          onInspect={onInspectObject}
        />
        {overview.dkg.encryptionKeys.map((key) => (
          <div
            key={key.objectId}
            className="py-3 border-t border-white/[0.04] space-y-1"
          >
            <p className="text-[11px] text-[#00e5ff] font-mono break-all">
              {short(key.objectId, 14, 12)}
            </p>
            <p className="text-[11px] text-[#8888a0]">
              state: {key.state ?? "—"} · epoch: {key.dkgAtEpoch ?? "—"} ·
              chunks: {key.chunkCount}
            </p>
            {key.supportedCurves && (
              <p className="text-[10px] text-[#55556a]">
                curves: {key.supportedCurves}
              </p>
            )}
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-white/[0.06] bg-[#12121a] px-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#8888a0] py-3 border-b border-white/[0.04]">
          Core objects
        </h3>
        <IdRow
          label="System object"
          value={overview.config?.objects.ika_system_object_id ?? null}
          onInspect={onInspectObject}
        />
        {system && (
          <>
            <MetaRow
              label="System on chain"
              value={system.exists ? `v${system.version ?? "?"}` : "missing"}
              mono={false}
            />
            <MetaRow
              label="Ika system epoch"
              value={system.innerFields.epoch ?? "—"}
            />
            {system.innerFields.protocol_version && (
              <MetaRow
                label="Protocol version"
                value={system.innerFields.protocol_version}
              />
            )}
          </>
        )}
        <IdRow
          label="Coordinator"
          value={
            overview.config?.objects.ika_dwallet_coordinator_object_id ?? null
          }
          onInspect={onInspectObject}
        />
        {coordinator && (
          <>
            <MetaRow
              label="Coordinator on chain"
              value={
                coordinator.exists ? `v${coordinator.version ?? "?"}` : "missing"
              }
              mono={false}
            />
            <MetaRow
              label="Coordinator epoch"
              value={coordinator.innerFields.current_epoch ?? "—"}
            />
            <MetaRow
              label="Last checkpoint"
              value={
                coordinator.innerFields
                  .last_processed_checkpoint_sequence_number ?? "—"
              }
            />
            <MetaRow
              label="Messages processed"
              value={coordinator.innerFields.total_messages_processed ?? "—"}
            />
            <MetaRow
              label="Dynamic fields"
              value={String(overview.coordinatorDynamicFieldCount)}
            />
          </>
        )}
        {overview.persistedSystemId && (
          <IdRow label="Persisted system" value={overview.persistedSystemId} />
        )}
        {overview.persistedCoordinatorId && (
          <IdRow
            label="Persisted coordinator"
            value={overview.persistedCoordinatorId}
          />
        )}
      </section>

      <section className="rounded-xl border border-white/[0.06] bg-[#12121a] px-4 pb-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#8888a0] py-3 border-b border-white/[0.04]">
          Published packages
        </h3>
        {overview.packages.length === 0 ? (
          <p className="py-3 text-[12px] text-[#55556a]">
            ika_config.json not ready yet.
          </p>
        ) : (
          overview.packages.map((pkg) => (
            <div
              key={`${pkg.label}-${pkg.packageId}`}
              className="py-2.5 border-b border-white/[0.04] last:border-0"
            >
              <p className="text-[11px] text-[#8888a0] mb-1">{pkg.label}</p>
              <p className="text-[12px] font-mono text-[#c7c7d8] break-all">
                {pkg.packageId}
              </p>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function ObjectDetailView({
  detail,
  loading,
}: {
  detail: ObjectDetail | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#8888a0] gap-2">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-[13px]">Loading object…</span>
      </div>
    );
  }
  if (!detail) return null;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-5">
      <div className="rounded-xl bg-[#12121a] border border-white/[0.06] px-4 mb-4">
        <MetaRow label="Object ID" value={detail.objectId} />
        <MetaRow label="Version" value={detail.version ?? "—"} />
        <MetaRow label="Owner" value={detail.owner ?? "—"} />
        <MetaRow label="Type" value={detail.objectType ?? "—"} mono={false} />
      </div>
      {detail.content && (
        <pre className="text-[11px] font-mono text-[#a8b0c8] bg-[#12121a] border border-white/[0.06] rounded-xl p-4 overflow-x-auto whitespace-pre-wrap break-all">
          {detail.content}
        </pre>
      )}
    </div>
  );
}

export function IkaExplorer({
  open,
  onClose,
  onLog,
}: {
  open: boolean;
  onClose: () => void;
  onLog: (level: "info" | "success" | "warn" | "error", message: string) => void;
}) {
  const [tab, setTab] = useState<SideTab>("chain");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [transactions, setTransactions] = useState<IkaTx[]>([]);
  const [selectedDigest, setSelectedDigest] = useState<string | null>(null);
  const [txDetail, setTxDetail] = useState<TxDetail | null>(null);
  const [txLoading, setTxLoading] = useState(false);
  const [objectId, setObjectId] = useState<string | null>(null);
  const [objectDetail, setObjectDetail] = useState<ObjectDetail | null>(null);
  const [objectLoading, setObjectLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const inspectObject = useCallback(
    async (id: string) => {
      setTab("chain");
      setObjectId(id);
      setSelectedDigest(null);
      setTxDetail(null);
      setObjectLoading(true);
      setObjectDetail(null);
      try {
        setObjectDetail(
          await window.playground.getLocalObject({ objectId: id }),
        );
      } catch (e: any) {
        onLog("error", e.message || "Failed to load object.");
      }
      setObjectLoading(false);
    },
    [onLog],
  );

  const selectTx = useCallback(
    async (digest: string) => {
      setTab("transactions");
      setSelectedDigest(digest);
      setObjectId(null);
      setObjectDetail(null);
      setTxLoading(true);
      setTxDetail(null);
      try {
        setTxDetail(
          await window.playground.getLocalTransactionDetail({ digest }),
        );
      } catch (e: any) {
        onLog("error", e.message || "Failed to load transaction.");
      }
      setTxLoading(false);
    },
    [onLog],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setOverview(await window.playground.getIkaExplorerOverview());
    } catch (e: any) {
      onLog("error", e.message || "Ika explorer overview failed.");
    }
    try {
      setTransactions(
        await window.playground.getIkaRelatedTransactions({ limit: 30 }),
      );
    } catch (e: any) {
      setTransactions([]);
      onLog("error", e.message || "Ika transaction list failed.");
    }
    setLoading(false);
  }, [onLog]);

  useEffect(() => {
    if (!open) return;
    setTab("chain");
    setSelectedDigest(null);
    setTxDetail(null);
    setObjectId(null);
    setObjectDetail(null);
    refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(refresh, 10_000);
    return () => window.clearInterval(timer);
  }, [open, refresh]);

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
    if (q.startsWith("0x") && q.length > 20) {
      if (q.length === 66) {
        await selectTx(q);
      } else {
        await inspectObject(q);
      }
      return;
    }
    await selectTx(q);
  };

  if (!open) return null;

  const rightPanel =
    tab === "transactions" ? (
      <TxDetailView detail={txDetail} loading={txLoading} />
    ) : objectId ? (
      <ObjectDetailView detail={objectDetail} loading={objectLoading} />
    ) : (
      <div className="flex-1 flex items-center justify-center text-[#55556a] text-[13px] px-8 text-center leading-relaxed">
        Click an object ID in the overview to inspect on-chain content, or
        switch to Transactions for Ika-related activity.
      </div>
    );

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[#0a0a0f]/95 backdrop-blur-md">
      <header className="flex-shrink-0 flex items-center gap-3 px-5 h-14 border-b border-white/[0.08] bg-[#12121a]/90">
        <button
          onClick={onClose}
          className="h-8 w-8 flex items-center justify-center rounded-lg border border-[#2a2a3c] text-[#8888a0] hover:text-[#f0f0f5] cursor-pointer"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-[15px] font-semibold text-[#f0f0f5]">
            Ika Explorer
          </h2>
          <p className="text-[11px] text-[#55556a] font-mono truncate">
            {overview?.rpcUrl ?? "127.0.0.1:9000"}
            {overview?.chainId ? ` · chain ${short(overview.chainId, 8, 6)}` : ""}
          </p>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <StatusBadge
            ok={overview?.rpcReady ?? false}
            label="Sui RPC"
          />
          <StatusBadge
            ok={overview?.ikaRunning ?? false}
            label="Ika"
          />
          <StatusBadge
            ok={overview?.networkDkgReady ?? false}
            label="Network DKG"
            pending={
              Boolean(
                overview?.ikaRunning &&
                  overview?.config &&
                  !overview.networkDkgReady,
              )
            }
          />
          {overview?.stateOutOfSync && (
            <StatusBadge ok={false} label="Out of sync" />
          )}
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono text-[#8888a0]">
          <span className="hidden sm:inline px-2.5 py-1 rounded-lg bg-[#1e1e1e] border border-[#2a2a3c]">
            DKG {overview?.dkg.totalChunkCount ?? "—"} chunks
          </span>
          <span className="hidden sm:inline px-2.5 py-1 rounded-lg bg-[#1e1e1e] border border-[#2a2a3c]">
            coord ε {overview?.objects.coordinator?.innerFields.current_epoch ?? "—"}
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
              placeholder="Tx digest or 0x object"
              className="w-44 h-8 pl-8 pr-3 rounded-lg text-[12px] font-mono bg-[#1e1e1e] border border-[#2a2a3c] text-[#f0f0f5] outline-none placeholder:text-[#55556a]"
            />
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-[#2a2a3c] text-[#8888a0] hover:text-[#f0f0f5] cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
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
        <aside className="w-[min(380px,42%)] flex-shrink-0 border-r border-white/[0.08] flex flex-col bg-[#0d0d14]">
          <div className="flex-shrink-0 flex border-b border-white/[0.06]">
            {(["chain", "transactions"] as const).map((id) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex-1 h-10 text-[12px] font-medium cursor-pointer border-none ${
                  tab === id
                    ? "text-[#00e5ff] bg-[#00e5ff]/[0.06] border-b-2 border-b-[#00e5ff]"
                    : "text-[#8888a0] bg-transparent hover:text-[#f0f0f5]"
                }`}
              >
                {id === "chain" ? "On chain" : `Transactions (${transactions.length})`}
              </button>
            ))}
          </div>

          {tab === "chain" ? (
            overview ? (
              <ChainOverview
                overview={overview}
                onInspectObject={inspectObject}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center gap-2 text-[#8888a0]">
                <Loader2 size={16} className="animate-spin" />
                Loading…
              </div>
            )
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto">
              {loading && transactions.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-16 text-[#8888a0] text-[13px]">
                  <Loader2 size={16} className="animate-spin" />
                  Loading…
                </div>
              ) : transactions.length === 0 ? (
                <p className="px-4 py-16 text-[13px] text-[#55556a] text-center leading-relaxed">
                  No Ika-related transactions found yet. Publish packages and
                  start Ika localnet to populate on-chain state.
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
                          ? "bg-[#00e5ff]/[0.08] border-l-2 border-l-[#00e5ff]"
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
                      {tx.ikaPackageHits.length > 0 && (
                        <p className="mt-1 text-[10px] text-[#00e5ff]/80 truncate">
                          {tx.ikaPackageHits.join(", ")}
                        </p>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </aside>

        <main className="flex-1 min-w-0 flex flex-col bg-[#0a0a0f]">
          {rightPanel}
        </main>
      </div>
    </div>
  );
}