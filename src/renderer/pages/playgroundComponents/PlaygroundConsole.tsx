import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Terminal,
  ChevronDown,
  ChevronUp,
  Trash2,
  Copy,
  Check,
  Info,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { ResizeHandle } from "../../components/ResizeHandle";
import type { ConsoleLog } from "./types";

const LEVEL_META = {
  info: {
    icon: Info,
    color: "text-[#c7d0e0]",
    badge: "bg-[#4ca3ff]/15 text-[#4ca3ff] border-[#4ca3ff]/25",
    label: "INFO",
  },
  success: {
    icon: CheckCircle2,
    color: "text-[#00d4aa]",
    badge: "bg-[#00d4aa]/15 text-[#00d4aa] border-[#00d4aa]/25",
    label: "OK",
  },
  warn: {
    icon: AlertTriangle,
    color: "text-[#ffb347]",
    badge: "bg-[#ffb347]/15 text-[#ffb347] border-[#ffb347]/25",
    label: "WARN",
  },
  error: {
    icon: XCircle,
    color: "text-[#ff8fa8]",
    badge: "bg-[#ff4d6d]/15 text-[#ff4d6d] border-[#ff4d6d]/25",
    label: "ERR",
  },
} as const;

type LevelFilter = ConsoleLog["level"] | "all";

const CONSOLE_HEIGHT_KEY = "beluga-playground-console-height-v2";
const CONSOLE_OPEN_KEY = "beluga-playground-console-open-v1";
const DEFAULT_CONSOLE_HEIGHT = 220;
const MIN_CONSOLE_HEIGHT = 120;
const MAX_CONSOLE_HEIGHT_RATIO = 0.5;

const HEX_ID = /(0x[0-9a-fA-F]+)/g;

function loadConsoleHeight() {
  try {
    const raw = localStorage.getItem(CONSOLE_HEIGHT_KEY);
    const parsed = raw ? Number(raw) : DEFAULT_CONSOLE_HEIGHT;
    if (!Number.isFinite(parsed)) return DEFAULT_CONSOLE_HEIGHT;
    const max = Math.max(
      MIN_CONSOLE_HEIGHT,
      Math.floor(window.innerHeight * MAX_CONSOLE_HEIGHT_RATIO),
    );
    return Math.min(max, Math.max(MIN_CONSOLE_HEIGHT, parsed));
  } catch {
    return DEFAULT_CONSOLE_HEIGHT;
  }
}

function loadConsoleOpen() {
  try {
    return localStorage.getItem(CONSOLE_OPEN_KEY) !== "false";
  } catch {
    return true;
  }
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  }
}

function InlineCopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await copyText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }}
      title="Copy"
      className="inline-flex h-5 w-5 items-center justify-center rounded-md text-[#55556a] hover:text-[#f0f0f5] hover:bg-white/[0.06] cursor-pointer align-middle"
    >
      {copied ? (
        <Check size={10} className="text-[#00d4aa]" />
      ) : (
        <Copy size={10} />
      )}
    </button>
  );
}

function LogMessage({ message }: { message: string }) {
  const parts = message.split(HEX_ID);
  if (parts.length === 1) return <>{message}</>;

  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("0x") ? (
          <span key={`${part}-${i}`} className="inline-flex items-center gap-0.5">
            <span className="text-[#e8e8f0]">{part}</span>
            <InlineCopyBtn value={part} />
          </span>
        ) : (
          <span key={`text-${i}`}>{part}</span>
        ),
      )}
    </>
  );
}

function formatLogLine(log: ConsoleLog) {
  const time = new Date(log.timestamp).toISOString();
  return `[${time}] [${log.level.toUpperCase()}] ${log.message}`;
}

function LogEntry({
  log,
  onCopyLine,
}: {
  log: ConsoleLog;
  onCopyLine: (text: string) => void;
}) {
  const meta = LEVEL_META[log.level];
  const Icon = meta.icon;
  const time = new Date(log.timestamp).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="group flex gap-2.5 px-3 py-1.5 hover:bg-white/[0.03] rounded-lg transition-colors">
      <span className="text-[10px] font-mono text-[#55556a] w-[62px] flex-shrink-0 pt-0.5 select-none">
        {time}
      </span>
      <span
        className={`flex-shrink-0 h-5 px-1.5 rounded-md border text-[9px] font-bold tracking-wide flex items-center gap-1 select-none ${meta.badge}`}
      >
        <Icon size={10} />
        {meta.label}
      </span>
      <pre
        className={`flex-1 min-w-0 text-[12px] font-mono leading-relaxed whitespace-pre-wrap break-words m-0 select-text cursor-text ${meta.color}`}
      >
        <LogMessage message={log.message} />
      </pre>
      <button
        type="button"
        onClick={() => onCopyLine(formatLogLine(log))}
        title="Copy line"
        className="flex-shrink-0 h-6 w-6 rounded-md text-[#55556a] hover:text-[#f0f0f5] hover:bg-white/[0.06] cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity duration-150"
      >
        <Copy size={12} />
      </button>
    </div>
  );
}

export function PlaygroundConsole({
  logs,
  onClear,
  onCommand,
}: {
  logs: ConsoleLog[];
  onClear: () => void;
  onCommand?: (command: string) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(() => loadConsoleOpen());
  const [height, setHeight] = useState(() => loadConsoleHeight());
  const [filter, setFilter] = useState<LevelFilter>("all");
  const [copied, setCopied] = useState(false);
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [running, setRunning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const stickToBottomRef = useRef(true);

  const filtered = useMemo(() => {
    if (filter === "all") return logs;
    return logs.filter((log) => log.level === filter);
  }, [logs, filter]);

  const counts = useMemo(() => {
    const map = { info: 0, success: 0, warn: 0, error: 0 };
    for (const log of logs) map[log.level] += 1;
    return map;
  }, [logs]);

  useEffect(() => {
    localStorage.setItem(CONSOLE_OPEN_KEY, String(open));
  }, [open]);

  useEffect(() => {
    const onResize = () => {
      const max = Math.max(
        MIN_CONSOLE_HEIGHT,
        Math.floor(window.innerHeight * MAX_CONSOLE_HEIGHT_RATIO),
      );
      setHeight((prev) => Math.min(prev, max));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [filtered.length, running, open]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distance < 48;
  }, []);

  const handleResizeHeight = useCallback((delta: number) => {
    setHeight((prev) => {
      const max = Math.max(
        MIN_CONSOLE_HEIGHT,
        Math.floor(window.innerHeight * MAX_CONSOLE_HEIGHT_RATIO),
      );
      const next = Math.min(max, Math.max(MIN_CONSOLE_HEIGHT, prev + delta));
      localStorage.setItem(CONSOLE_HEIGHT_KEY, String(next));
      return next;
    });
  }, []);

  const copyLogs = async () => {
    await copyText(filtered.map(formatLogLine).join("\n"));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const submitCommand = async () => {
    const trimmed = command.trim();
    if (!trimmed || running) return;

    const lower = trimmed.toLowerCase();
    if (lower === "clear") {
      onClear();
      setCommand("");
      setHistoryIndex(-1);
      return;
    }

    if (lower === "help") {
      await onCommand?.("__help__");
      setHistory((prev) => [...prev, trimmed]);
      setHistoryIndex(-1);
      setCommand("");
      return;
    }

    stickToBottomRef.current = true;
    setHistory((prev) => [...prev, trimmed]);
    setHistoryIndex(-1);
    setCommand("");
    setRunning(true);
    try {
      await onCommand?.(trimmed);
    } finally {
      setRunning(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void submitCommand();
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!history.length) return;
      const nextIndex =
        historyIndex < 0
          ? history.length - 1
          : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setCommand(history[nextIndex] ?? "");
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (historyIndex < 0) return;
      const nextIndex = historyIndex + 1;
      if (nextIndex >= history.length) {
        setHistoryIndex(-1);
        setCommand("");
      } else {
        setHistoryIndex(nextIndex);
        setCommand(history[nextIndex] ?? "");
      }
    }
  };

  return (
    <div className="flex-shrink-0 border-t border-white/[0.06] bg-[#080810] min-h-0">
      <div className="flex items-center gap-2 px-4 h-10 bg-[#101018] border-b border-white/[0.04]">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex items-center gap-2 text-[12px] text-[#c7c7d8] hover:text-[#f0f0f5] bg-transparent border-none cursor-pointer p-0"
        >
          <Terminal size={14} className="text-[#4ca3ff]" />
          <span className="font-medium">Console</span>
          <span className="text-[#55556a] font-mono">{logs.length}</span>
          {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>

        <div className="flex items-center gap-1 ml-1 overflow-x-auto scrollbar-none">
          {(["all", "info", "success", "warn", "error"] as LevelFilter[]).map(
            (level) => {
              const count =
                level === "all"
                  ? logs.length
                  : counts[level as ConsoleLog["level"]];
              if (level !== "all" && count === 0) return null;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => setFilter(level)}
                  className={`h-6 px-2 rounded-md text-[10px] font-medium border cursor-pointer transition-colors duration-150 whitespace-nowrap ${
                    filter === level
                      ? "border-[#4ca3ff]/35 bg-[#4ca3ff]/10 text-[#4ca3ff]"
                      : "border-transparent bg-white/[0.03] text-[#8888a0] hover:text-[#f0f0f5]"
                  }`}
                >
                  {level === "all" ? "All" : LEVEL_META[level].label}
                  <span className="ml-1 opacity-70">{count}</span>
                </button>
              );
            },
          )}
        </div>

        <div className="flex-1 min-w-2" />

        <button
          type="button"
          onClick={() => void copyLogs()}
          disabled={!filtered.length}
          className="h-7 px-2.5 rounded-lg text-[11px] text-[#8888a0] hover:text-[#f0f0f5] bg-transparent border border-[#2a2a3c] cursor-pointer disabled:opacity-40 flex items-center gap-1.5 transition-colors duration-150"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          Copy
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={!logs.length}
          className="h-7 px-2.5 rounded-lg text-[11px] text-[#8888a0] hover:text-[#ff4d6d] bg-transparent border border-[#2a2a3c] cursor-pointer disabled:opacity-40 flex items-center gap-1.5 transition-colors duration-150"
        >
          <Trash2 size={12} />
          Clear
        </button>
      </div>

      {open && (
        <>
          <ResizeHandle direction="vertical" onResize={handleResizeHeight} />
          <div
            className="flex flex-col min-h-0 overflow-hidden"
            style={{ height }}
          >
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex-1 min-h-0 overflow-y-auto overflow-x-auto select-text"
              style={{ background: "#06060c" }}
            >
              {filtered.length === 0 ? (
                <div className="h-full min-h-[80px] flex flex-col items-center justify-center text-center px-6 py-6">
                  <Terminal size={28} className="text-[#2a2a3c] mb-3" />
                  <p className="text-[13px] text-[#8888a0] leading-relaxed">
                    Build output and transaction logs appear here.
                    {onCommand && (
                      <>
                        {" "}
                        Type commands below — try{" "}
                        <span className="font-mono text-[#c7c7d8]">help</span>.
                      </>
                    )}
                  </p>
                </div>
              ) : (
                <div className="py-1">
                  {filtered.map((log) => (
                    <LogEntry
                      key={log.id}
                      log={log}
                      onCopyLine={(text) => void copyText(text)}
                    />
                  ))}
                </div>
              )}
            </div>

            {onCommand && (
              <div className="flex-shrink-0 border-t border-white/[0.06] bg-[#0d0d14] px-3 py-2">
                <div className="flex items-center gap-2 rounded-xl border border-[#2a2a3c] bg-[#080810] px-3 h-9 focus-within:border-[#4ca3ff]/35 transition-colors duration-150">
                  <span className="text-[#4ca3ff] font-mono text-[12px] select-none">
                    $
                  </span>
                  <input
                    ref={inputRef}
                    value={command}
                    onChange={(e) => {
                      setCommand(e.target.value);
                      if (historyIndex >= 0) setHistoryIndex(-1);
                    }}
                    onKeyDown={handleKeyDown}
                    disabled={running}
                    placeholder={
                      running ? "Running…" : "sui client gas · help · clear"
                    }
                    spellCheck={false}
                    className="flex-1 min-w-0 bg-transparent border-none outline-none text-[12px] font-mono text-[#e8e8f0] placeholder:text-[#55556a]"
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}