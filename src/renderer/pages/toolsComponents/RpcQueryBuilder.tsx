import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Play,
  Loader2,
  Terminal,
  ChevronDown,
  History,
  Trash2,
} from "lucide-react";
import type { SuiNetwork } from "../../types/network";
import { SUI_NETWORKS } from "../../types/network";
import { CopyButton } from "../../components/CopyButton";

type Catalog = Awaited<ReturnType<typeof window.tools.listGrpcQueryCatalog>>;
type QueryResult = Awaited<ReturnType<typeof window.tools.executeGrpcQuery>>;

type HistoryEntry = {
  id: string;
  at: number;
  service: string;
  method: string;
  request: Record<string, unknown>;
  ok: boolean;
  durationMs: number;
};

const HISTORY_KEY = "beluga-grpc-query-history-v1";

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, 20)));
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function RpcQueryBuilder({ network }: { network: SuiNetwork }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [presetId, setPresetId] = useState("ledger.getServiceInfo");
  const [service, setService] = useState("ledger");
  const [method, setMethod] = useState("getServiceInfo");
  const [requestText, setRequestText] = useState("{}");
  const [customEndpoint, setCustomEndpoint] = useState("");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (typeof window.tools?.listGrpcQueryCatalog !== "function") {
      setError(
        "RPC Query API is not loaded. Quit Beluga completely and run npm start again.",
      );
      return;
    }
    window.tools
      .listGrpcQueryCatalog()
      .then(setCatalog)
      .catch((e: Error) =>
        setError(e.message || "Failed to load query catalog."),
      );
  }, []);

  const presets = catalog?.presets ?? [];
  const services = catalog?.services ?? [];

  const methodsForService = useMemo(() => {
    const fromPresets = presets
      .filter((p) => p.service === service)
      .map((p) => p.method);
    return [...new Set(fromPresets)].sort();
  }, [presets, service]);

  const applyPreset = useCallback(
    (id: string) => {
      const preset = presets.find((p) => p.id === id);
      if (!preset) return;
      setPresetId(id);
      setService(preset.service);
      setMethod(preset.method);
      setRequestText(formatJson(preset.defaultRequest));
      setError(null);
    },
    [presets],
  );

  useEffect(() => {
    if (presets.length > 0) applyPreset(presetId);
  }, [presets, presetId, applyPreset]);

  const transportLabel =
    network === "localnet" ? "JSON-RPC (localnet)" : "gRPC-Web";

  const handleRun = async () => {
    let request: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(requestText || "{}");
      if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Request body must be a JSON object.");
      }
      request = parsed as Record<string, unknown>;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Invalid JSON request body.");
      return;
    }

    if (typeof window.tools?.executeGrpcQuery !== "function") {
      setError(
        "RPC Query API is not loaded. Quit Beluga completely and run npm start again.",
      );
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await window.tools.executeGrpcQuery({
        network,
        service: service as Catalog["presets"][number]["service"],
        method,
        request,
        baseUrl: customEndpoint.trim() || undefined,
      });
      setResult(response);

      const entry: HistoryEntry = {
        id: `${Date.now()}`,
        at: Date.now(),
        service,
        method,
        request,
        ok: response.ok,
        durationMs: response.durationMs,
      };
      const nextHistory = [entry, ...history].slice(0, 20);
      setHistory(nextHistory);
      saveHistory(nextHistory);

      if (!response.ok) {
        setError(response.error ?? "Query failed.");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Query failed.");
      setResult(null);
    }
    setLoading(false);
  };

  const responseText = result
    ? result.ok
      ? formatJson(result.response)
      : result.error ?? "Unknown error"
    : "";

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-shrink-0 px-6 py-5 border-b border-white/[0.06]">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-[#f0f0f5] mb-1">
              RPC Query Builder
            </h2>
            <p className="text-[12px] text-[#8888a0] leading-relaxed max-w-2xl">
              Compose Sui gRPC queries with presets, edit the JSON request body,
              and inspect responses. On {SUI_NETWORKS[network].label} this uses{" "}
              <span className="text-[#4ca3ff] font-mono">{transportLabel}</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="h-8 px-3 flex items-center gap-2 rounded-xl border border-[#2a2a3c] text-[11px] text-[#8888a0] hover:text-[#f0f0f5] cursor-pointer"
          >
            <History size={13} />
            History ({history.length})
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
          <label className="block">
            <span className="text-[11px] text-[#8888a0] mb-1.5 block">
              Preset
            </span>
            <div className="relative">
              <select
                value={presetId}
                onChange={(e) => applyPreset(e.target.value)}
                className="w-full h-9 px-3 rounded-xl text-[12px] bg-[#1e1e1e] border border-[#2a2a3c] text-[#f0f0f5] outline-none appearance-none"
              >
                {presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label} · {preset.service}.{preset.method}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#55556a] pointer-events-none"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-[11px] text-[#8888a0] mb-1.5 block">
              Custom endpoint (optional)
            </span>
            <input
              value={customEndpoint}
              onChange={(e) => setCustomEndpoint(e.target.value)}
              placeholder={
                network === "localnet"
                  ? "http://127.0.0.1:9000"
                  : "https://fullnode.testnet.sui.io:443"
              }
              className="w-full h-9 px-3 rounded-xl text-[12px] font-mono bg-[#1e1e1e] border border-[#2a2a3c] text-[#f0f0f5] outline-none"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <label className="block">
            <span className="text-[11px] text-[#8888a0] mb-1.5 block">
              Service
            </span>
            <select
              value={service}
              onChange={(e) => {
                setService(e.target.value);
                setPresetId("");
                const nextMethods = presets
                  .filter((p) => p.service === e.target.value)
                  .map((p) => p.method);
                const nextMethod = nextMethods[0] ?? "";
                setMethod(nextMethod);
              }}
              className="w-full h-9 px-3 rounded-xl text-[12px] bg-[#1e1e1e] border border-[#2a2a3c] text-[#f0f0f5] outline-none"
            >
              {services.map((svc) => (
                <option key={svc.id} value={svc.id}>
                  {svc.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[11px] text-[#8888a0] mb-1.5 block">
              Method
            </span>
            <select
              value={method}
              onChange={(e) => {
                setMethod(e.target.value);
                setPresetId("");
              }}
              className="w-full h-9 px-3 rounded-xl text-[12px] font-mono bg-[#1e1e1e] border border-[#2a2a3c] text-[#f0f0f5] outline-none"
            >
              {methodsForService.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={handleRun}
            disabled={loading}
            className="h-9 px-4 rounded-xl text-[12px] font-medium border border-[#4ca3ff]/30 bg-[#4ca3ff]/10 text-[#4ca3ff] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} />
            )}
            Run query
          </button>
        </div>

        {error && (
          <p className="mt-3 text-[11px] text-[#ff7b5f] leading-relaxed">
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0 flex flex-col border-r border-white/[0.06]">
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] bg-[#12121a]">
            <span className="text-[11px] font-bold text-[#8888a0] uppercase tracking-[1.2px] flex items-center gap-1.5">
              <Terminal size={12} />
              Request JSON
            </span>
            <CopyButton text={requestText} label="Copy" />
          </div>
          <textarea
            value={requestText}
            onChange={(e) => {
              setRequestText(e.target.value);
              setPresetId("");
            }}
            spellCheck={false}
            className="flex-1 min-h-0 w-full resize-none bg-[#0d0d18] text-[#c7c7d8] font-mono text-[11px] leading-relaxed p-4 outline-none border-none"
          />
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] bg-[#12121a]">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-[#8888a0] uppercase tracking-[1.2px]">
                Response
              </span>
              {result && (
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    result.ok
                      ? "border-[#00d4aa]/30 text-[#00d4aa] bg-[#00d4aa]/10"
                      : "border-[#ff4d6d]/30 text-[#ff4d6d] bg-[#ff4d6d]/10"
                  }`}
                >
                  {result.ok ? "OK" : "ERR"} · {result.durationMs}ms ·{" "}
                  {result.transport}
                </span>
              )}
            </div>
            {responseText && <CopyButton text={responseText} label="Copy" />}
          </div>
          <pre className="flex-1 min-h-0 overflow-auto bg-[#0d0d18] text-[#a8b0c8] font-mono text-[11px] leading-relaxed p-4 m-0 whitespace-pre-wrap break-all">
            {responseText || (
              <span className="text-[#55556a]">
                Run a query to see the response here.
              </span>
            )}
          </pre>
        </div>
      </div>

      {showHistory && (
        <div className="flex-shrink-0 border-t border-white/[0.06] bg-[#12121a] max-h-44 overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.04]">
            <span className="text-[11px] text-[#8888a0]">Recent queries</span>
            <button
              type="button"
              onClick={() => {
                setHistory([]);
                saveHistory([]);
              }}
              className="h-7 px-2 flex items-center gap-1 rounded-lg border border-[#2a2a3c] text-[10px] text-[#8888a0] hover:text-[#ff4d6d] cursor-pointer"
            >
              <Trash2 size={11} />
              Clear
            </button>
          </div>
          {history.length === 0 ? (
            <p className="px-4 py-3 text-[11px] text-[#55556a]">No history yet.</p>
          ) : (
            <ul className="divide-y divide-white/[0.04]">
              {history.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setService(entry.service);
                      setMethod(entry.method);
                      setPresetId("");
                      setRequestText(formatJson(entry.request));
                      setShowHistory(false);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-white/[0.03] cursor-pointer"
                  >
                    <p className="text-[11px] font-mono text-[#c7c7d8]">
                      {entry.service}.{entry.method}
                      <span
                        className={
                          entry.ok ? " text-[#00d4aa]" : " text-[#ff7b5f]"
                        }
                      >
                        {" "}
                        · {entry.durationMs}ms
                      </span>
                    </p>
                    <p className="text-[10px] text-[#55556a] mt-0.5">
                      {new Date(entry.at).toLocaleString()}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}