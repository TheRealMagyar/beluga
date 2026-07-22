import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_SUI_USDC_STRATEGY_ID,
  getStrategyById,
  loadActiveStrategyId,
  loadStrategies,
  resolveStrategyMemoryCredentials,
  saveActiveStrategyId,
  strategyToPromptBlock,
  type TradingStrategy,
} from "./tradingStrategyShared";

export type AgentLogKind =
  | "system"
  | "thought"
  | "tool"
  | "result"
  | "text"
  | "error"
  | "schedule"
  | "summary";

export interface AgentLogEntry {
  id: string;
  ts: number;
  kind: AgentLogKind;
  title?: string;
  body: string;
}

type AgentMode = "demo" | "analysis" | "live";

interface TradingAgentPanelProps {
  market: string;
  timeframe: string;
  /** When demo/default strategy runs, ask chart to switch TF (e.g. 1s). */
  onPreferTimeframe?: (tf: string) => void;
}

interface DemoSummary {
  durationMin: number;
  startingSui: number;
  startingSpotUsd: number;
  startingEquityUsd: number;
  endingBalances: Record<string, number>;
  endingEquityUsd: number;
  pnlUsd: number;
  pnlPct: number;
  tradeCount: number;
  longCount: number;
  shortCount: number;
  swapCount: number;
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatUsd(n: number) {
  if (!Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

export function TradingAgentPanel({
  market,
  timeframe,
  onPreferTimeframe,
}: TradingAgentPanelProps) {
  const [strategies, setStrategies] = useState<TradingStrategy[]>([]);
  const [strategyId, setStrategyId] = useState<string | null>(
    DEFAULT_SUI_USDC_STRATEGY_ID,
  );
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<AgentMode>("demo");
  const [defaultInterval, setDefaultInterval] = useState(45);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [plan, setPlan] = useState("");
  const [logs, setLogs] = useState<AgentLogEntry[]>([]);
  const [userNote, setUserNote] = useState("");
  const [demoEquity, setDemoEquity] = useState<number | null>(null);
  const [demoBalances, setDemoBalances] = useState<Record<string, number> | null>(
    null,
  );
  const [summary, setSummary] = useState<DemoSummary | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [memReport, setMemReport] = useState<{
    statsText: string;
    totalUnique: number;
    byKind: Record<string, number>;
    memoryLabel: string;
    outcomes: Array<{ relevance: number; text: string }>;
    mistakes: Array<{ relevance: number; text: string }>;
    improvements: Array<{ relevance: number; text: string }>;
    setups: Array<{ relevance: number; text: string }>;
    risk: Array<{ relevance: number; text: string }>;
  } | null>(null);
  const [memAiText, setMemAiText] = useState("");
  const [memAnalyzing, setMemAnalyzing] = useState(false);
  const memRequestIdRef = useRef<string | null>(null);

  const sessionIdRef = useRef(`ta-${uid()}`);
  const requestIdRef = useRef<string | null>(null);
  const runningRef = useRef(false);
  const modeRef = useRef<AgentMode>("demo");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const streamBufRef = useRef("");
  const runTickRef = useRef<() => Promise<void>>(async () => {});

  const strategy = useMemo(
    () =>
      getStrategyById(strategyId) ||
      strategies.find((s) => s.id === strategyId) ||
      null,
    [strategyId, strategies],
  );

  const memoryCreds = useMemo(
    () => resolveStrategyMemoryCredentials(strategy),
    [strategy],
  );

  const pushLog = useCallback((entry: Omit<AgentLogEntry, "id" | "ts">) => {
    setLogs((prev) => [
      ...prev.slice(-200),
      { id: uid(), ts: Date.now(), ...entry },
    ]);
  }, []);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    const refresh = () => {
      setStrategies(loadStrategies());
      const active = loadActiveStrategyId();
      if (active) setStrategyId(active);
    };
    refresh();
    const id = setInterval(refresh, 2500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    saveActiveStrategyId(strategyId);
  }, [strategyId]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  const clearTimers = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setCountdown(null);
  };

  const refreshDemoSnap = useCallback(async () => {
    if (modeRef.current !== "demo") return;
    try {
      const snap = await window.belugaAi?.tradingAgentDemoSnapshot?.(
        sessionIdRef.current,
      );
      if (snap?.ok) {
        if (snap.equityUsd != null) setDemoEquity(snap.equityUsd);
        if (snap.balances) setDemoBalances(snap.balances);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const scheduleTick = useCallback(
    (seconds: number) => {
      clearTimers();
      const sec = Math.max(15, Math.min(900, Math.floor(seconds)));
      setCountdown(sec);
      pushLog({
        kind: "schedule",
        title: "Next tick",
        body: `Self-scheduled in ${sec}s`,
      });

      let left = sec;
      countdownRef.current = setInterval(() => {
        left -= 1;
        setCountdown(left);
        if (left <= 0 && countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
      }, 1000);

      timerRef.current = setTimeout(() => {
        if (runningRef.current) void runTickRef.current();
      }, sec * 1000);
    },
    [pushLog],
  );

  const runTick = useCallback(
    async (userMessage?: string) => {
      if (!window.belugaAi?.tradingAgentTick) {
        pushLog({
          kind: "error",
          body: "Trading agent IPC missing — restart the app.",
        });
        return;
      }
      if (busy && !userMessage) return;

      const stratBlock = strategy
        ? strategyToPromptBlock(strategy)
        : "(No strategy loaded — trade conservatively.)";

      const requestId = uid();
      requestIdRef.current = requestId;
      streamBufRef.current = "";
      setBusy(true);

      const m = modeRef.current;
      pushLog({
        kind: "system",
        title: "Tick start",
        body: `${market} · ${timeframe} · ${m.toUpperCase()} · strategy: ${strategy?.name || "none"}`,
      });

      try {
        const res = await window.belugaAi.tradingAgentTick({
          requestId,
          sessionId: sessionIdRef.current,
          strategyBlock: stratBlock,
          market,
          timeframe: strategy?.timeframe || timeframe,
          mode: m,
          paperMode: m === "analysis",
          userMessage,
          strategyId: strategy?.id,
          memoryCredentials: memoryCreds,
          stopLossPct: strategy?.stopLoss,
          takeProfitPct: strategy?.takeProfit,
        });
        if (!res.ok) {
          setBusy(false);
        }
      } catch (e) {
        setBusy(false);
        pushLog({
          kind: "error",
          body: e instanceof Error ? e.message : String(e),
        });
      }
    },
    [busy, market, memoryCreds, pushLog, strategy, timeframe],
  );

  runTickRef.current = () => runTick();

  useEffect(() => {
    const unsubChunk = window.belugaAi?.onStreamChunk?.((payload) => {
      if (payload.requestId === memRequestIdRef.current) {
        setMemAiText((prev) => prev + payload.delta);
        return;
      }
      if (payload.requestId !== requestIdRef.current) return;
      streamBufRef.current += payload.delta;
    });

    const unsubTool = window.belugaAi?.onToolCall?.((payload) => {
      if (payload.requestId !== requestIdRef.current) return;
      if (streamBufRef.current.trim()) {
        pushLog({
          kind: "text",
          title: "Agent",
          body: streamBufRef.current.trim(),
        });
        streamBufRef.current = "";
      }
      const isThink = payload.toolName === "trade_think";
      pushLog({
        kind: isThink ? "thought" : "tool",
        title: isThink
          ? "Thought"
          : payload.toolName.replace(/^trade_/, ""),
        body: isThink
          ? String(payload.args?.thought ?? payload.argsDisplay)
          : payload.argsDisplay,
      });
    });

    const unsubResult = window.belugaAi?.onToolResult?.((payload) => {
      if (payload.requestId !== requestIdRef.current) return;
      if (payload.toolName === "trade_think") return;
      let preview = payload.result;
      try {
        const j = JSON.parse(payload.result) as {
          data?: {
            equityUsd?: number;
            balances?: Record<string, number>;
          };
        };
        preview = JSON.stringify(j, null, 0).slice(0, 500);
        if (j?.data?.equityUsd != null) setDemoEquity(j.data.equityUsd);
        if (j?.data?.balances) setDemoBalances(j.data.balances);
      } catch {
        preview = payload.result.slice(0, 500);
      }
      pushLog({
        kind: "result",
        title: `↳ ${payload.toolName.replace(/^trade_/, "")}`,
        body: preview,
      });
      if (
        payload.toolName.includes("open_") ||
        payload.toolName === "trade_swap" ||
        payload.toolName === "trade_get_demo_account"
      ) {
        void refreshDemoSnap();
      }
    });

    const unsubDone = window.belugaAi?.onStreamDone?.((payload) => {
      if (payload.requestId === memRequestIdRef.current) {
        memRequestIdRef.current = null;
        setMemAnalyzing(false);
        return;
      }
      if (payload.requestId !== requestIdRef.current) return;
      if (streamBufRef.current.trim()) {
        pushLog({
          kind: "text",
          title: "Agent",
          body: streamBufRef.current.trim(),
        });
        streamBufRef.current = "";
      }
      requestIdRef.current = null;
      setBusy(false);

      const meta = payload.tradingMeta;
      if (meta?.plan) setPlan(meta.plan);
      void refreshDemoSnap();

      if (!runningRef.current) return;

      if (meta?.stopped) {
        setRunning(false);
        runningRef.current = false;
        clearTimers();
        pushLog({
          kind: "system",
          title: "Stopped",
          body: "Agent called trade_stop",
        });
        if (modeRef.current === "demo") {
          void finalizeDemo();
        }
        return;
      }

      const next =
        meta?.nextTickSeconds != null && meta.nextTickSeconds > 0
          ? meta.nextTickSeconds
          : defaultInterval;
      scheduleTick(next);
    });

    const unsubErr = window.belugaAi?.onStreamError?.((payload) => {
      if (payload.requestId === memRequestIdRef.current) {
        memRequestIdRef.current = null;
        setMemAnalyzing(false);
        setMemAiText((t) => t || payload.message);
        return;
      }
      if (payload.requestId !== requestIdRef.current) return;
      requestIdRef.current = null;
      setBusy(false);
      pushLog({ kind: "error", body: payload.message });
      if (runningRef.current) {
        scheduleTick(Math.max(defaultInterval, 45));
      }
    });

    return () => {
      unsubChunk?.();
      unsubTool?.();
      unsubResult?.();
      unsubDone?.();
      unsubErr?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultInterval, pushLog, scheduleTick, refreshDemoSnap]);

  useEffect(() => {
    return () => {
      clearTimers();
      if (requestIdRef.current) {
        void window.belugaAi?.abort?.(requestIdRef.current);
      }
    };
  }, []);

  const finalizeDemo = async () => {
    try {
      const res = await window.belugaAi?.tradingAgentDemoSummary?.(
        sessionIdRef.current,
      );
      if (!res?.ok || !res.summary) {
        pushLog({
          kind: "error",
          body: res?.error || "Could not build demo summary",
        });
        return;
      }
      const s = res.summary as DemoSummary;
      setSummary(s);
      setShowSummary(true);
      setDemoEquity(s.endingEquityUsd);
      setDemoBalances(s.endingBalances);

      const lines = [
        `Duration: ~${s.durationMin} min`,
        `Start: ${s.startingSui} SUI @ $${s.startingSpotUsd.toFixed(4)} = ${formatUsd(s.startingEquityUsd)}`,
        `End equity: ${formatUsd(s.endingEquityUsd)}`,
        `PnL: ${formatUsd(s.pnlUsd)} (${s.pnlPct >= 0 ? "+" : ""}${s.pnlPct.toFixed(2)}%)`,
        `Trades: ${s.tradeCount} (L ${s.longCount} / S ${s.shortCount} / swap ${s.swapCount})`,
        `Balances: ${Object.entries(s.endingBalances)
          .map(([k, v]) => `${k}=${Number(v).toPrecision(5)}`)
          .join(" · ")}`,
      ];
      pushLog({
        kind: "summary",
        title: "Demo summary",
        body: lines.join("\n"),
      });

      // Persist postmortem to Walrus if strategy has memory linked
      if (memoryCreds.length > 0 && window.belugaAi?.tradingAgentRemember) {
        const note = [
          `Demo postmortem for strategy ${strategy?.name || strategyId}`,
          `PnL ${s.pnlUsd >= 0 ? "+" : ""}${s.pnlUsd.toFixed(2)} USD (${s.pnlPct.toFixed(2)}%)`,
          `Trades: ${s.tradeCount} (L${s.longCount}/S${s.shortCount}/swap${s.swapCount})`,
          `Duration ~${s.durationMin} min · start equity $${s.startingEquityUsd.toFixed(2)} → $${s.endingEquityUsd.toFixed(2)}`,
          `Ending balances: ${JSON.stringify(s.endingBalances)}`,
          "Lessons: review scalp timing, size, and which micro-setups worked; improve entry confluence next run.",
        ].join("\n");
        try {
          const memRes = await window.belugaAi.tradingAgentRemember({
            sessionId: sessionIdRef.current,
            text: note,
            kind: "outcome",
            strategyId: strategy?.id,
            memoryCredentials: memoryCreds,
          });
          pushLog({
            kind: "system",
            title: "Walrus remember",
            body: memRes?.text?.slice(0, 200) || "Saved demo postmortem",
          });
        } catch (err) {
          pushLog({
            kind: "error",
            body: `Memory save failed: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      }
    } catch (e) {
      pushLog({
        kind: "error",
        body: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const startDemo = async () => {
    if (!window.belugaAi?.tradingAgentStartDemo) {
      pushLog({
        kind: "error",
        body: "Demo IPC missing — restart the app.",
      });
      return;
    }

    setSummary(null);
    setShowSummary(false);
    setMode("demo");
    modeRef.current = "demo";
    setDefaultInterval(20);
    setStrategyId(DEFAULT_SUI_USDC_STRATEGY_ID);
    saveActiveStrategyId(DEFAULT_SUI_USDC_STRATEGY_ID);
    onPreferTimeframe?.("1s");

    // Fresh session for clean ledger
    if (requestIdRef.current) {
      await window.belugaAi.abort?.(requestIdRef.current);
      requestIdRef.current = null;
    }
    clearTimers();
    await window.belugaAi.tradingAgentReset?.(sessionIdRef.current);
    sessionIdRef.current = `ta-${uid()}`;

    const res = await window.belugaAi.tradingAgentStartDemo({
      sessionId: sessionIdRef.current,
      initialSui: 100,
    });

    if (!res.ok) {
      pushLog({ kind: "error", body: res.error || "Failed to start demo" });
      return;
    }

    setDemoEquity(res.equityUsd ?? null);
    setDemoBalances(
      (res.demo as { balances?: Record<string, number> })?.balances ?? {
        SUI: 100,
        USDC: 0,
      },
    );

    setLogs([]);
    pushLog({
      kind: "system",
      title: "Demo started",
      body: `Virtual 100 SUI · 1s scalp · equity ≈ ${formatUsd(res.equityUsd ?? 0)} · ${
        memoryCreds.length
          ? `memory: ${memoryCreds[0].label} (auto-remember on fills)`
          : "⚠ no memory linked — Strategy → Link memory so trades are saved"
      }`,
    });

    setRunning(true);
    runningRef.current = true;
    await runTick(
      "DEMO start: 1s chart scalp mode. Max hold 1–2 minutes per trade. You have 100 SUI virtual. Analyze 1s/1m, take micro long/short, exit quickly, schedule_next every 15–30s, trade_get_demo_account after fills.",
    );
  };

  const runMemoryAnalyze = async () => {
    if (!window.belugaAi?.tradingMemoryAnalyze) {
      pushLog({
        kind: "error",
        body: "Memory analyze IPC missing — restart the app.",
      });
      return;
    }
    if (!memoryCreds.length) {
      pushLog({
        kind: "error",
        body: "No memory linked. Open Strategy → Link memory first.",
      });
      return;
    }

    setMode("analysis");
    modeRef.current = "analysis";
    setMemAnalyzing(true);
    setMemAiText("");
    setMemReport(null);

    const requestId = uid();
    memRequestIdRef.current = requestId;

    pushLog({
      kind: "system",
      title: "Memory analyze",
      body: `Pulling notes from ${memoryCreds.map((m) => m.label).join(", ")}…`,
    });

    try {
      const res = await window.belugaAi.tradingMemoryAnalyze({
        requestId,
        strategyBlock: strategy
          ? strategyToPromptBlock(strategy)
          : "SUI/USDC strategy",
        strategyName: strategy?.name,
        memoryCredentials: memoryCreds,
        withAiSummary: true,
      });

      if (!res.ok) {
        setMemAnalyzing(false);
        memRequestIdRef.current = null;
        pushLog({ kind: "error", body: res.error || "Analyze failed" });
        return;
      }

      if (res.report) {
        setMemReport({
          statsText: res.report.statsText,
          totalUnique: res.report.totalUnique,
          byKind: res.report.byKind,
          memoryLabel: res.report.memoryLabel,
          outcomes: res.report.outcomes,
          mistakes: res.report.mistakes,
          improvements: res.report.improvements,
          setups: res.report.setups,
          risk: res.report.risk,
        });
        pushLog({
          kind: "summary",
          title: "Memory stats",
          body: res.report.statsText,
        });
      }

      if (!res.aiStreaming) {
        setMemAnalyzing(false);
        memRequestIdRef.current = null;
        if (res.aiSkipped) {
          pushLog({
            kind: "system",
            title: "AI summary skipped",
            body: res.aiSkipped,
          });
        }
        if (res.report?.totalUnique === 0) {
          setMemAiText(
            "No notes in this strategy memory yet. Run Demo with memory linked so the agent can trade_remember lessons.",
          );
        }
      }
    } catch (e) {
      setMemAnalyzing(false);
      memRequestIdRef.current = null;
      pushLog({
        kind: "error",
        body: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const startAgent = async () => {
    if (mode === "demo" && !demoBalances) {
      await startDemo();
      return;
    }
    setRunning(true);
    runningRef.current = true;
    pushLog({
      kind: "system",
      title: "Agent started",
      body:
        mode === "demo"
          ? "DEMO — virtual fills on real prices"
          : mode === "analysis"
            ? "Analysis only — no trades"
            : "LIVE — T2000 on-chain",
    });
    await runTick();
  };

  const stopAgent = async () => {
    const wasDemo = modeRef.current === "demo";
    setRunning(false);
    runningRef.current = false;
    clearTimers();
    if (requestIdRef.current) {
      await window.belugaAi?.abort?.(requestIdRef.current);
      requestIdRef.current = null;
    }
    setBusy(false);
    pushLog({
      kind: "system",
      title: "Agent stopped",
      body: "User stopped the loop",
    });
    if (wasDemo) {
      await finalizeDemo();
    }
  };

  const resetSession = async () => {
    await stopAgent();
    await window.belugaAi?.tradingAgentReset?.(sessionIdRef.current);
    sessionIdRef.current = `ta-${uid()}`;
    setPlan("");
    setLogs([]);
    setDemoEquity(null);
    setDemoBalances(null);
    setSummary(null);
    setShowSummary(false);
    pushLog({ kind: "system", body: "Session reset" });
  };

  const sendNote = async () => {
    const note = userNote.trim();
    if (!note) return;
    setUserNote("");
    pushLog({ kind: "system", title: "You", body: note });
    if (!running) {
      setRunning(true);
      runningRef.current = true;
    }
    await runTick(note);
  };

  const kindColor = (k: AgentLogKind) => {
    switch (k) {
      case "thought":
        return "text-[#c4b5fd] border-[#a78bfa]/25";
      case "tool":
        return "text-[#7dd3fc] border-[#38bdf8]/25";
      case "result":
        return "text-[#86efac] border-[#0ecb81]/20";
      case "error":
        return "text-[#fca5a5] border-[#f6465d]/30";
      case "schedule":
        return "text-[#fcd34d] border-[#fbbf24]/25";
      case "summary":
        return "text-[#fde68a] border-[#fbbf24]/40 bg-[#fbbf24]/05";
      case "text":
        return "text-[#e8e8f0] border-white/[0.08]";
      default:
        return "text-[#8888a0] border-white/[0.06]";
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 border-b border-white/[0.06] p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#e8e8f0]">AI Agent</span>
          <span
            className={`flex items-center gap-1 text-[10px] ${
              running ? "text-[#0ecb81]" : "text-[#55556a]"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                running ? "animate-pulse bg-[#0ecb81]" : "bg-[#333]"
              }`}
            />
            {running
              ? busy
                ? "thinking…"
                : countdown != null
                  ? `${countdown}s`
                  : "idle"
              : "off"}
          </span>
        </div>

        <select
          value={strategyId ?? DEFAULT_SUI_USDC_STRATEGY_ID}
          onChange={(e) => setStrategyId(e.target.value || DEFAULT_SUI_USDC_STRATEGY_ID)}
          className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-xs text-[#e8e8f0] outline-none"
        >
          {strategies.map((s) => (
            <option key={s.id} value={s.id}>
              {s.isDefault ? "★ " : ""}
              {s.name} · {s.timeframe}
            </option>
          ))}
        </select>

        {strategy && (
          <div className="rounded-md border border-white/[0.05] bg-white/[0.02] px-2 py-1.5 text-[10px] leading-snug text-[#6b6b80]">
            <span className="text-[#a8a8c0]">{strategy.name}</span>
            {strategy.symbols.length > 0 && (
              <span> · {strategy.symbols.join(", ")}</span>
            )}
            <div className="mt-0.5">
              {memoryCreds.length > 0 ? (
                <span className="text-[#00d4aa]">
                  🧠 {memoryCreds[0].label}
                </span>
              ) : (
                <span className="text-[#555]">
                  No Walrus memory — link on Strategy page
                </span>
              )}
            </div>
          </div>
        )}

        {/* Mode */}
        <div className="flex gap-0.5 rounded-lg bg-white/[0.03] p-0.5">
          {(
            [
              ["demo", "Demo"],
              ["analysis", "Analyze"],
              ["live", "Live"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              disabled={running}
              onClick={() => setMode(id)}
              className={`flex-1 rounded-md py-1 text-[10px] font-semibold disabled:opacity-50 ${
                mode === id
                  ? id === "demo"
                    ? "bg-[#fbbf24]/20 text-[#fbbf24]"
                    : id === "live"
                      ? "bg-[#f6465d]/20 text-[#f87171]"
                      : "bg-[#4ca3ff]/15 text-[#4ca3ff]"
                  : "text-[#666] hover:text-[#aaa]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "demo" && (demoEquity != null || demoBalances) && (
          <div className="rounded-lg border border-[#fbbf24]/25 bg-[#fbbf24]/08 px-2 py-1.5 font-mono text-[10px] text-[#fde68a]">
            <div className="flex justify-between">
              <span>Demo equity</span>
              <span className="font-semibold">
                {demoEquity != null ? formatUsd(demoEquity) : "—"}
              </span>
            </div>
            {demoBalances && (
              <div className="mt-0.5 text-[9px] opacity-80">
                {Object.entries(demoBalances)
                  .filter(([, v]) => Math.abs(v) > 1e-8)
                  .map(([k, v]) => `${k} ${Number(v).toPrecision(4)}`)
                  .join(" · ")}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 text-[10px] text-[#555]">
          <label className="flex items-center gap-1">
            Interval
            <input
              type="number"
              min={15}
              max={900}
              value={defaultInterval}
              onChange={(e) => setDefaultInterval(Number(e.target.value) || 45)}
              className="w-14 rounded border border-white/[0.08] bg-transparent px-1 py-0.5 font-mono text-[10px] text-[#ccc]"
            />
            s
          </label>
        </div>

        {/* Primary actions */}
        {mode === "analysis" ? (
          <button
            type="button"
            onClick={() => void runMemoryAnalyze()}
            disabled={memAnalyzing || !memoryCreds.length}
            className="w-full rounded-lg bg-gradient-to-r from-[#6c63ff] to-[#4ca3ff] py-2 text-xs font-bold text-white shadow-sm hover:brightness-105 disabled:opacity-40"
          >
            {memAnalyzing
              ? "Analyzing memory…"
              : memoryCreds.length
                ? "Analyze memory"
                : "Link memory first"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void startDemo()}
            disabled={busy && running}
            className="w-full rounded-lg bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] py-2 text-xs font-bold text-[#1a1400] shadow-sm hover:brightness-105 disabled:opacity-40"
          >
            Demo · 100 SUI virtual
          </button>
        )}

        <div className="flex gap-1.5">
          {mode !== "analysis" &&
            (!running ? (
              <button
                type="button"
                onClick={() => void startAgent()}
                disabled={busy}
                className="flex-1 rounded-lg bg-[#0ecb81] py-1.5 text-xs font-bold text-[#04120c] hover:bg-[#0bb870] disabled:opacity-40"
              >
                Start
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void stopAgent()}
                className="flex-1 rounded-lg bg-[#f6465d] py-1.5 text-xs font-bold text-white hover:bg-[#e03e54]"
              >
                Stop{mode === "demo" ? " + summary" : ""}
              </button>
            ))}
          {mode !== "analysis" && (
            <button
              type="button"
              onClick={() => void runTick()}
              disabled={busy}
              className="rounded-lg border border-white/[0.1] px-2.5 py-1.5 text-xs text-[#c8c8d8] hover:bg-white/[0.04] disabled:opacity-40"
            >
              Tick
            </button>
          )}
          <button
            type="button"
            onClick={() => void resetSession()}
            className="rounded-lg border border-white/[0.08] px-2 py-1.5 text-xs text-[#666] hover:text-white"
          >
            Reset
          </button>
        </div>

        {plan && (
          <div className="rounded-md border border-[#6c63ff]/20 bg-[#6c63ff]/08 px-2 py-1.5 text-[10px] text-[#c4b5fd]">
            <div className="mb-0.5 font-semibold uppercase tracking-wide text-[#a78bfa]/80">
              Plan
            </div>
            <div className="max-h-14 overflow-auto whitespace-pre-wrap leading-snug">
              {plan}
            </div>
          </div>
        )}
      </div>

      {/* Memory analyzer (Analyze mode) */}
      {mode === "analysis" && (memReport || memAiText || memAnalyzing) && (
        <div className="max-h-[42%] min-h-0 overflow-auto border-b border-[#6c63ff]/25 bg-[#0e0e18] px-3 py-2">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wide text-[#a78bfa]">
              Memory analyzer
            </span>
            {memReport && (
              <span className="font-mono text-[9px] text-[#666]">
                {memReport.totalUnique} notes · {memReport.memoryLabel}
              </span>
            )}
          </div>

          {memReport && (
            <div className="mb-2 flex flex-wrap gap-1">
              {Object.entries(memReport.byKind).map(([k, n]) => (
                <span
                  key={k}
                  className="rounded-full border border-white/[0.08] px-2 py-0.5 font-mono text-[9px] text-[#888]"
                >
                  {k} {n}
                </span>
              ))}
            </div>
          )}

          {memReport && memReport.totalUnique > 0 && (
            <div className="mb-2 space-y-1.5">
              {(
                [
                  ["Outcomes", memReport.outcomes, "#0ecb81"],
                  ["Mistakes", memReport.mistakes, "#f6465d"],
                  ["Improvements", memReport.improvements, "#fbbf24"],
                  ["Risk", memReport.risk, "#f472b6"],
                ] as const
              ).map(([label, list, color]) =>
                list.length ? (
                  <div key={label}>
                    <div
                      className="mb-0.5 text-[9px] font-semibold uppercase"
                      style={{ color }}
                    >
                      {label}
                    </div>
                    {list.slice(0, 3).map((h, i) => (
                      <div
                        key={i}
                        className="mb-0.5 line-clamp-2 font-mono text-[9px] leading-snug text-[#9a9ab0]"
                      >
                        [{h.relevance}%] {h.text.replace(/\n/g, " ")}
                      </div>
                    ))}
                  </div>
                ) : null,
              )}
            </div>
          )}

          {(memAiText || memAnalyzing) && (
            <div className="rounded-lg border border-[#6c63ff]/20 bg-[#6c63ff]/08 px-2 py-1.5">
              <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-[#a78bfa]">
                AI synthesis
              </div>
              <div className="whitespace-pre-wrap text-[10px] leading-relaxed text-[#d4d0f0]">
                {memAiText || (memAnalyzing ? "…" : "")}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary card */}
      {showSummary && summary && (
        <div className="border-b border-[#fbbf24]/20 bg-[#1a1608] px-3 py-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wide text-[#fbbf24]">
              Demo results
            </span>
            <button
              type="button"
              onClick={() => setShowSummary(false)}
              className="text-[10px] text-[#666] hover:text-white"
            >
              hide
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 font-mono text-[10px]">
            <span className="text-[#666]">PnL</span>
            <span
              className={
                summary.pnlUsd >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]"
              }
            >
              {formatUsd(summary.pnlUsd)} ({summary.pnlPct >= 0 ? "+" : ""}
              {summary.pnlPct.toFixed(2)}%)
            </span>
            <span className="text-[#666]">Start → End</span>
            <span className="text-[#ddd]">
              {formatUsd(summary.startingEquityUsd)} →{" "}
              {formatUsd(summary.endingEquityUsd)}
            </span>
            <span className="text-[#666]">Trades</span>
            <span className="text-[#ddd]">
              {summary.tradeCount} (L{summary.longCount}/S{summary.shortCount})
            </span>
            <span className="text-[#666]">Time</span>
            <span className="text-[#ddd]">~{summary.durationMin} min</span>
          </div>
        </div>
      )}

      {/* Log */}
      <div className="min-h-0 flex-1 overflow-auto px-2 py-2">
        {logs.length === 0 && !memReport && !memAiText ? (
          <div className="px-2 py-8 text-center text-[11px] text-[#444]">
            {mode === "analysis" ? (
              <>
                Switch to <span className="text-[#a78bfa]">Analyze</span>, link
                Walrus memory on Strategy, then{" "}
                <span className="text-[#a78bfa]">Analyze memory</span> for a
                full recap of past runs.
              </>
            ) : (
              <>
                Press <span className="text-[#fbbf24]">Demo · 100 SUI</span> to
                run the default SUI/USDC strategy on a virtual account with real
                prices.
              </>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            {logs.map((e) => (
              <div
                key={e.id}
                className={`rounded-md border px-2 py-1.5 text-[11px] leading-snug ${kindColor(e.kind)}`}
              >
                <div className="mb-0.5 flex items-center justify-between gap-2 opacity-70">
                  <span className="font-semibold uppercase tracking-wide text-[9px]">
                    {e.title || e.kind}
                  </span>
                  <span className="font-mono text-[9px]">
                    {new Date(e.ts).toLocaleTimeString()}
                  </span>
                </div>
                <div className="whitespace-pre-wrap break-words font-mono text-[10px] opacity-95">
                  {e.body}
                </div>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        )}
      </div>

      <div className="flex gap-1.5 border-t border-white/[0.06] p-2">
        <input
          value={userNote}
          onChange={(e) => setUserNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void sendNote();
          }}
          placeholder="Steer agent…"
          className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-[11px] text-[#e8e8f0] outline-none placeholder:text-[#444]"
        />
        <button
          type="button"
          onClick={() => void sendNote()}
          disabled={busy || !userNote.trim()}
          className="rounded-lg bg-[#4ca3ff]/20 px-2.5 text-[11px] font-semibold text-[#4ca3ff] disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
}
