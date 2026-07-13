import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  RefreshCw,
  X,
  Copy,
  Check,
} from "lucide-react";
import { ChainDiagnosticsDiagrams } from "./ChainDiagnosticsDiagrams";

type ClientStatus = Awaited<ReturnType<typeof window.playground.getClientStatus>>;
type LocalStatus = Awaited<
  ReturnType<typeof window.playground.getLocalNetworkStatus>
>;
type StackStatus = Awaited<
  ReturnType<typeof window.playground.getIkaLocalnetStackStatus>
>;
type ResumeStatus = Awaited<
  ReturnType<typeof window.playground.getLocalnetResumeStatus>
>;

type DiagnosticsSnapshot = {
  client: ClientStatus | null;
  sui: LocalStatus | null;
  stack: StackStatus | null;
  resume: ResumeStatus | null;
  fetchedAt: number;
};

function formatTime(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("en-US", { hour12: false });
}

function shorten(value: string | null | undefined, head = 8, tail = 6): string {
  if (!value) return "—";
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

function boolLabel(value: boolean | undefined): "yes" | "no" | "—" {
  if (value === true) return "yes";
  if (value === false) return "no";
  return "—";
}

function StatusDot({ ok }: { ok: boolean | undefined }) {
  const color =
    ok === true
      ? "bg-[#00d4aa]"
      : ok === false
        ? "bg-[#55556a]"
        : "bg-[#ffb347]";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

function DiagSection({
  title,
  accent,
  children,
}: {
  title: string;
  accent: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-white/[0.06] bg-[#0a0a12] overflow-hidden">
      <div
        className="px-2.5 py-1.5 border-b border-white/[0.05] text-[10px] font-bold uppercase tracking-wide"
        style={{ color: accent }}
      >
        {title}
      </div>
      <div className="px-2.5 py-2 space-y-1">{children}</div>
    </section>
  );
}

function DiagRow({
  label,
  value,
  mono = false,
  ok,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  ok?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-[11px] leading-snug">
      <span className="text-[#666688] flex-shrink-0">{label}</span>
      <span className="text-[#d6d6e8] text-right flex items-center gap-1.5 min-w-0">
        {ok !== undefined && <StatusDot ok={ok} />}
        <span className={mono ? "font-mono text-[10px] break-all" : ""}>
          {value}
        </span>
      </span>
    </div>
  );
}

function buildCopyText(data: DiagnosticsSnapshot): string {
  const lines: string[] = [
    `Beluga chain diagnostics @ ${new Date(data.fetchedAt).toISOString()}`,
    "",
    "[Sui client]",
    `configured: ${boolLabel(data.client?.configured)}`,
    `active env: ${data.client?.activeEnv ?? "—"}`,
    `address: ${data.client?.activeAddress ?? "—"}`,
    "",
    "[Sui localnet]",
    `running: ${boolLabel(data.sui?.running)}`,
    `rpc ready: ${boolLabel(data.sui?.rpcReady)}`,
    `managed: ${boolLabel(data.sui?.managed)}`,
    `rpc: ${data.sui?.rpcUrl ?? "—"}`,
    `pid: ${data.sui?.pid ?? "—"}`,
    `for ika: ${boolLabel(data.sui?.forIka)}`,
    "",
    "[Ika stack]",
    `phase: ${data.stack?.phase ?? "—"}`,
    `label: ${data.stack?.label ?? "—"}`,
    `ika running: ${boolLabel(data.stack?.ika.running)}`,
    `dkg ready: ${boolLabel(data.stack?.ika.networkDkgReady)}`,
    `dwallet ready: ${boolLabel(data.stack?.ika.dwalletReady)}`,
    "",
    "[Resume]",
    `can resume sui: ${boolLabel(data.resume?.canResumeSui)}`,
    `can resume ika: ${boolLabel(data.resume?.canResumeIka)}`,
    `checkpoint lag: ${data.resume?.suiCheckpointLag ?? "—"}`,
  ];
  return lines.join("\n");
}

async function loadDiagnostics(): Promise<DiagnosticsSnapshot> {
  const [client, sui, stack, resume] = await Promise.all([
    window.playground.getClientStatus().catch(() => null),
    window.playground.getLocalNetworkStatus().catch(() => null),
    window.playground.getIkaLocalnetStackStatus().catch(() => null),
    window.playground.getLocalnetResumeStatus().catch(() => null),
  ]);
  return {
    client,
    sui,
    stack,
    resume,
    fetchedAt: Date.now(),
  };
}

export function ChainDiagnosticsPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [data, setData] = useState<DiagnosticsSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    if (!window.playground?.getClientStatus) {
      setError("Playground bridge unavailable.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(await loadDiagnostics());
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Could not load diagnostics.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void refresh();
    const pollMs =
      window.electronAPI?.platform === "win32" ? 8_000 : 3_000;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void refresh();
    }, pollMs);
    return () => window.clearInterval(timer);
  }, [open, refresh]);

  if (!open) return null;

  const client = data?.client;
  const sui = data?.sui;
  const stack = data?.stack;
  const ika = stack?.ika;
  const resume = data?.resume;

  return (
    <div className="absolute inset-y-0 right-0 z-20 w-full sm:w-[min(100%,400px)] flex flex-col border-l border-[#4ca3ff]/20 bg-[#080810]/98 backdrop-blur-sm shadow-[-8px_0_32px_rgba(0,0,0,0.45)]">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06] bg-[#101018] flex-shrink-0">
        <Activity size={14} className="text-[#4ca3ff]" />
        <span className="text-[12px] font-semibold text-[#e8e8f0]">
          Chain diagnostics
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          title="Refresh"
          className="h-7 w-7 rounded-lg border border-[#2a2a3c] text-[#8888a0] hover:text-[#f0f0f5] cursor-pointer disabled:opacity-50 flex items-center justify-center bg-transparent"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
        <button
          type="button"
          onClick={async () => {
            if (!data) return;
            await navigator.clipboard.writeText(buildCopyText(data));
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
          }}
          disabled={!data}
          title="Copy report"
          className="h-7 w-7 rounded-lg border border-[#2a2a3c] text-[#8888a0] hover:text-[#f0f0f5] cursor-pointer disabled:opacity-40 flex items-center justify-center bg-transparent"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
        <button
          type="button"
          onClick={onClose}
          title="Close"
          className="h-7 w-7 rounded-lg border border-[#2a2a3c] text-[#8888a0] hover:text-[#f0f0f5] cursor-pointer flex items-center justify-center bg-transparent"
        >
          <X size={13} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2">
        {error && (
          <p className="text-[11px] text-[#ff4d6d] px-1 leading-relaxed">
            {error}
          </p>
        )}

        {!data && loading && (
          <p className="text-[11px] text-[#666688] px-1">Loading diagnostics…</p>
        )}

        {data && (
          <>
            <p className="text-[10px] text-[#55556a] px-0.5">
              Updated {formatTime(data.fetchedAt)}
            </p>

            <ChainDiagnosticsDiagrams
              data={{
                client,
                sui,
                stack,
                resume,
              }}
            />

            <DiagSection title="Sui client" accent="#7dd3fc">
              <DiagRow label="Configured" value={boolLabel(client?.configured)} ok={client?.configured} />
              <DiagRow label="Active env" value={client?.activeEnv ?? "—"} mono />
              <DiagRow
                label="Address"
                value={shorten(client?.activeAddress, 10, 8)}
                mono
              />
              {client?.environments?.length ? (
                <DiagRow
                  label="Environments"
                  value={client.environments
                    .map((env) => `${env.alias}${env.active ? "*" : ""}`)
                    .join(", ")}
                  mono
                />
              ) : null}
            </DiagSection>

            <DiagSection title="Sui localnet" accent="#4ca3ff">
              <DiagRow label="Running" value={boolLabel(sui?.running)} ok={sui?.running} />
              <DiagRow label="RPC ready" value={boolLabel(sui?.rpcReady)} ok={sui?.rpcReady} />
              <DiagRow label="Managed" value={boolLabel(sui?.managed)} ok={sui?.managed} />
              <DiagRow label="PID" value={sui?.pid ?? "—"} mono />
              <DiagRow label="RPC URL" value={sui?.rpcUrl ?? "—"} mono />
              <DiagRow label="Faucet" value={sui?.faucetUrl ?? "—"} mono />
              <DiagRow label="Started" value={formatTime(sui?.startedAt)} mono />
              <DiagRow label="Ika epochs" value={boolLabel(sui?.forIka)} ok={sui?.forIka} />
              <DiagRow
                label="Genesis saved"
                value={boolLabel(sui?.persistedGenesisReady)}
                ok={sui?.persistedGenesisReady}
              />
            </DiagSection>

            <DiagSection title="Ika stack" accent="#00e5ff">
              <DiagRow label="Phase" value={stack?.phase ?? "—"} mono />
              <DiagRow label="Status" value={stack?.label ?? "—"} />
              <DiagRow label="Ika running" value={boolLabel(ika?.running)} ok={ika?.running} />
              <DiagRow label="Config ready" value={boolLabel(ika?.configReady)} ok={ika?.configReady} />
              <DiagRow label="DKG ready" value={boolLabel(ika?.networkDkgReady)} ok={ika?.networkDkgReady} />
              <DiagRow label="dWallet ready" value={boolLabel(ika?.dwalletReady)} ok={ika?.dwalletReady} />
              <DiagRow label="Coordinator epoch" value={ika?.coordinatorEpoch ?? "—"} mono />
              <DiagRow label="Checkpoint lag" value={ika?.suiCheckpointLag ?? "—"} mono />
              <DiagRow label="DKG chunks" value={ika?.dkgChunkCount ?? "—"} mono />
              <DiagRow label="PID" value={ika?.pid ?? "—"} mono />
              {ika?.readinessHint ? (
                <p className="text-[10px] text-[#8888a0] leading-relaxed pt-1 border-t border-white/[0.04]">
                  {ika.readinessHint}
                </p>
              ) : null}
            </DiagSection>

            <DiagSection title="Resume / session" accent="#c4c0ff">
              <DiagRow
                label="Toolchain writable"
                value={boolLabel(resume?.toolchainWritable)}
                ok={resume?.toolchainWritable}
              />
              <DiagRow label="Can resume Sui" value={boolLabel(resume?.canResumeSui)} ok={resume?.canResumeSui} />
              <DiagRow label="Can resume Ika" value={boolLabel(resume?.canResumeIka)} ok={resume?.canResumeIka} />
              <DiagRow
                label="Ika config ready"
                value={boolLabel(resume?.ikaConfigReady)}
                ok={resume?.ikaConfigReady}
              />
              <DiagRow
                label="Config in sync"
                value={boolLabel(resume?.configMatchesPersisted)}
                ok={resume?.configMatchesPersisted}
              />
              <DiagRow label="Genesis ready" value={boolLabel(resume?.suiGenesisReady)} ok={resume?.suiGenesisReady} />
              <DiagRow label="Checkpoint lag" value={resume?.suiCheckpointLag ?? "—"} mono />
              {resume?.session ? (
                <>
                  <DiagRow
                    label="Coordinator"
                    value={shorten(resume.session.coordinatorObjectId, 10, 8)}
                    mono
                  />
                  <DiagRow
                    label="Chain ID"
                    value={shorten(resume.session.suiChainId, 10, 6)}
                    mono
                  />
                  <DiagRow
                    label="Session DKG"
                    value={boolLabel(resume.session.networkDkgReady)}
                    ok={resume.session.networkDkgReady}
                  />
                  <DiagRow
                    label="Saved at"
                    value={formatTime(resume.session.savedAt)}
                    mono
                  />
                </>
              ) : (
                <DiagRow label="Saved session" value="none" />
              )}
            </DiagSection>
          </>
        )}
      </div>
    </div>
  );
}