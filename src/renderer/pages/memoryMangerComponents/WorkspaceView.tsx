import React from "react";
import {
  Save, Search, Brain, Loader2, CheckCircle2, XCircle, Info,
  Wifi, WifiOff, Pencil,
} from "lucide-react";
import type { MemoryEntry, Tab, RecallResult, AnalyzedFact } from "./types";
import { shortHex } from "./utils";

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
  { id: "remember", Icon: Save,   label: "Remember" },
  { id: "recall",   Icon: Search, label: "Recall"   },
  { id: "analyze",  Icon: Brain,  label: "Analyze"  },
] as const;

const LOG_STYLES = {
  success: { bg: "bg-[#00d4aa0f]", border: "border-l-[#00d4aa]", text: "text-[#00d4aa]" },
  error:   { bg: "bg-[#ff4d6d0f]", border: "border-l-[#ff4d6d]", text: "text-[#ff4d6d]" },
  info:    { bg: "bg-[#4ca3ff0f]", border: "border-l-[#4ca3ff]", text: "text-[#4ca3ff]" },
};

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#1e1e1e] border border-[#2a2a3c] rounded-[16px] p-5 ${className}`}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold text-[#555570] uppercase tracking-[1.2px] mb-3">
      {children}
    </p>
  );
}

function PrimaryBtn({
  onClick, disabled, loading: busy, children,
}: {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 bg-gradient-to-br from-[#6c63ff] to-[#5148d4] text-white rounded-[10px] px-4 py-2 text-[13px] font-semibold disabled:opacity-40 active:scale-[0.97] transition-transform"
    >
      {busy && <Loader2 size={13} className="animate-spin" />}
      {children}
    </button>
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
      <div className="max-w-[1100px] mx-auto px-6 py-16 text-center text-[#8888a0] text-[14px]">
        Select a memory fragment in the Manager.
      </div>
    );
  }

  const isOk = health === "ok";

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-8 pb-20 grid grid-cols-[280px_1fr] gap-6">

      {/* ── Sidebar ── */}
      <div className="flex flex-col gap-4">

        {/* Active fragment info */}
        <Card>
          <SectionLabel>Active Fragment</SectionLabel>
          <div className="text-[16px] font-semibold text-[#f0f0f5] mb-3">{entry.label}</div>

          {/* Health indicator */}
          <div className="flex items-center gap-2 mb-4">
            {isOk
              ? <Wifi size={13} className="text-[#00d4aa] shrink-0" />
              : <WifiOff size={13} className="text-[#ffb347] shrink-0" />}
            <span className={`text-[12px] ${isOk ? "text-[#00d4aa]" : "text-[#ffb347]"}`}>
              Relayer: {health || "connecting…"}
            </span>
          </div>

          {/* Namespace */}
          <p className="text-[11px] text-[#555570] mb-1.5">Namespace</p>
          <input
            value={entry.namespace}
            onChange={(e) => onNamespaceChange(e.target.value)}
            placeholder="default"
            className="w-full border border-[#2a2a3c] bg-[#111111] text-[#f0f0f5] rounded-[10px] px-3 py-2 text-[13px] outline-none focus:border-[#6c63ff] placeholder:text-[#555570] transition-colors"
          />
        </Card>

        {/* Log */}
        <Card>
          <SectionLabel>Log</SectionLabel>
          <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
            {log.length === 0 ? (
              <span className="text-[12px] text-[#555570]">No activity yet</span>
            ) : (
              log.map((l, i) => {
                const s = LOG_STYLES[l.type];
                return (
                  <div
                    key={i}
                    className={`text-[11px] font-mono px-2 py-1 rounded-[5px] leading-snug border-l-2 ${s.bg} ${s.border} ${s.text}`}
                  >
                    {l.msg}
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      {/* ── Main panel ── */}
      <div>
        {!isReady ? (
          <Card className="flex flex-col items-center justify-center py-16 text-center">
            <Loader2 size={32} className="text-[#6c63ff] animate-spin mb-4" />
            <div className="text-[#8888a0] text-[14px]">Connecting to relayer…</div>
          </Card>
        ) : (
          <>
            {/* Tab strip */}
            <div className="flex gap-1 mb-5 bg-[#1e1e1e] border border-[#2a2a3c] rounded-[12px] p-1">
              {TABS.map(({ id, Icon, label }) => {
                const active = tab === id;
                return (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[9px] text-[13px] font-medium transition-colors
                      ${active
                        ? "bg-[#6c63ff] text-white"
                        : "text-[#8888a0] hover:text-[#f0f0f5] hover:bg-[#2a2a3c]"}`}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                );
              })}
            </div>

            {/* ── Remember tab ── */}
            {tab === "remember" && (
              <Card>
                <div className="flex items-center gap-2 mb-1">
                  <Save size={16} className="text-[#6c63ff]" />
                  <span className="text-[16px] font-semibold text-[#f0f0f5]">Save Memory</span>
                </div>
                <p className="text-[13px] text-[#8888a0] mb-5 leading-relaxed">
                  Vectorized, encrypted, and stored in a decentralized manner on the Walrus network.
                </p>
                <textarea
                  value={rememberText}
                  onChange={(e) => setRememberText(e.target.value)}
                  placeholder="E.g.: The user works in TypeScript and prefers dark mode..."
                  rows={5}
                  className="w-full border border-[#2a2a3c] bg-[#111111] text-[#f0f0f5] rounded-[10px] px-3 py-2.5 text-[13px] outline-none focus:border-[#6c63ff] placeholder:text-[#555570] resize-y leading-relaxed mb-4 transition-colors"
                />
                <div className="flex items-center gap-3">
                  <PrimaryBtn onClick={handleRemember} disabled={loading || !rememberText.trim()} loading={loading}>
                    <Save size={13} /> Save to Walrus
                  </PrimaryBtn>
                  <span className="text-[12px] text-[#555570]">{rememberText.length} characters</span>
                </div>
              </Card>
            )}

            {/* ── Recall tab ── */}
            {tab === "recall" && (
              <Card>
                <div className="flex items-center gap-2 mb-1">
                  <Search size={16} className="text-[#6c63ff]" />
                  <span className="text-[16px] font-semibold text-[#f0f0f5]">Memory Recall</span>
                </div>
                <p className="text-[13px] text-[#8888a0] mb-5 leading-relaxed">
                  Using natural language queries based on semantic similarity.
                </p>
                <div className="flex gap-2 mb-5">
                  <input
                    value={recallQuery}
                    onChange={(e) => setRecallQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRecall()}
                    placeholder="What do we know about the user's preferences?"
                    className="flex-1 border border-[#2a2a3c] bg-[#111111] text-[#f0f0f5] rounded-[10px] px-3 py-2 text-[13px] outline-none focus:border-[#6c63ff] placeholder:text-[#555570] transition-colors"
                  />
                  <PrimaryBtn onClick={handleRecall} disabled={loading || !recallQuery.trim()} loading={loading}>
                    <Search size={13} /> Search
                  </PrimaryBtn>
                </div>

                {recallResults.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {recallResults.map((r, i) => {
                      const relevance = Math.round((1 - r.distance) * 100);
                      const isPrimary = r.distance < 0.3;
                      const isMid     = r.distance < 0.5;
                      return (
                        <div
                          key={i}
                          className="bg-[#161616] border border-[#2a2a3c] border-l-[3px] rounded-[12px] p-4"
                          style={{ borderLeftColor: isPrimary ? "#00d4aa" : isMid ? "#ffb347" : "#ff4d6d" }}
                        >
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-[11px] font-mono text-[#555570]">
                              {shortHex(r.blob_id || "", 8, 6)}
                            </span>
                            <span
                              className="text-[10px] font-bold uppercase tracking-[0.8px] px-2 py-[3px] rounded-[6px]"
                              style={
                                isPrimary ? { background: "#00d4aa1a", color: "#00d4aa" }
                                : isMid   ? { background: "#ffb3471a", color: "#ffb347" }
                                :           { background: "#ff4d6d1a", color: "#ff4d6d" }
                              }
                            >
                              {relevance}% relevance
                            </span>
                          </div>
                          <div className="text-[14px] text-[#f0f0f5] leading-relaxed">{r.text}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  !loading && (
                    <div className="text-center py-10 text-[#555570] text-[14px]">
                      Enter a query to search
                    </div>
                  )
                )}
              </Card>
            )}

            {/* ── Analyze tab ── */}
            {tab === "analyze" && (
              <Card>
                <div className="flex items-center gap-2 mb-1">
                  <Brain size={16} className="text-[#6c63ff]" />
                  <span className="text-[16px] font-semibold text-[#f0f0f5]">Analyze Text</span>
                </div>
                <p className="text-[13px] text-[#8888a0] mb-5 leading-relaxed">
                  The AI extracts facts and saves each one as a separate memory.
                </p>
                <textarea
                  value={analyzeText}
                  onChange={(e) => setAnalyzeText(e.target.value)}
                  placeholder="E.g.: Peter is a 32-year-old developer from Budapest. He uses TypeScript and React..."
                  rows={5}
                  className="w-full border border-[#2a2a3c] bg-[#111111] text-[#f0f0f5] rounded-[10px] px-3 py-2.5 text-[13px] outline-none focus:border-[#6c63ff] placeholder:text-[#555570] resize-y leading-relaxed mb-4 transition-colors"
                />
                <PrimaryBtn onClick={handleAnalyze} disabled={loading || !analyzeText.trim()} loading={loading}>
                  <Brain size={13} /> Analyze &amp; Save
                </PrimaryBtn>

                {analyzeFacts.length > 0 && (
                  <div className="mt-5">
                    <p className="text-[12px] font-semibold text-[#555570] mb-3">
                      Extracted facts ({analyzeFacts.length} items)
                    </p>
                    <div className="flex flex-col gap-2">
                      {analyzeFacts.map((f, i) => (
                        <div
                          key={i}
                          className="bg-[#161616] border border-[#2a2a3c] border-l-[3px] border-l-[#00d4aa] rounded-[10px] px-4 py-2.5 text-[14px] text-[#f0f0f5] leading-relaxed"
                        >
                          <span className="text-[#00d4aa] font-bold mr-2">#{i + 1}</span>
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