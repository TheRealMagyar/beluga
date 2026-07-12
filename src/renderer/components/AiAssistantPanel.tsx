import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Sparkles,
  X,
  Send,
  Square,
  Settings,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { useAiChat } from "../hooks/useAiChat";
import { AiThinkingIndicator, AiToolCallCard } from "./AiToolCallCard";
import { AiChatMarkdown } from "./AiChatMarkdown";
import { AiChatHistorySidebar } from "./AiChatHistorySidebar";

const SUGGESTIONS = [
  "List my projects",
  "How do I link a Walrus memory to a project?",
  "Open project X and summarize its structure",
];

interface AiAssistantPanelProps {
  open: boolean;
  onClose: () => void;
  pendingMessage?: string | null;
  onPendingConsumed?: () => void;
}

export function AiAssistantPanel({
  open,
  onClose,
  pendingMessage = null,
  onPendingConsumed,
}: AiAssistantPanelProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const {
    messages,
    streaming,
    status,
    activeChatId,
    sessions,
    send,
    stop,
    createChat,
    selectChat,
    deleteChat,
    togglePinChat,
    refreshStatus,
  } = useAiChat(pathname);

  const [input, setInput] = useState("");
  const [historyOpen, setHistoryOpen] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) refreshStatus();
  }, [open, refreshStatus]);

  const ready = status?.enabled && status?.hasAuth;

  useEffect(() => {
    if (!open || !pendingMessage?.trim() || !ready || streaming) return;
    const msg = pendingMessage.trim();
    onPendingConsumed?.();
    void send(msg);
  }, [
    open,
    pendingMessage,
    ready,
    streaming,
    send,
    onPendingConsumed,
  ]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, activeChatId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleSend = () => {
    if (!input.trim()) return;
    void send(input);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const apiMissing = status?.apiMissing;

  if (!open) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[200] bg-black/30"
        onClick={onClose}
        aria-hidden
      />

      <aside
        className={`fixed top-9 right-0 bottom-0 z-[210] flex min-h-0 border-l border-white/[0.08] shadow-2xl ${
          historyOpen ? "w-[min(600px,96vw)]" : "w-[min(400px,92vw)]"
        }`}
        style={{ background: "#12121a" }}
      >
        {historyOpen && (
          <AiChatHistorySidebar
            sessions={sessions}
            activeChatId={activeChatId}
            streaming={streaming}
            onCreateChat={createChat}
            onSelectChat={selectChat}
            onDeleteChat={deleteChat}
            onTogglePin={togglePinChat}
          />
        )}

        <div className="flex flex-col flex-1 min-w-0 min-h-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] flex-shrink-0 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setHistoryOpen((v) => !v)}
                className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg text-neutral-500 hover:text-neutral-300 hover:bg-white/5 border-none bg-transparent cursor-pointer"
                title={historyOpen ? "Hide history" : "Show history"}
              >
                {historyOpen ? <PanelLeftClose size={15} /> : <PanelLeft size={15} />}
              </button>
              <Sparkles size={16} className="text-[#6c63ff] flex-shrink-0" />
              <span className="text-sm font-semibold text-neutral-200 truncate">
                Beluga AI
              </span>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg text-neutral-500 hover:text-neutral-300 hover:bg-white/5 border-none bg-transparent cursor-pointer"
              title="Close"
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-4 space-y-3">
            {apiMissing && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-center">
                <p className="text-sm text-red-300 mb-1">AI bridge unavailable</p>
                <p className="text-xs text-red-300/70">
                  Restart the app after updating. The preload script may not have loaded.
                </p>
              </div>
            )}

            {!apiMissing && !ready && (
              <div className="rounded-xl border border-[#2a2a3c] bg-[#1a1a24] p-4 text-center">
                <Sparkles size={24} className="mx-auto mb-2 text-[#6c63ff]/60" />
                <p className="text-sm text-neutral-300 mb-1">
                  AI Assistant is not configured
                </p>
                <p className="text-xs text-neutral-500 mb-3">
                  {status?.authMode === "api-key"
                    ? "Enable it in Settings and add your xAI API key."
                    : "Enable it in Settings and sign in with Grok Build."}
                </p>
                <button
                  onClick={() => {
                    onClose();
                    navigate("/settings");
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6c63ff] hover:text-[#8b84ff] bg-transparent border-none cursor-pointer"
                >
                  <Settings size={12} />
                  Open Settings
                </button>
              </div>
            )}

            {!apiMissing && ready && messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-xs text-neutral-500 px-1">
                  Ask anything about Beluga, Sui, Walrus, or your workflow.
                </p>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => void send(s)}
                    className="block w-full text-left text-xs text-neutral-400 hover:text-neutral-200 border border-white/[0.06] hover:border-[#6c63ff]/30 rounded-lg px-3 py-2 bg-white/[0.02] hover:bg-[#6c63ff]/08 cursor-pointer transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex w-full min-w-0 ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[92%] min-w-0 shrink rounded-xl px-3 py-2 text-[13px] leading-relaxed break-words ${
                    msg.tools?.length
                      ? "overflow-visible"
                      : "overflow-hidden"
                  } ${
                    msg.role === "user"
                      ? "bg-[#6c63ff]/20 text-neutral-100"
                      : msg.error
                        ? "bg-red-500/10 text-red-300 border border-red-500/20"
                        : "bg-white/[0.04] text-neutral-300"
                  }`}
                >
                  {msg.tools && msg.tools.length > 0 && (
                    <div className="flex flex-col gap-1.5 mb-2 min-w-0 overflow-visible">
                      {msg.tools.map((tool) => (
                        <AiToolCallCard key={tool.id} tool={tool} />
                      ))}
                    </div>
                  )}
                  {msg.streaming &&
                    !msg.content &&
                    !(msg.tools ?? []).some((t) => t.status === "running") && (
                      <AiThinkingIndicator />
                    )}
                  {msg.streaming &&
                    !msg.content &&
                    (msg.tools ?? []).some((t) => t.status === "running") && (
                      <AiThinkingIndicator label="Using tools" />
                    )}
                  {msg.content &&
                    (!msg.error ? (
                      <div className="min-w-0 max-w-full overflow-hidden">
                        <AiChatMarkdown
                          content={msg.content}
                          variant={msg.role === "user" ? "user" : "assistant"}
                        />
                        {msg.streaming && msg.role === "assistant" && (
                          <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-[#6c63ff] animate-pulse align-middle" />
                        )}
                      </div>
                    ) : (
                      <span className="whitespace-pre-wrap break-words">
                        {msg.content}
                      </span>
                    ))}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="p-3 border-t border-white/[0.06] flex-shrink-0 min-w-0">
            <div className="flex items-end gap-2 min-w-0">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={
                  ready ? "Ask Beluga AI…" : "Configure AI in Settings first"
                }
                disabled={!ready || streaming}
                rows={1}
                className="flex-1 min-w-0 resize-none border border-white/[0.08] rounded-xl px-3 py-2.5 text-[13px] text-neutral-200 placeholder:text-neutral-600 outline-none focus:border-[#6c63ff]/50 transition-colors disabled:opacity-40"
                style={{ background: "#0a0a0f", maxHeight: 120 }}
              />
              {streaming ? (
                <button
                  onClick={stop}
                  className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 border-none cursor-pointer"
                  title="Stop"
                >
                  <Square size={14} fill="currentColor" />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!ready || !input.trim()}
                  className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl bg-[#6c63ff] text-white hover:bg-[#5a52e0] border-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Send"
                >
                  <Send size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>,
    document.body,
  );
}