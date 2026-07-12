export interface ToolActivity {
  id: string;
  toolName: string;
  status: "running" | "done" | "error";
  args?: Record<string, unknown>;
  argsDisplay?: string;
  result?: string;
  preview?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  error?: boolean;
  tools?: ToolActivity[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ChatSessionSummary {
  id: string;
  title: string;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  preview: string;
}

interface AiChatStorageV2 {
  version: 2;
  activeChatId: string;
  sessions: ChatSession[];
}

const STORAGE_V2 = "beluga-ai-sessions-v2";
const STORAGE_V1 = "beluga-ai-chat-v1";
const MAX_PERSISTED_TOOL_RESULT = 12_000;

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function sanitizeMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      ...m,
      streaming: false,
      tools: m.tools?.map((t, i) => ({
        ...t,
        id: t.id ?? `${t.toolName}-${i}`,
        status: t.status === "running" ? ("done" as const) : (t.status ?? "done"),
        argsDisplay: t.argsDisplay?.trim() || undefined,
        result: t.result?.slice(0, MAX_PERSISTED_TOOL_RESULT),
      })),
    }))
    .filter((m) => !m.streaming);
}

export function deriveChatTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user" && m.content.trim());
  if (!firstUser) return "New chat";
  const text = firstUser.content.trim().replace(/\s+/g, " ");
  if (text.length <= 42) return text;
  return `${text.slice(0, 42)}…`;
}

export function sortSessions(sessions: ChatSession[]): ChatSession[] {
  return [...sessions].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
}

export function toSessionSummary(session: ChatSession): ChatSessionSummary {
  const last = [...session.messages].reverse().find((m) => m.content.trim());
  return {
    id: session.id,
    title: session.title,
    pinned: session.pinned,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messageCount: session.messages.length,
    preview: last?.content.trim().slice(0, 80) ?? "No messages yet",
  };
}

function createEmptySession(): ChatSession {
  const now = Date.now();
  return {
    id: newId(),
    title: "New chat",
    messages: [],
    pinned: false,
    createdAt: now,
    updatedAt: now,
  };
}

function migrateV1(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_V1);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatMessage[];
    if (!Array.isArray(parsed) || !parsed.length) return [];
    const now = Date.now();
    const messages = sanitizeMessages(parsed);
    return [
      {
        id: newId(),
        title: deriveChatTitle(messages),
        messages,
        pinned: false,
        createdAt: now,
        updatedAt: now,
      },
    ];
  } catch {
    return [];
  }
}

export function loadAiChatStorage(): AiChatStorageV2 {
  try {
    const raw = localStorage.getItem(STORAGE_V2);
    if (raw) {
      const parsed = JSON.parse(raw) as AiChatStorageV2;
      if (parsed.version === 2 && parsed.sessions?.length) {
        const sessions = sortSessions(
          parsed.sessions.map((s) => ({
            ...s,
            messages: sanitizeMessages(s.messages ?? []),
          })),
        );
        const activeChatId = sessions.some((s) => s.id === parsed.activeChatId)
          ? parsed.activeChatId
          : sessions[0].id;
        return { version: 2, activeChatId, sessions };
      }
    }
  } catch {
    // fall through
  }

  const migrated = migrateV1();
  const sessions = migrated.length ? sortSessions(migrated) : [createEmptySession()];
  const storage: AiChatStorageV2 = {
    version: 2,
    activeChatId: sessions[0].id,
    sessions,
  };
  saveAiChatStorage(storage);
  return storage;
}

export function saveAiChatStorage(storage: AiChatStorageV2) {
  const persisted: AiChatStorageV2 = {
    version: 2,
    activeChatId: storage.activeChatId,
    sessions: sortSessions(
      storage.sessions.map((s) => ({
        ...s,
        messages: sanitizeMessages(s.messages),
        title: s.title.trim() || deriveChatTitle(s.messages) || "New chat",
      })),
    ),
  };
  localStorage.setItem(STORAGE_V2, JSON.stringify(persisted));
}

export function createChatSession(): ChatSession {
  return createEmptySession();
}

export { newId as newChatId };