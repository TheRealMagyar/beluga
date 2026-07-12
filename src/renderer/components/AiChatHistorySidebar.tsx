import { Pin, PinOff, Plus, Trash2, MessageSquare } from "lucide-react";
import type { ChatSessionSummary } from "../hooks/useAiChat";

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function AiChatHistorySidebar({
  sessions,
  activeChatId,
  streaming,
  onCreateChat,
  onSelectChat,
  onDeleteChat,
  onTogglePin,
}: {
  sessions: ChatSessionSummary[];
  activeChatId: string;
  streaming: boolean;
  onCreateChat: () => void;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onTogglePin: (id: string) => void;
}) {
  const pinned = sessions.filter((s) => s.pinned);
  const rest = sessions.filter((s) => !s.pinned);

  const renderItem = (session: ChatSessionSummary) => {
    const active = session.id === activeChatId;
    return (
      <div
        key={session.id}
        className={`group relative rounded-lg border transition-colors ${
          active
            ? "border-[#6c63ff]/40 bg-[#6c63ff]/12"
            : "border-transparent hover:border-white/[0.08] hover:bg-white/[0.03]"
        }`}
      >
        <button
          type="button"
          onClick={() => onSelectChat(session.id)}
          disabled={streaming && !active}
          className="w-full text-left px-2.5 py-2 pr-16 bg-transparent border-none cursor-pointer disabled:opacity-50"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {session.pinned && (
              <Pin size={10} className="text-[#ffb347] flex-shrink-0" />
            )}
            <span className="text-[12px] font-medium text-neutral-200 truncate">
              {session.title}
            </span>
          </div>
          <p className="text-[10px] text-neutral-500 truncate mt-0.5">
            {session.preview}
          </p>
          <p className="text-[10px] text-neutral-600 mt-1">
            {session.messageCount} msg · {formatRelativeTime(session.updatedAt)}
          </p>
        </button>
        <div className="absolute right-1 top-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => onTogglePin(session.id)}
            className="w-6 h-6 flex items-center justify-center rounded-md text-neutral-500 hover:text-[#ffb347] hover:bg-white/5 border-none bg-transparent cursor-pointer"
            title={session.pinned ? "Unpin" : "Pin"}
          >
            {session.pinned ? <PinOff size={11} /> : <Pin size={11} />}
          </button>
          <button
            type="button"
            onClick={() => onDeleteChat(session.id)}
            disabled={streaming && active}
            className="w-6 h-6 flex items-center justify-center rounded-md text-neutral-500 hover:text-red-400 hover:bg-white/5 border-none bg-transparent cursor-pointer disabled:opacity-40"
            title="Delete chat"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <aside className="w-[220px] flex-shrink-0 border-r border-white/[0.06] flex flex-col min-h-0 bg-[#0d0d14]">
      <div className="flex-shrink-0 p-3 border-b border-white/[0.06]">
        <button
          type="button"
          onClick={onCreateChat}
          disabled={streaming}
          className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg text-[12px] font-medium border border-[#6c63ff]/30 bg-[#6c63ff]/10 text-[#c4c0ff] hover:bg-[#6c63ff]/20 cursor-pointer disabled:opacity-40 border-solid"
        >
          <Plus size={14} />
          New chat
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2 space-y-3">
        {sessions.length === 0 ? (
          <p className="text-[11px] text-neutral-500 px-2 py-4 text-center">
            No chats yet
          </p>
        ) : (
          <>
            {pinned.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-600 px-2 mb-1.5 flex items-center gap-1">
                  <Pin size={10} />
                  Pinned
                </p>
                <div className="space-y-1">{pinned.map(renderItem)}</div>
              </div>
            )}
            {rest.length > 0 && (
              <div>
                {pinned.length > 0 && (
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-600 px-2 mb-1.5 flex items-center gap-1">
                    <MessageSquare size={10} />
                    History
                  </p>
                )}
                <div className="space-y-1">{rest.map(renderItem)}</div>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}