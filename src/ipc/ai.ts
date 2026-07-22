import { BrowserWindow, ipcMain } from "electron";
import { maskApiKey, normalizeApiKey } from "../helper/ai-api-key";
import {
  buildBelugaSystemPrompt,
  buildTradingAgentSystemPrompt,
  streamAiChat,
  testAiConnection,
  type AiChatMessage,
} from "../helper/ai-chat";
import {
  buildDemoSummary,
  clearTradingSession,
  executeTradingAgentTool,
  getDemoSnapshot,
  getOrCreateSession,
  getChartAnnotationsForMarket,
  setSessionMemory,
  setSessionRisk,
  startDemoAccount,
  TRADING_AGENT_TOOLS,
  type SessionMemoryCred,
} from "../helper/trading-agent-tools";
import { recall as walrusRecall } from "../helper/walrus-memory";
import {
  buildMemoryAnalysisSystemPrompt,
  gatherStrategyMemoryReport,
  reportToPromptContext,
} from "../helper/trading-memory-analyze";
import { flushPendingToWalrus } from "../helper/strategy-local-memory";
import {
  exchangeGrokOAuthCode,
  getGrokOAuthAccessToken,
  getGrokOAuthStatus,
  logoutGrokOAuth,
  onGrokOAuthLoginComplete,
  startGrokOAuthLogin,
  testGrokOAuthConnection,
} from "../helper/grok-oauth";
import type { MainIpcContext } from "./context";
import type { AiSettings } from "../main/types";

const activeStreams = new Map<string, AbortController>();

function broadcast(
  channel: string,
  payload: Record<string, unknown>,
  requestId: string,
) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, { requestId, ...payload });
    }
  }
}

function broadcastEvent(channel: string, payload: Record<string, unknown>) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }
}

function readAiSettings(ctx: MainIpcContext): AiSettings {
  const ai = ctx.settingsStore.get("ai");
  const apiKey = normalizeApiKey(ai.apiKey ?? "");
  const authMode =
    ai.authMode === "api-key" || ai.authMode === "grok-build"
      ? ai.authMode
      : apiKey
        ? "api-key"
        : "grok-build";
  return {
    ...ai,
    authMode,
    apiKey,
    allowToolUse: ai.allowToolUse ?? true,
  };
}

async function resolveBearerToken(ai: AiSettings): Promise<string | null> {
  if (ai.authMode === "api-key") {
    const key = normalizeApiKey(ai.apiKey ?? "");
    return key || null;
  }
  return getGrokOAuthAccessToken();
}

async function sanitizeAiSettings(ai: AiSettings) {
  const normalized = normalizeApiKey(ai.apiKey ?? "");
  const oauth = await getGrokOAuthStatus();
  const hasApiKey = Boolean(normalized);
  const hasGrokAuth = oauth.connected;
  const hasAuth = ai.authMode === "api-key" ? hasApiKey : hasGrokAuth;

  return {
    enabled: ai.enabled,
    authMode: ai.authMode,
    model: ai.model,
    includePageContext: ai.includePageContext,
    allowToolUse: ai.allowToolUse ?? true,
    hasApiKey,
    hasGrokAuth,
    hasAuth,
    keyHint: maskApiKey(normalized),
    grokEmail: oauth.email,
    grokAuthSource: oauth.source,
  };
}

export function registerAiIpc(ctx: MainIpcContext) {
  onGrokOAuthLoginComplete((ok, message) => {
    broadcastEvent("ai:oauth-complete", { ok, message });
  });

  ipcMain.handle("ai:get-status", async () => {
    return sanitizeAiSettings(readAiSettings(ctx));
  });

  ipcMain.handle(
    "ai:test-connection",
    async (
      _event,
      params?: { apiKey?: string; model?: string; authMode?: AiSettings["authMode"] },
    ) => {
      const ai = readAiSettings(ctx);
      const model = params?.model ?? ai.model;
      const authMode = params?.authMode ?? ai.authMode;

      if (authMode === "grok-build") {
        return testGrokOAuthConnection(model);
      }

      const apiKey = params?.apiKey
        ? normalizeApiKey(params.apiKey)
        : ai.apiKey;
      return testAiConnection(apiKey, model);
    },
  );

  ipcMain.handle("ai:oauth-start", async () => startGrokOAuthLogin());

  ipcMain.handle(
    "ai:oauth-exchange-code",
    async (_event, params: { code: string }) =>
      exchangeGrokOAuthCode(params.code),
  );

  ipcMain.handle("ai:oauth-status", async () => getGrokOAuthStatus());

  ipcMain.handle("ai:oauth-logout", async () => {
    await logoutGrokOAuth();
    return { ok: true };
  });

  ipcMain.handle(
    "ai:chat",
    async (
      _event,
      params: {
        requestId: string;
        messages: Array<{ role: "user" | "assistant"; content: string }>;
        pageContext?: string;
      },
    ) => {
      const ai = readAiSettings(ctx);

      if (!ai.enabled) {
        broadcast(
          "ai:stream-error",
          { message: "AI Assistant is disabled." },
          params.requestId,
        );
        return { ok: false };
      }

      const bearer = await resolveBearerToken(ai);
      if (!bearer) {
        const message =
          ai.authMode === "grok-build"
            ? "Not signed in with Grok Build. Open Settings → AI Assistant and sign in."
            : "No API key configured. Open Settings → AI Assistant and add your xAI API key.";
        broadcast("ai:stream-error", { message }, params.requestId);
        return { ok: false };
      }

      const existing = activeStreams.get(params.requestId);
      if (existing) existing.abort();

      const controller = new AbortController();
      activeStreams.set(params.requestId, controller);

      const systemPrompt = buildBelugaSystemPrompt(
        ai.includePageContext ? params.pageContext : undefined,
        ai.allowToolUse ?? true,
      );

      const messages: AiChatMessage[] = [
        { role: "system", content: systemPrompt },
        ...params.messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      void streamAiChat({
        apiKey: bearer,
        model: ai.model,
        messages,
        allowToolUse: ai.allowToolUse ?? true,
        signal: controller.signal,
        callbacks: {
          onChunk: (delta) => {
            broadcast("ai:stream-chunk", { delta }, params.requestId);
          },
          onToolCall: (toolCallId, toolName, args, argsDisplay) => {
            broadcast(
              "ai:tool-call",
              { toolCallId, toolName, args, argsDisplay },
              params.requestId,
            );
          },
          onToolResult: (toolCallId, toolName, result) => {
            broadcast(
              "ai:tool-result",
              { toolCallId, toolName, result },
              params.requestId,
            );
          },
          onDone: (usage) => {
            activeStreams.delete(params.requestId);
            broadcast(
              "ai:stream-done",
              {
                usage: usage
                  ? {
                      promptTokens: usage.promptTokens,
                      completionTokens: usage.completionTokens,
                    }
                  : null,
              },
              params.requestId,
            );
          },
          onError: (message) => {
            activeStreams.delete(params.requestId);
            broadcast("ai:stream-error", { message }, params.requestId);
          },
        },
      });

      return { ok: true };
    },
  );

  ipcMain.handle("ai:abort", (_event, { requestId }: { requestId: string }) => {
    const controller = activeStreams.get(requestId);
    if (controller) {
      controller.abort();
      activeStreams.delete(requestId);
    }
    return { ok: true };
  });

  /**
   * One autonomous trading-agent tick (chart strategy runner).
   * Uses dedicated trading tools + T2000 wallet actions.
   */
  ipcMain.handle(
    "ai:trading-agent-tick",
    async (
      _event,
      params: {
        requestId: string;
        sessionId: string;
        strategyBlock: string;
        market: string;
        timeframe: string;
        /** analysis | demo | live */
        mode?: "analysis" | "demo" | "live";
        paperMode?: boolean;
        userMessage?: string;
        strategyId?: string;
        memoryCredentials?: SessionMemoryCred[];
        stopLossPct?: number;
        takeProfitPct?: number;
      },
    ) => {
      const ai = readAiSettings(ctx);

      if (!ai.enabled) {
        broadcast(
          "ai:stream-error",
          { message: "AI Assistant is disabled in Settings." },
          params.requestId,
        );
        return { ok: false };
      }

      const bearer = await resolveBearerToken(ai);
      if (!bearer) {
        const message =
          ai.authMode === "grok-build"
            ? "Not signed in with Grok Build. Open Settings → AI Assistant."
            : "No API key. Open Settings → AI Assistant.";
        broadcast("ai:stream-error", { message }, params.requestId);
        return { ok: false };
      }

      const existing = activeStreams.get(params.requestId);
      if (existing) existing.abort();

      const controller = new AbortController();
      activeStreams.set(params.requestId, controller);

      const session = getOrCreateSession(params.sessionId);
      session.nextTickSeconds = null;

      // Always refresh session memory from renderer (source of truth each tick)
      if (params.memoryCredentials !== undefined) {
        setSessionMemory(
          params.sessionId,
          params.memoryCredentials,
          params.strategyId ?? null,
        );
      }
      setSessionRisk(
        params.sessionId,
        params.stopLossPct,
        params.takeProfitPct,
      );

      // Opportunistic on-chain flush of queued notes (when Walrus unpauses)
      if (params.memoryCredentials?.[0]) {
        const ns = params.memoryCredentials[0].namespace;
        void flushPendingToWalrus({ namespace: ns, maxBatch: 8 }).then((f) => {
          if (f.uploaded > 0) {
            console.log(
              `[trading-agent] flushed ${f.uploaded} notes on-chain (remaining ${f.remaining})`,
            );
          }
        });
      }

      const mode: "analysis" | "demo" | "live" =
        params.mode ||
        (session.demoMode
          ? "demo"
          : params.paperMode
            ? "analysis"
            : "live");

      // Keep session flag in sync
      if (mode === "demo") {
        session.demoMode = true;
        if (!session.demo) {
          await startDemoAccount(params.sessionId, 100);
        }
      } else if (mode === "live") {
        session.demoMode = false;
      }

      let demoHint = "";
      if (session.demoMode && session.demo) {
        const snap = await getDemoSnapshot(params.sessionId);
        if (snap) {
          demoHint = `balances=${JSON.stringify(snap.balances)} equityUsd=${snap.equityUsd}`;
        }
      }

      // Bootstrap: auto-recall past lessons into the prompt when memory is linked
      let recallBootstrap = "";
      const mem0 = session.memory[0];
      if (mem0) {
        try {
          const q = `SUI trading strategy lessons mistakes improvements ${params.market} ${params.timeframe} scalp`;
          const recalled = await walrusRecall(
            {
              accountId: mem0.accountId,
              delegateKey: mem0.delegateKey,
              network: mem0.network,
              namespace: mem0.namespace,
            },
            q,
            { limit: 5 },
          );
          if (recalled.total > 0) {
            recallBootstrap = recalled.results
              .map(
                (r, i) =>
                  `${i + 1}. [${r.relevance}%] ${r.text.slice(0, 400)}`,
              )
              .join("\n");
          } else {
            recallBootstrap =
              "(no prior memories in this strategy namespace yet — write first notes with trade_remember)";
          }
        } catch (err) {
          recallBootstrap = `recall failed: ${err instanceof Error ? err.message : String(err)}`;
        }
      }

      const systemPrompt = buildTradingAgentSystemPrompt({
        strategyBlock: params.strategyBlock,
        market: params.market,
        timeframe: params.timeframe,
        sessionPlan: session.plan,
        mode,
        paperMode: mode === "analysis",
        demoHint,
        hasMemory: session.memory.length > 0,
        memoryLabels: session.memory.map((m) => m.label).join(", "),
        recallBootstrap,
      });

      const userContent =
        params.userMessage?.trim() ||
        [
          `Autonomous tick at ${new Date().toISOString()}.`,
          `Focus market: ${params.market} · TF: ${params.timeframe} · mode=${mode}.`,
          session.plan
            ? `Resume plan:\n${session.plan}`
            : "No prior plan — create one.",
          session.lastAction
            ? `Last action: ${session.lastAction}`
            : "No prior trade actions.",
          demoHint ? `Demo account: ${demoHint}` : "",
          session.memory.length > 0
            ? "Memory linked — use trade_recall if needed; trade_remember lessons after trades."
            : "",
          "Run the operating loop: think → analyze → plan → act if warranted → remember lessons → schedule_next or stop.",
        ]
          .filter(Boolean)
          .join("\n");

      const messages: AiChatMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ];

      void streamAiChat({
        apiKey: bearer,
        model: ai.model,
        messages,
        allowToolUse: true,
        tools: TRADING_AGENT_TOOLS,
        executeTool: (name, args) =>
          executeTradingAgentTool(params.sessionId, name, args),
        signal: controller.signal,
        callbacks: {
          onChunk: (delta) => {
            broadcast("ai:stream-chunk", { delta }, params.requestId);
          },
          onToolCall: (toolCallId, toolName, args, argsDisplay) => {
            broadcast(
              "ai:tool-call",
              { toolCallId, toolName, args, argsDisplay },
              params.requestId,
            );
          },
          onToolResult: (toolCallId, toolName, result) => {
            broadcast(
              "ai:tool-result",
              { toolCallId, toolName, result },
              params.requestId,
            );
          },
          onDone: (usage) => {
            activeStreams.delete(params.requestId);
            const s = getOrCreateSession(params.sessionId);
            broadcast(
              "ai:stream-done",
              {
                usage: usage
                  ? {
                      promptTokens: usage.promptTokens,
                      completionTokens: usage.completionTokens,
                    }
                  : null,
                tradingMeta: {
                  sessionId: params.sessionId,
                  nextTickSeconds: s.nextTickSeconds,
                  stopped: s.stopped,
                  plan: s.plan,
                  demoMode: s.demoMode,
                },
              },
              params.requestId,
            );
          },
          onError: (message) => {
            activeStreams.delete(params.requestId);
            broadcast("ai:stream-error", { message }, params.requestId);
          },
        },
      });

      return { ok: true };
    },
  );

  ipcMain.handle(
    "ai:trading-agent-start-demo",
    async (
      _event,
      params: { sessionId: string; initialSui?: number },
    ) => {
      try {
        const demo = await startDemoAccount(
          params.sessionId,
          params.initialSui ?? 100,
        );
        const snap = await getDemoSnapshot(params.sessionId);
        return {
          ok: true,
          demo,
          equityUsd: snap?.equityUsd ?? demo.startingEquityUsd,
        };
      } catch (err: unknown) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  );

  ipcMain.handle(
    "ai:trading-agent-demo-summary",
    async (_event, params: { sessionId: string }) => {
      return buildDemoSummary(params.sessionId);
    },
  );

  ipcMain.handle(
    "ai:trading-agent-demo-snapshot",
    async (_event, params: { sessionId: string }) => {
      const snap = await getDemoSnapshot(params.sessionId);
      if (!snap) return { ok: false, error: "No demo account" };
      return { ok: true, ...snap };
    },
  );

  ipcMain.handle(
    "ai:trading-chart-annotations",
    async (_event, params?: { market?: string }) => {
      const market = params?.market || "SUI";
      return {
        ok: true,
        annotations: getChartAnnotationsForMarket(market),
      };
    },
  );

  ipcMain.handle(
    "ai:trading-agent-remember",
    async (
      _event,
      params: {
        sessionId: string;
        text: string;
        kind?: string;
        memoryCredentials?: SessionMemoryCred[];
        strategyId?: string;
      },
    ) => {
      if (params.memoryCredentials?.length) {
        setSessionMemory(
          params.sessionId,
          params.memoryCredentials,
          params.strategyId ?? null,
        );
      }
      return executeTradingAgentTool(params.sessionId, "trade_remember", {
        text: params.text,
        kind: params.kind || "outcome",
      });
    },
  );

  /**
   * Analyze linked strategy Walrus memory: multi-query recall + optional AI synthesis.
   * Streams AI summary on the same channels as chat (requestId).
   */
  ipcMain.handle(
    "ai:trading-memory-analyze",
    async (
      _event,
      params: {
        requestId: string;
        strategyBlock: string;
        strategyName?: string;
        memoryCredentials: SessionMemoryCred[];
        withAiSummary?: boolean;
      },
    ) => {
      if (!params.memoryCredentials?.length) {
        return {
          ok: false,
          error: "No Walrus memory linked to this strategy.",
        };
      }

      const mem = params.memoryCredentials[0];
      let report;
      try {
        report = await gatherStrategyMemoryReport(mem);
      } catch (err: unknown) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }

      const wantAi = params.withAiSummary !== false;
      if (!wantAi || report.totalUnique === 0) {
        return {
          ok: true,
          report,
          aiSummary: null as string | null,
        };
      }

      const ai = readAiSettings(ctx);
      if (!ai.enabled) {
        return {
          ok: true,
          report,
          aiSummary: null,
          aiSkipped: "AI disabled in Settings",
        };
      }

      const bearer = await resolveBearerToken(ai);
      if (!bearer) {
        return {
          ok: true,
          report,
          aiSummary: null,
          aiSkipped: "No AI auth configured",
        };
      }

      const existing = activeStreams.get(params.requestId);
      if (existing) existing.abort();
      const controller = new AbortController();
      activeStreams.set(params.requestId, controller);

      const messages: AiChatMessage[] = [
        {
          role: "system",
          content: buildMemoryAnalysisSystemPrompt(params.strategyBlock),
        },
        {
          role: "user",
          content: [
            `Strategy: ${params.strategyName || "unknown"}`,
            "Analyze these recalled memory notes:",
            reportToPromptContext(report),
          ].join("\n\n"),
        },
      ];

      // Stream synthesis to UI; also resolve full text for the IPC return is hard
      // so we only stream — renderer builds display from chunks + report payload.
      void streamAiChat({
        apiKey: bearer,
        model: ai.model,
        messages,
        allowToolUse: false,
        signal: controller.signal,
        callbacks: {
          onChunk: (delta) => {
            broadcast("ai:stream-chunk", { delta }, params.requestId);
          },
          onToolCall: () => {},
          onToolResult: () => {},
          onDone: (usage) => {
            activeStreams.delete(params.requestId);
            broadcast(
              "ai:stream-done",
              {
                usage: usage
                  ? {
                      promptTokens: usage.promptTokens,
                      completionTokens: usage.completionTokens,
                    }
                  : null,
                tradingMeta: {
                  sessionId: "memory-analyze",
                  nextTickSeconds: null,
                  stopped: true,
                  plan: "",
                  demoMode: false,
                },
              },
              params.requestId,
            );
          },
          onError: (message) => {
            activeStreams.delete(params.requestId);
            broadcast("ai:stream-error", { message }, params.requestId);
          },
        },
      });

      return {
        ok: true,
        report,
        aiStreaming: true,
      };
    },
  );

  ipcMain.handle(
    "ai:trading-agent-reset",
    async (_event, params: { sessionId: string }) => {
      clearTradingSession(params.sessionId);
      return { ok: true };
    },
  );

  ipcMain.handle(
    "ai:trading-agent-session",
    async (_event, params: { sessionId: string }) => {
      const s = getOrCreateSession(params.sessionId);
      const snap = s.demo ? await getDemoSnapshot(params.sessionId) : null;
      return {
        ok: true,
        plan: s.plan,
        stopped: s.stopped,
        nextTickSeconds: s.nextTickSeconds,
        lastAction: s.lastAction,
        thoughts: s.thoughts.slice(-10),
        demoMode: s.demoMode,
        demo: snap,
      };
    },
  );
}