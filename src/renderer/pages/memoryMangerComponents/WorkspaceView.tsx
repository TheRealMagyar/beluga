import {
  Save, Search, Brain, Loader2, CheckCircle2, XCircle, Info,
  Wifi, WifiOff,
} from "lucide-react";
import type { MemoryEntry, Tab, RecallResult, AnalyzedFact } from "./types";
import { shortHex } from "./utils";
import { NetworkBadge, PrimaryButton } from "./memory-ui";

interface WorkspaceViewProps {
  entry: MemoryEntry | null;
  isReady: boolean;
  tab: Tab;
  setTab: (t: Tab) => void;
  rememberText: string;
  setRememberText: (s: string) => void;
  recallQuery: string;
  setRecallQuery: (s: string) => void;
  analyzeText: string;
  setAnalyzeText: (s: string) => void;
  recallResults: RecallResult[];
  analyzeFacts: AnalyzedFact[];
  loading: boolean;
  health: string | null;
  log: { type: "info" | "success" | "error"; msg: string }[];
  handleRemember: () => void;
  handleRecall: () => void;
  handleAnalyze: () => void;
  onNamespaceChange: (ns: string) => void;
}

const TABS = [
  { id: "remember", Icon: Save, label: "Remember" },
  { id: "recall", Icon: Search, label: "Recall" },
  { id: "analyze", Icon: Brain, label: "Analyze" },
] as const;

const LOG_STYLES = {
  success: { bg: "bg-[#00d4aa0f]", text: "text-[#00d4aa]", Icon: CheckCircle2 },
  error: { bg: "bg-[#ff4d6d0f]", text: "text-[#ff4d6d]", Icon: XCircle },
  info: { bg: "bg-[#6c63ff0f]", text: "text-[#9d97ff]", Icon: Info },
};

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-[#2a2a2a] bg-[#1e1e1e] p-5 ${className}`}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold text-[#55556a] uppercase tracking-[1px] mb-3">
      {children}
    </p>
  );
}

function RelevanceBadge({ distance }: { distance: number }) {
  const relevance = Math.round((1 - distance) * 100);
  const isPrimary = distance < 0.3;
  const isMid = distance < 0.5;
  const tone = isPrimary ? "ok" : isMid ? "warn" : "error";
  const styles = {
    ok: "border-[#00d4aa]/30 text-[#00d4aa] bg-[#00d4aa]/10",
    warn: "border-[#ffb347]/30 text-[#ffb347] bg-[#ffb347]/10",
    error: "border-[#ff4d6d]/30 text-[#ff8fa3] bg-[#ff4d6d]/10",
  }[tone];

  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${styles}`}>
      {relevance}% match
    </span>
  );
}

export function WorkspaceView({
  entry, isReady, tab, setTab,
  rememberText, setRememberText,
  recallQuery, setRecallQuery,
  analyzeText, setAnalyzeText,
  recallResults, analyzeFacts,
  loading, health, log,
  handleRemember, handleRecall, handleAnalyze,
  onNamespaceChange,
}: WorkspaceViewProps) {
  if (!entry) {
    return (
      <div className="flex items-center justify-center py-24 text-[#8888a0] text-[14px]">
        Select a memory fragment to open the workspace.
      </div>
    );
  }

  const isOk = health === "ok";

  return (
    <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5 packages-panel-in">

      {/* Sidebar */}
      <div className="flex flex-col gap-4">
        <Card>
          <SectionLabel>Fragment</SectionLabel>
          <div className="text-[15px] font-semibold text-[#f0f0f5] mb-2 truncate">
            {entry.label}
          </div>
          <div className="mb-4">
            <NetworkBadge network={entry.network} />
          </div>

          <div className="flex items-center gap-2 mb-4 rounded-xl border border-[#2a2a2a] bg-[#161616]/80 px-3 py-2">
            {isOk ? (
              <Wifi size={13} className="text-[#00d4aa] shrink-0" />
            ) : (
              <WifiOff size={13} className="text-[#ffb347] shrink-0" />
            )}
            <span className={`text-[11px] ${isOk ? "text-[#00d4aa]" : "text-[#ffb347]"}`}>
              Relayer: {health || "connecting…"}
            </span>
          </div>

          <p className="text-[10px] text-[#55556a] mb-1.5">Namespace</p>
          <input
            value={entry.namespace}
            onChange={(e) => onNamespaceChange(e.target.value)}
            placeholder="default"
            className="w-full border border-[#2a2a2a] bg-[#161616] text-[#f0f0f5] rounded-xl px-3 py-2 text-[13px] outline-none focus:border-[#6c63ff]/50 placeholder:text-[#55556a]"
          />
        </Card>

        <Card className="flex-1 min-h-0">
          <SectionLabel>Activity log</SectionLabel>
          <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto scrollbar-none">
            {log.length === 0 ? (
              <span className="text-[11px] text-[#55556a]">No activity yet</span>
            ) : (
              log.map((l, i) => {
                const s = LOG_STYLES[l.type];
                const LogIcon = s.Icon;
                return (
                  <div
                    key={i}
                    className={`flex items-start gap-2 text-[11px] font-mono px-2.5 py-1.5 rounded-lg leading-snug ${s.bg} ${s.text}`}
                  >
                    <LogIcon size={12} className="shrink-0 mt-0.5 opacity-80" />
                    <span className="break-words">{l.msg}</span>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      {/* Main panel */}
      <div>
        {!isReady ? (
          <Card className="flex flex-col items-center justify-center py-20 text-center">
            <Loader2 size={28} className="text-[#6c63ff] animate-spin mb-4" />
            <div className="text-[#8888a0] text-[13px]">Connecting to relayer…</div>
          </Card>
        ) : (
          <>
            <div className="flex gap-1 mb-5 rounded-xl border border-[#2a2a2a] bg-[#1e1e1e] p-1">
              {TABS.map(({ id, Icon, label }) => {
                const active = tab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-medium cursor-pointer ${
                      active
                        ? "bg-[#6c63ff]/20 text-[#b8b0ff] border border-[#6c63ff]/30"
                        : "text-[#8888a0] hover:text-[#f0f0f5] hover:bg-white/[0.03] border border-transparent"
                    }`}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                );
              })}
            </div>

            {tab === "remember" && (
              <Card>
                <div className="flex items-center gap-2 mb-1">
                  <Save size={16} className="text-[#6c63ff]" />
                  <span className="text-[15px] font-semibold text-[#f0f0f5]">Save Memory</span>
                </div>
                <p className="text-[12px] text-[#8888a0] mb-5 leading-relaxed">
                  Vectorized, encrypted, and stored on the Walrus network.
                </p>
                <textarea
                  value={rememberText}
                  onChange={(e) => setRememberText(e.target.value)}
                  placeholder="E.g.: The user works in TypeScript and prefers dark mode..."
                  rows={5}
                  className="w-full border border-[#2a2a2a] bg-[#161616] text-[#f0f0f5] rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#6c63ff]/50 placeholder:text-[#55556a] resize-y leading-relaxed mb-4"
                />
                <div className="flex items-center gap-3">
                  <PrimaryButton
                    onClick={handleRemember}
                    disabled={loading || !rememberText.trim()}
                    loading={loading}
                    tone="blue"
                    className="!border-[#6c63ff]/40 !bg-[#6c63ff]/20 !text-[#b8b0ff] hover:!bg-[#6c63ff]/28"
                  >
                    <Save size={13} /> Save to Walrus
                  </PrimaryButton>
                  <span className="text-[11px] text-[#55556a]">{rememberText.length} characters</span>
                </div>
              </Card>
            )}

            {tab === "recall" && (
              <Card>
                <div className="flex items-center gap-2 mb-1">
                  <Search size={16} className="text-[#6c63ff]" />
                  <span className="text-[15px] font-semibold text-[#f0f0f5]">Memory Recall</span>
                </div>
                <p className="text-[12px] text-[#8888a0] mb-5 leading-relaxed">
                  Search using natural language queries based on semantic similarity.
                </p>
                <div className="flex gap-2 mb-5">
                  <input
                    value={recallQuery}
                    onChange={(e) => setRecallQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRecall()}
                    placeholder="What do we know about the user's preferences?"
                    className="flex-1 border border-[#2a2a2a] bg-[#161616] text-[#f0f0f5] rounded-xl px-3 py-2 text-[13px] outline-none focus:border-[#6c63ff]/50 placeholder:text-[#55556a]"
                  />
                  <PrimaryButton
                    onClick={handleRecall}
                    disabled={loading || !recallQuery.trim()}
                    loading={loading}
                    tone="blue"
                    className="!border-[#6c63ff]/40 !bg-[#6c63ff]/20 !text-[#b8b0ff] hover:!bg-[#6c63ff]/28"
                  >
                    <Search size={13} /> Search
                  </PrimaryButton>
                </div>

                {recallResults.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {recallResults.map((r, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-[#2a2a2a] bg-[#161616]/80 p-4"
                      >
                        <div className="flex justify-between items-center gap-2 mb-2">
                          <span className="text-[10px] font-mono text-[#55556a]">
                            {shortHex(r.blob_id || "", 8, 6)}
                          </span>
                          <RelevanceBadge distance={r.distance} />
                        </div>
                        <div className="text-[13px] text-[#f0f0f5] leading-relaxed">{r.text}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  !loading && (
                    <div className="text-center py-10 text-[#55556a] text-[13px]">
                      Enter a query to search
                    </div>
                  )
                )}
              </Card>
            )}

            {tab === "analyze" && (
              <Card>
                <div className="flex items-center gap-2 mb-1">
                  <Brain size={16} className="text-[#6c63ff]" />
                  <span className="text-[15px] font-semibold text-[#f0f0f5]">Analyze Text</span>
                </div>
                <p className="text-[12px] text-[#8888a0] mb-5 leading-relaxed">
                  The AI extracts facts and saves each one as a separate memory.
                </p>
                <textarea
                  value={analyzeText}
                  onChange={(e) => setAnalyzeText(e.target.value)}
                  placeholder="E.g.: Peter is a 32-year-old developer from Budapest. He uses TypeScript and React..."
                  rows={5}
                  className="w-full border border-[#2a2a2a] bg-[#161616] text-[#f0f0f5] rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#6c63ff]/50 placeholder:text-[#55556a] resize-y leading-relaxed mb-4"
                />
                <PrimaryButton
                  onClick={handleAnalyze}
                  disabled={loading || !analyzeText.trim()}
                  loading={loading}
                  tone="blue"
                  className="!border-[#6c63ff]/40 !bg-[#6c63ff]/20 !text-[#b8b0ff] hover:!bg-[#6c63ff]/28"
                >
                  <Brain size={13} /> Analyze &amp; Save
                </PrimaryButton>

                {analyzeFacts.length > 0 && (
                  <div className="mt-5">
                    <p className="text-[11px] font-semibold text-[#55556a] mb-3">
                      Extracted facts ({analyzeFacts.length})
                    </p>
                    <div className="flex flex-col gap-2">
                      {analyzeFacts.map((f, i) => (
                        <div
                          key={i}
                          className="rounded-xl border border-[#2a2a2a] bg-[#161616]/80 px-4 py-2.5 text-[13px] text-[#f0f0f5] leading-relaxed"
                        >
                          <span className="text-[#6c63ff] font-semibold mr-2">#{i + 1}</span>
                          {f.text}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}