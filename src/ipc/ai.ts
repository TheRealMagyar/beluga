import { BrowserWindow, ipcMain } from "electron";
import { maskApiKey, normalizeApiKey } from "../helper/ai-api-key";
import {
  buildBelugaSystemPrompt,
  streamAiChat,
  testAiConnection,
  type AiChatMessage,
} from "../helper/ai-chat";
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
}