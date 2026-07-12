import { useCallback, useEffect, useRef, useState } from "react";
import {
  createChatSession,
  deriveChatTitle,
  loadAiChatStorage,
  newChatId,
  saveAiChatStorage,
  sortSessions,
  toSessionSummary,
  type ChatMessage,
  type ChatSession,
  type ChatSessionSummary,
  type ToolActivity,
} from "./ai-chat-storage";

export type { ChatMessage, ChatSessionSummary, ToolActivity };

function pageContextLabel(pathname: string): string {
  const map: Record<string, string> = {
    "/": "Memory Manager",
    "/projects": "Project Manager",
    "/skills": "Skills Manager",
    "/playground": "Playground",
    "/packages": "Packages Manager",
    "/tools": "Tools",
    "/settings": "Settings",
    "/docs": "Beluga Guide",
    "/learning": "Move Learning",
    "/connect": "Wallet Connect",
  };
  return map[pathname] ?? pathname;
}

function toolPreview(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= 200) return trimmed;
  return `${trimmed.slice(0, 200)}…`;
}

function normalizeLoadedMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((m) => ({
    ...m,
    tools: m.tools?.map((t, i) => ({
      ...t,
      id: t.id ?? `${t.toolName}-${i}`,
      status: t.status ?? "done",
    })),
  }));
}

export function useAiChat(pathname: string) {
  const initial = loadAiChatStorage();
  const initialActive =
    initial.sessions.find((s) => s.id === initial.activeChatId) ??
    initial.sessions[0];

  const [sessions, setSessions] = useState<ChatSession[]>(initial.sessions);
  const [activeChatId, setActiveChatId] = useState(initial.activeChatId);
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    normalizeLoadedMessages(initialActive?.messages ?? []),
  );
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState<{
    enabled: boolean;
    authMode: "grok-build" | "api-key";
    hasAuth: boolean;
    hasApiKey: boolean;
    hasGrokAuth: boolean;
    allowToolUse: boolean;
    apiMissing: boolean;
    keyHint: string | null;
    grokEmail: string | null;
  } | null>(null);

  const requestIdRef = useRef<string | null>(null);
  const activeChatIdRef = useRef(activeChatId);
  const skipPersistRef = useRef(false);

  activeChatIdRef.current = activeChatId;

  const persist = useCallback(
    (nextSessions: ChatSession[], nextActiveId: string) => {
      const sorted = sortSessions(nextSessions);
      setSessions(sorted);
      setActiveChatId(nextActiveId);
      saveAiChatStorage({ version: 2, activeChatId: nextActiveId, sessions: sorted });
    },
    [],
  );

  const syncActiveSessionMessages = useCallback(
    (nextMessages: ChatMessage[]) => {
      const chatId = activeChatIdRef.current;
      setSessions((prev) => {
        const updated = sortSessions(
          prev.map((s) => {
            if (s.id !== chatId) return s;
            const title =
              s.title === "New chat" || !s.title.trim()
                ? deriveChatTitle(nextMessages)
                : s.title;
            return {
              ...s,
              messages: nextMessages,
              title: title || "New chat",
              updatedAt: Date.now(),
            };
          }),
        );
        saveAiChatStorage({
          version: 2,
          activeChatId: chatId,
          sessions: updated,
        });
        return updated;
      });
    },
    [],
  );

  useEffect(() => {
    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      return;
    }
    syncActiveSessionMessages(messages);
  }, [messages, syncActiveSessionMessages]);

  useEffect(() => {
    if (!window.belugaAi?.getStatus) {
      setStatus({
        enabled: false,
        authMode: "grok-build",
        hasAuth: false,
        hasApiKey: false,
        hasGrokAuth: false,
        allowToolUse: false,
        apiMissing: true,
        keyHint: null,
        grokEmail: null,
      });
      return;
    }
    window.belugaAi
      .getStatus()
      .then((s) => {
        setStatus({
          enabled: s.enabled,
          authMode: s.authMode,
          hasAuth: s.hasAuth,
          hasApiKey: s.hasApiKey,
          hasGrokAuth: s.hasGrokAuth,
          allowToolUse: s.allowToolUse,
          apiMissing: false,
          keyHint: s.keyHint ?? null,
          grokEmail: s.grokEmail ?? null,
        });
      })
      .catch(() => {
        setStatus({
          enabled: false,
          authMode: "grok-build",
          hasAuth: false,
          hasApiKey: false,
          hasGrokAuth: false,
          allowToolUse: false,
          apiMissing: true,
          keyHint: null,
          grokEmail: null,
        });
      });
  }, []);

  const upsertToolOnAssistant = useCallback(
    (toolCallId: string, patch: Partial<ToolActivity> & { toolName?: string }) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (!m.streaming) return m;
          const tools = [...(m.tools ?? [])];
          const idx = tools.findIndex((t) => t.id === toolCallId);
          if (idx >= 0) {
            tools[idx] = { ...tools[idx], ...patch };
          } else {
            tools.push({
              id: toolCallId,
              toolName: patch.toolName ?? "unknown_tool",
              status: "running",
              ...patch,
            });
          }
          return { ...m, tools };
        }),
      );
    },
    [],
  );

  useEffect(() => {
    const unsubChunk = window.belugaAi?.onStreamChunk?.((payload) => {
      if (payload.requestId !== requestIdRef.current) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.streaming ? { ...m, content: m.content + payload.delta } : m,
        ),
      );
    });

    const unsubToolCall = window.belugaAi?.onToolCall?.((payload) => {
      if (payload.requestId !== requestIdRef.current) return;
      upsertToolOnAssistant(payload.toolCallId, {
        toolName: payload.toolName,
        status: "running",
        args: payload.args,
        argsDisplay: payload.argsDisplay,
      });
    });

    const unsubToolResult = window.belugaAi?.onToolResult?.((payload) => {
      if (payload.requestId !== requestIdRef.current) return;
      upsertToolOnAssistant(payload.toolCallId, {
        toolName: payload.toolName,
        status: "done",
        result: payload.result,
        preview: toolPreview(payload.result),
      });
    });

    const unsubDone = window.belugaAi?.onStreamDone?.((payload) => {
      if (payload.requestId !== requestIdRef.current) return;
      requestIdRef.current = null;
      setStreaming(false);
      setMessages((prev) =>
        prev.map((m) =>
          m.streaming
            ? {
                ...m,
                streaming: false,
                tools: m.tools?.map((t) =>
                  t.status === "running" ? { ...t, status: "done" as const } : t,
                ),
              }
            : m,
        ),
      );
    });

    const unsubError = window.belugaAi?.onStreamError?.((payload) => {
      if (payload.requestId !== requestIdRef.current) return;
      requestIdRef.current = null;
      setStreaming(false);
      setMessages((prev) =>
        prev.map((m) =>
          m.streaming
            ? {
                ...m,
                streaming: false,
                error: true,
                content: m.content || payload.message,
                tools: m.tools?.map((t) =>
                  t.status === "running" ? { ...t, status: "error" as const } : t,
                ),
              }
            : m,
        ),
      );
    });

    return () => {
      unsubChunk?.();
      unsubToolCall?.();
      unsubToolResult?.();
      unsubDone?.();
      unsubError?.();
    };
  }, [upsertToolOnAssistant]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;

      const userMsg: ChatMessage = {
        id: newChatId(),
        role: "user",
        content: trimmed,
      };
      const assistantMsg: ChatMessage = {
        id: newChatId(),
        role: "assistant",
        content: "",
        streaming: true,
        tools: [],
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setStreaming(true);

      const requestId = newChatId();
      requestIdRef.current = requestId;

      const history = [...messages, userMsg].map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      try {
        if (!window.belugaAi?.chat) {
          throw new Error("AI bridge unavailable. Restart the app.");
        }
        await window.belugaAi.chat({
          requestId,
          messages: history,
          pageContext: pageContextLabel(pathname),
        });
      } catch (err) {
        requestIdRef.current = null;
        setStreaming(false);
        const message =
          err instanceof Error ? err.message : "Failed to send message.";
        setMessages((prev) =>
          prev.map((m) =>
            m.streaming
              ? { ...m, streaming: false, error: true, content: message }
              : m,
          ),
        );
      }
    },
    [messages, pathname, streaming],
  );

  const stop = useCallback(() => {
    const id = requestIdRef.current;
    if (!id) return;
    void window.belugaAi?.abort?.(id);
    requestIdRef.current = null;
    setStreaming(false);
    setMessages((prev) =>
      prev.map((m) =>
        m.streaming
          ? {
              ...m,
              streaming: false,
              content: m.content || "(stopped)",
              tools: m.tools?.map((t) =>
                t.status === "running" ? { ...t, status: "error" as const } : t,
              ),
            }
          : m,
      ),
    );
  }, []);

  const createChat = useCallback(() => {
    if (streaming) return;
    const session = createChatSession();
    const nextSessions = sortSessions([session, ...sessions]);
    skipPersistRef.current = true;
    setMessages([]);
    persist(nextSessions, session.id);
  }, [persist, sessions, streaming]);

  const selectChat = useCallback(
    (chatId: string) => {
      if (streaming || chatId === activeChatId) return;
      const session = sessions.find((s) => s.id === chatId);
      if (!session) return;
      skipPersistRef.current = true;
      setMessages(normalizeLoadedMessages(session.messages));
      persist(sessions, chatId);
    },
    [activeChatId, persist, sessions, streaming],
  );

  const deleteChat = useCallback(
    (chatId: string) => {
      if (streaming && chatId === activeChatId) return;
      let nextSessions = sessions.filter((s) => s.id !== chatId);
      if (!nextSessions.length) {
        nextSessions = [createChatSession()];
      }
      let nextActive = activeChatId;
      if (chatId === activeChatId) {
        nextActive = nextSessions[0].id;
        skipPersistRef.current = true;
        setMessages(normalizeLoadedMessages(nextSessions[0].messages));
      }
      persist(nextSessions, nextActive);
    },
    [activeChatId, persist, sessions, streaming],
  );

  const togglePinChat = useCallback(
    (chatId: string) => {
      const nextSessions = sortSessions(
        sessions.map((s) =>
          s.id === chatId ? { ...s, pinned: !s.pinned, updatedAt: Date.now() } : s,
        ),
      );
      persist(nextSessions, activeChatId);
    },
    [activeChatId, persist, sessions],
  );

  const sessionSummaries: ChatSessionSummary[] = sessions.map(toSessionSummary);

  const refreshStatus = useCallback(() => {
    if (!window.belugaAi?.getStatus) return;
    window.belugaAi
      .getStatus()
      .then((s) => {
        setStatus({
          enabled: s.enabled,
          authMode: s.authMode,
          hasAuth: s.hasAuth,
          hasApiKey: s.hasApiKey,
          hasGrokAuth: s.hasGrokAuth,
          allowToolUse: s.allowToolUse,
          apiMissing: false,
          keyHint: s.keyHint ?? null,
          grokEmail: s.grokEmail ?? null,
        });
      })
      .catch(() => undefined);
  }, []);

  return {
    messages,
    streaming,
    status,
    activeChatId,
    sessions: sessionSummaries,
    send,
    stop,
    createChat,
    selectChat,
    deleteChat,
    togglePinChat,
    refreshStatus,
  };
}