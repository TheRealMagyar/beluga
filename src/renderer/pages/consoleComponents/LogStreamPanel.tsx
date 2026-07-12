import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useViewport } from "../../hooks/useViewport";
import {
  Copy,
  Check,
  Trash2,
  Search,
  Info,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  CaseSensitive,
  Regex,
  ArrowDownToLine,
  Activity,
} from "lucide-react";
import { ChainDiagnosticsPanel } from "./ChainDiagnosticsPanel";

const LEVEL_META = {
  info: { icon: Info, color: "text-[#4ca3ff]", badge: "INFO" },
  success: { icon: CheckCircle2, color: "text-[#00d4aa]", badge: "OK" },
  warn: { icon: AlertTriangle, color: "text-[#ffb347]", badge: "WARN" },
  error: { icon: XCircle, color: "text-[#ff4d6d]", badge: "ERR" },
} as const;

export interface PlaygroundLogEntry {
  id: string;
  level: keyof typeof LEVEL_META;
  message: string;
  timestamp: number;
}

type LogSource = "all" | "playground" | "sui" | "ika";
type LevelFilter = keyof typeof LEVEL_META | "all";
type SeverityFilter = "all" | "errors" | "warnings" | "info";

const SOURCE_META = {
  all: { label: "All", accent: "#c7c7d8" },
  playground: { label: "Playground", accent: "#4ca3ff" },
  sui: { label: "Sui", accent: "#7dd3fc" },
  ika: { label: "Ika", accent: "#00e5ff" },
} as const;

function asLogMessage(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "message" in value) {
    const message = (value as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return value == null ? "" : String(value);
}

function normalizeStreamEntries(
  entries: Array<string | StreamLogEntry>,
  source: LogSourceKind,
): StreamLogEntry[] {
  const base = Date.now();
  return entries.map((entry, index) => {
    if (typeof entry !== "string") {
      return {
        id: entry.id || `${source}-${index}`,
        message: asLogMessage(entry.message),
        timestamp:
          typeof entry.timestamp === "number" ? entry.timestamp : base - index,
      };
    }
    return {
      id: `${source}-legacy-${index}-${base}`,
      message: entry,
      timestamp: base - (entries.length - 1 - index),
    };
  });
}

function classifyLine(line: unknown): SeverityFilter {
  const lower = asLogMessage(line).toLowerCase();
  if (
    /\berror\b|fatal|panic|failed|failure|exception|traceback/i.test(lower)
  ) {
    return "errors";
  }
  if (/\bwarn(?:ing)?\b/i.test(lower)) {
    return "warnings";
  }
  return "info";
}

function matchesQuery(
  text: unknown,
  query: string,
  options: { caseSensitive: boolean; regex: boolean },
): boolean {
  const haystack = asLogMessage(text);
  const trimmed = query.trim();
  if (!trimmed) return true;

  if (options.regex) {
    try {
      const flags = options.caseSensitive ? "" : "i";
      return new RegExp(trimmed, flags).test(haystack);
    } catch {
      return false;
    }
  }

  return options.caseSensitive
    ? haystack.includes(trimmed)
    : haystack.toLowerCase().includes(trimmed.toLowerCase());
}

type LogSourceKind = "playground" | "sui" | "ika";
type LogLevel = keyof typeof LEVEL_META;

type DisplayRow = {
  key: string;
  source: LogSourceKind;
  time: string;
  level: LogLevel;
  message: string;
};

function severityToLevel(line: string): LogLevel {
  const severity = classifyLine(line);
  if (severity === "errors") return "error";
  if (severity === "warnings") return "warn";
  return "info";
}

const LOG_MESSAGE_CLASS =
  "text-[12px] font-mono leading-[1.3] whitespace-pre-wrap break-words m-0 min-w-0";

function formatLogTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("en-US", { hour12: false });
}

const SOURCE_SHORT = {
  playground: "PG",
  sui: "SUI",
  ika: "IKA",
} as const;

function FilterChip({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`h-7 px-2.5 rounded-lg text-[10px] font-medium border cursor-pointer whitespace-nowrap transition-colors ${
        active
          ? "border-[#4ca3ff]/35 bg-[#4ca3ff]/10 text-[#4ca3ff]"
          : "border-transparent bg-white/[0.03] text-[#8888a0] hover:text-[#f0f0f5]"
      }`}
    >
      {children}
    </button>
  );
}

export function LogStreamPanel({
  playground,
  sui,
  ika,
  onClear,
}: {
  playground: PlaygroundLogEntry[];
  sui: Array<string | StreamLogEntry>;
  ika: Array<string | StreamLogEntry>;
  onClear: (target: LogSource) => void;
}) {
  const [source, setSource] = useState<LogSource>("all");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [query, setQuery] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { compact } = useViewport();

  const normalizedSui = useMemo(
    () => normalizeStreamEntries(sui, "sui"),
    [sui],
  );
  const normalizedIka = useMemo(
    () => normalizeStreamEntries(ika, "ika"),
    [ika],
  );

  const searchOptions = useMemo(
    () => ({ caseSensitive, regex: useRegex }),
    [caseSensitive, useRegex],
  );

  const filteredPlayground = useMemo(() => {
    let rows = playground;
    if (levelFilter !== "all") {
      rows = rows.filter((row) => row.level === levelFilter);
    }
    rows = rows.filter((row) => matchesQuery(row.message, query, searchOptions));
    return rows;
  }, [playground, levelFilter, query, searchOptions]);

  const filterStreamEntries = useCallback(
    (entries: StreamLogEntry[]) => {
      let rows = entries;
      if (severityFilter !== "all") {
        rows = rows.filter(
          (entry) => classifyLine(entry.message) === severityFilter,
        );
      }
      rows = rows.filter((entry) =>
        matchesQuery(entry.message, query, searchOptions),
      );
      return rows;
    },
    [severityFilter, query, searchOptions],
  );

  const filteredSui = useMemo(
    () => filterStreamEntries(normalizedSui),
    [normalizedSui, filterStreamEntries],
  );
  const filteredIka = useMemo(
    () => filterStreamEntries(normalizedIka),
    [normalizedIka, filterStreamEntries],
  );

  const toPlaygroundRow = useCallback((log: PlaygroundLogEntry): DisplayRow => {
    return {
      key: log.id,
      source: "playground",
      time: formatLogTime(log.timestamp),
      level: log.level,
      message: log.message,
    };
  }, []);

  const toStreamRow = useCallback(
    (sourceKind: "sui" | "ika", entry: StreamLogEntry): DisplayRow => ({
      key: entry.id,
      source: sourceKind,
      time: formatLogTime(entry.timestamp),
      level: severityToLevel(entry.message),
      message: entry.message,
    }),
    [],
  );

  const visibleRows = useMemo((): DisplayRow[] => {
    if (source === "playground") {
      return filteredPlayground.map(toPlaygroundRow);
    }
    if (source === "sui") {
      return filteredSui.map((entry) => toStreamRow("sui", entry));
    }
    if (source === "ika") {
      return filteredIka.map((entry) => toStreamRow("ika", entry));
    }

    return [
      ...filteredPlayground.map(toPlaygroundRow),
      ...filteredSui.map((entry) => toStreamRow("sui", entry)),
      ...filteredIka.map((entry) => toStreamRow("ika", entry)),
    ];
  }, [
    source,
    filteredPlayground,
    filteredSui,
    filteredIka,
    toPlaygroundRow,
    toStreamRow,
  ]);

  const copyText = useMemo(() => {
    return visibleRows
      .map((row) => {
        const time = row.time;
        const level = LEVEL_META[row.level].badge;
        const sourceLabel = SOURCE_META[row.source].label.toUpperCase();
        return `[${time}] [${sourceLabel}] [${level}] ${row.message}`;
      })
      .join("\n");
  }, [visibleRows]);

  const counts = {
    all: playground.length + normalizedSui.length + normalizedIka.length,
    playground: playground.length,
    sui: normalizedSui.length,
    ika: normalizedIka.length,
  };

  const showLevelFilters =
    source === "playground" || source === "all";
  const showSeverityFilters =
    source === "sui" || source === "ika" || source === "all";

  useEffect(() => {
    if (!autoScroll) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visibleRows.length, autoScroll, source]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-shrink-0 border-b border-white/[0.06] bg-[#101018]">
        <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 overflow-x-auto scrollbar-none">
          {(Object.keys(SOURCE_META) as LogSource[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setSource(id)}
              className={`h-7 sm:h-8 px-2 sm:px-3 rounded-lg text-[10px] sm:text-[11px] font-medium border cursor-pointer whitespace-nowrap transition-colors ${
                source === id
                  ? "border-[#4ca3ff]/35 bg-[#4ca3ff]/10 text-[#4ca3ff]"
                  : "border-transparent bg-white/[0.03] text-[#8888a0] hover:text-[#f0f0f5]"
              }`}
            >
              {SOURCE_META[id].label}
              <span className="ml-1.5 opacity-60">{counts[id]}</span>
            </button>
          ))}

          <div className="flex-1 min-w-4" />

          <button
            type="button"
            onClick={() => setDiagnosticsOpen((value) => !value)}
            title={diagnosticsOpen ? "Hide chain diagnostics" : "Chain diagnostics"}
            className={`h-7 sm:h-8 px-2 sm:px-2.5 rounded-lg border cursor-pointer flex items-center gap-1 text-[10px] sm:text-[11px] transition-colors ${
              diagnosticsOpen
                ? "border-[#4ca3ff]/35 bg-[#4ca3ff]/10 text-[#4ca3ff]"
                : "border-[#2a2a3c] text-[#8888a0] hover:text-[#f0f0f5] bg-transparent"
            }`}
          >
            <Activity size={12} />
            <span className="hidden sm:inline">Diagnostics</span>
          </button>
          <button
            type="button"
            onClick={() => setAutoScroll((value) => !value)}
            title={autoScroll ? "Auto-scroll on" : "Auto-scroll off"}
            className={`h-7 sm:h-8 w-7 sm:w-8 rounded-lg border flex items-center justify-center cursor-pointer transition-colors ${
              autoScroll
                ? "border-[#00d4aa]/30 bg-[#00d4aa]/10 text-[#00d4aa]"
                : "border-[#2a2a3c] text-[#8888a0] hover:text-[#f0f0f5]"
            }`}
          >
            <ArrowDownToLine size={14} />
          </button>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(copyText);
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }}
            disabled={!copyText}
            className="h-7 sm:h-8 px-2 sm:px-2.5 rounded-lg border border-[#2a2a3c] text-[#8888a0] hover:text-[#f0f0f5] cursor-pointer disabled:opacity-40 flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-[11px] bg-transparent"
            title="Copy logs"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            <span className="hidden sm:inline">Copy</span>
          </button>
          <button
            type="button"
            onClick={() => onClear(source)}
            className="h-7 sm:h-8 px-2 sm:px-2.5 rounded-lg border border-[#2a2a3c] text-[#8888a0] hover:text-[#ff4d6d] cursor-pointer flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-[11px] bg-transparent"
            title="Clear logs"
          >
            <Trash2 size={12} />
            <span className="hidden sm:inline">Clear</span>
          </button>
        </div>

        <div
          className={`flex gap-1.5 sm:gap-2 px-2 sm:px-3 pb-2 min-h-[36px] sm:min-h-[40px] overflow-x-auto scrollbar-none ${
            compact ? "flex-col items-stretch" : "flex-row items-center"
          }`}
        >
          <div className={`relative flex-shrink-0 ${compact ? "w-full" : ""}`}>
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#55556a]"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={useRegex ? "Regex filter..." : "Search logs..."}
              className={`h-8 pl-8 pr-3 rounded-lg bg-[#0d0d14] border border-[#2a2a3c] text-[12px] text-[#f0f0f5] outline-none focus:border-[#4ca3ff]/40 ${
                compact ? "w-full" : "w-40 sm:w-48"
              }`}
            />
          </div>

          <div
            className={`flex items-center gap-1 flex-shrink-0 ${
              compact ? "w-full overflow-x-auto scrollbar-none" : ""
            }`}
          >
            <button
              type="button"
              title="Case sensitive"
              onClick={() => setCaseSensitive((value) => !value)}
              className={`h-8 w-8 rounded-lg border flex items-center justify-center cursor-pointer transition-colors ${
                caseSensitive
                  ? "border-[#ffb347]/30 bg-[#ffb347]/10 text-[#ffb347]"
                  : "border-[#2a2a3c] text-[#8888a0] hover:text-[#f0f0f5]"
              }`}
            >
              <CaseSensitive size={14} />
            </button>
            <button
              type="button"
              title="Regex search"
              onClick={() => setUseRegex((value) => !value)}
              className={`h-8 w-8 rounded-lg border flex items-center justify-center cursor-pointer transition-colors ${
                useRegex
                  ? "border-[#6c63ff]/30 bg-[#6c63ff]/10 text-[#c4c0ff]"
                  : "border-[#2a2a3c] text-[#8888a0] hover:text-[#f0f0f5]"
              }`}
            >
              <Regex size={14} />
            </button>

            {!compact && (
              <div className="w-px h-6 bg-white/[0.06] flex-shrink-0 mx-0.5" />
            )}

            <div
              className={`flex items-center gap-1 ${
                showLevelFilters ? "" : "opacity-35 pointer-events-none"
              }`}
            >
              {(["all", "info", "success", "warn", "error"] as LevelFilter[]).map(
                (level) => (
                  <FilterChip
                    key={level}
                    active={levelFilter === level}
                    onClick={() => setLevelFilter(level)}
                  >
                    {level === "all"
                      ? compact
                        ? "All"
                        : "All levels"
                      : LEVEL_META[level].badge}
                  </FilterChip>
                ),
              )}
            </div>

            {!compact && (
              <div className="w-px h-6 bg-white/[0.06] flex-shrink-0 mx-0.5" />
            )}

            <div
              className={`flex items-center gap-1 ${
                showSeverityFilters ? "" : "opacity-35 pointer-events-none"
              }`}
            >
              {(
                [
                  ["all", compact ? "All" : "All lines"],
                  ["errors", compact ? "Err" : "Errors"],
                  ["warnings", compact ? "Warn" : "Warnings"],
                  ["info", "Info"],
                ] as const
              ).map(([value, label]) => (
                <FilterChip
                  key={value}
                  active={severityFilter === value}
                  onClick={() => setSeverityFilter(value)}
                >
                  {label}
                </FilterChip>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div
        className="flex-1 min-h-0 relative"
        style={{ background: "#06060c" }}
      >
        <div
          ref={scrollRef}
          className="absolute inset-0 overflow-y-auto px-1 py-0.5 divide-y divide-white/[0.03]"
        >
        {visibleRows.length === 0 ? (
          <EmptyState
            message={
              source === "all"
                ? "Playground, Sui localnet, and Ika process output streams here."
                : source === "playground"
                  ? "Playground build, publish, and transaction output appears here."
                  : `Start ${source === "sui" ? "Sui" : "Ika"} localnet to stream process output.`
            }
          />
        ) : (
          visibleRows.map((row) => (
            <LogLineRow key={row.key} row={row} compact={compact} />
          ))
        )}
        </div>
        <ChainDiagnosticsPanel
          open={diagnosticsOpen}
          onClose={() => setDiagnosticsOpen(false)}
        />
      </div>
    </div>
  );
}

function SourceBadge({
  kind,
  short = false,
}: {
  kind: LogSourceKind;
  short?: boolean;
}) {
  const meta = SOURCE_META[kind];
  return (
    <span
      className="inline-flex items-center justify-center text-[9px] font-bold uppercase tracking-wide px-1 py-0.5 rounded-md whitespace-nowrap"
      style={{
        color: meta.accent,
        background: `${meta.accent}18`,
        border: `1px solid ${meta.accent}30`,
      }}
    >
      {short ? SOURCE_SHORT[kind] : meta.label}
    </span>
  );
}

function LogLineRow({
  row,
  compact,
}: {
  row: DisplayRow;
  compact: boolean;
}) {
  const meta = LEVEL_META[row.level];
  const Icon = meta.icon;

  if (compact) {
    return (
      <div className="px-2 py-0.5 hover:bg-white/[0.02]">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[10px] font-mono text-[#55556a] tabular-nums">
            {row.time}
          </span>
          <SourceBadge kind={row.source} short />
          <span className="text-[10px] font-bold text-[#666] inline-flex items-center gap-0.5">
            <Icon size={10} className={meta.color} />
            {meta.badge}
          </span>
        </div>
        <pre className={`${LOG_MESSAGE_CLASS} ${meta.color}`}>{row.message}</pre>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[54px_58px_40px_minmax(0,1fr)] gap-x-1.5 items-baseline px-2 py-0.5 hover:bg-white/[0.02]">
      <span className="text-[10px] font-mono text-[#55556a] tabular-nums leading-none">
        {row.time}
      </span>
      <SourceBadge kind={row.source} short />
      <span className="text-[10px] font-bold text-[#666] inline-flex items-center gap-0.5 leading-none">
        <Icon size={10} className={meta.color} />
        {meta.badge}
      </span>
      <pre className={`${LOG_MESSAGE_CLASS} ${meta.color}`}>{row.message}</pre>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="h-full min-h-[160px] flex items-center justify-center text-center px-8">
      <p className="text-[13px] text-[#55556a] max-w-md leading-relaxed">
        {message}
      </p>
    </div>
  );
}