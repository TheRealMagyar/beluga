import { BrowserWindow, ipcMain } from "electron";
import {
  assessHeadlineImpact,
  fetchCryptoNews,
  fetchEconomicCalendar,
  getMarketFeedSnapshot,
  impactAssessmentPrompt,
  mergeAiAssessment,
  DEFAULT_X_WATCHLIST,
  type CustomFeedEndpoint,
  type ImpactAssessment,
} from "../helper/trading-news-feeds";
import {
  streamAiChat,
  type AiChatMessage,
} from "../helper/ai-chat";
import { normalizeApiKey } from "../helper/ai-api-key";
import { getGrokOAuthAccessToken } from "../helper/grok-oauth";
import type { MainIpcContext } from "./context";
import type { AiSettings } from "../main/types";

const activeAssess = new Map<string, AbortController>();

function readAiSettings(ctx: MainIpcContext): AiSettings {
  const ai = ctx.settingsStore.get("ai");
  const apiKey = normalizeApiKey(ai.apiKey ?? "");
  const authMode =
    ai.authMode === "api-key" || ai.authMode === "grok-build"
      ? ai.authMode
      : apiKey
        ? "api-key"
        : "grok-build";
  return { ...ai, authMode, apiKey, allowToolUse: ai.allowToolUse ?? true };
}

async function resolveBearer(ai: AiSettings): Promise<string | null> {
  if (ai.authMode === "api-key") {
    const key = normalizeApiKey(ai.apiKey ?? "");
    return key || null;
  }
  return getGrokOAuthAccessToken();
}

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

export function registerFeedsIpc(ctx?: MainIpcContext) {
  ipcMain.handle(
    "feeds:snapshot",
    async (
      _e,
      params?: {
        newsLimit?: number;
        calendarHours?: number;
        customEndpoints?: CustomFeedEndpoint[];
      },
    ) => {
      try {
        const snap = await getMarketFeedSnapshot(params);
        return { ok: true, ...snap };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  );

  ipcMain.handle(
    "feeds:crypto-news",
    async (_e, params?: { limitPerSource?: number }) => {
      try {
        const res = await fetchCryptoNews(params?.limitPerSource ?? 8);
        return { ok: true, ...res };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  );

  ipcMain.handle("feeds:economic-calendar", async () => {
    try {
      const res = await fetchEconomicCalendar();
      return { ok: true, ...res };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  ipcMain.handle("feeds:x-watchlist", async () => {
    return { ok: true, accounts: DEFAULT_X_WATCHLIST };
  });

  /** Fast heuristic impact (always available). */
  ipcMain.handle(
    "feeds:assess-impact",
    async (
      _e,
      params: { headline: string; body?: string; assetHint?: string },
    ) => {
      if (!params?.headline?.trim()) {
        return { ok: false, error: "headline required" };
      }
      return {
        ok: true,
        ...assessHeadlineImpact({
          headline: params.headline.trim(),
          body: params.body,
          assetHint: params.assetHint,
        }),
      };
    },
  );

  /**
   * AI-enhanced impact (streams text + returns structured result via done).
   * Falls back to heuristic if no AI auth.
   */
  ipcMain.handle(
    "feeds:assess-impact-ai",
    async (
      _e,
      params: {
        headline: string;
        body?: string;
        assetHint?: string;
        requestId: string;
      },
    ) => {
      if (!params?.headline?.trim()) {
        return { ok: false, error: "headline required" };
      }
      if (!params.requestId) {
        return { ok: false, error: "requestId required" };
      }

      const assessInput = {
        headline: params.headline.trim(),
        body: params.body,
        assetHint: params.assetHint,
      };
      const heuristic = assessHeadlineImpact(assessInput);

      if (!ctx) {
        return { ok: true, assessment: heuristic, ...heuristic, aiUsed: false };
      }

      const ai = readAiSettings(ctx);
      if (!ai.enabled) {
        return {
          ok: true,
          assessment: heuristic,
          ...heuristic,
          aiUsed: false,
          aiSkipped: "AI disabled in Settings",
        };
      }

      const bearer = await resolveBearer(ai);
      if (!bearer) {
        return {
          ok: true,
          assessment: heuristic,
          ...heuristic,
          aiUsed: false,
          aiSkipped: "No AI auth — showing heuristic only",
        };
      }

      const existing = activeAssess.get(params.requestId);
      if (existing) existing.abort();
      const controller = new AbortController();
      activeAssess.set(params.requestId, controller);

      let buf = "";
      const messages: AiChatMessage[] = [
        {
          role: "system",
          content:
            "You are a crypto market risk desk. Be precise, no fluff. Output JSON only when asked.",
        },
        {
          role: "user",
          content: impactAssessmentPrompt(assessInput, heuristic),
        },
      ];

      void streamAiChat({
        apiKey: bearer,
        model: ai.model,
        messages,
        allowToolUse: false,
        signal: controller.signal,
        callbacks: {
          onChunk: (delta) => {
            buf += delta;
            broadcast("ai:stream-chunk", { delta }, params.requestId);
          },
          onToolCall: () => {},
          onToolResult: () => {},
          onDone: (usage) => {
            activeAssess.delete(params.requestId);
            const merged: ImpactAssessment = mergeAiAssessment(heuristic, buf);
            broadcast(
              "ai:stream-done",
              {
                usage: usage
                  ? {
                      promptTokens: usage.promptTokens,
                      completionTokens: usage.completionTokens,
                    }
                  : null,
                impactAssessment: merged,
              },
              params.requestId,
            );
          },
          onError: (message) => {
            activeAssess.delete(params.requestId);
            broadcast(
              "ai:stream-error",
              {
                message,
                impactAssessment: heuristic,
              },
              params.requestId,
            );
          },
        },
      });

      return {
        ok: true,
        assessment: heuristic,
        ...heuristic,
        aiUsed: true,
        aiStreaming: true,
        requestId: params.requestId,
      };
    },
  );
}
