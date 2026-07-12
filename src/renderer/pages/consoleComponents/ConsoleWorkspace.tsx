import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Terminal } from "lucide-react";
import { ResizeHandle } from "../../components/ResizeHandle";
import { LogStreamPanel, type PlaygroundLogEntry } from "./LogStreamPanel";

const TerminalPanel = lazy(() =>
  import("./TerminalPanel").then((module) => ({
    default: module.TerminalPanel,
  })),
);

const TERMINAL_WIDTH_KEY = "beluga-console-terminal-width-v1";
const TERMINAL_HEIGHT_KEY = "beluga-console-terminal-height-v1";
const SPLIT_MIN_WIDTH = 860;
const DEFAULT_TERMINAL_WIDTH = 400;
const DEFAULT_TERMINAL_HEIGHT = 280;
const MIN_TERMINAL_WIDTH = 260;
const MIN_TERMINAL_HEIGHT = 140;
const MIN_LOGS_HEIGHT = 180;
const MAX_TERMINAL_WIDTH_RATIO = 0.58;
const MAX_TERMINAL_HEIGHT_RATIO = 0.5;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function loadTerminalWidth(containerWidth: number): number {
  try {
    const raw = localStorage.getItem(TERMINAL_WIDTH_KEY);
    const parsed = raw ? Number(raw) : DEFAULT_TERMINAL_WIDTH;
    if (!Number.isFinite(parsed)) return DEFAULT_TERMINAL_WIDTH;
    return clamp(
      parsed,
      MIN_TERMINAL_WIDTH,
      containerWidth * MAX_TERMINAL_WIDTH_RATIO,
    );
  } catch {
    return DEFAULT_TERMINAL_WIDTH;
  }
}

function loadTerminalHeight(containerHeight: number): number {
  try {
    const raw = localStorage.getItem(TERMINAL_HEIGHT_KEY);
    const parsed = raw ? Number(raw) : DEFAULT_TERMINAL_HEIGHT;
    if (!Number.isFinite(parsed)) return DEFAULT_TERMINAL_HEIGHT;
    return clamp(
      parsed,
      MIN_TERMINAL_HEIGHT,
      containerHeight * MAX_TERMINAL_HEIGHT_RATIO,
    );
  } catch {
    return DEFAULT_TERMINAL_HEIGHT;
  }
}

function defaultStackHeight(containerHeight: number, short: boolean) {
  const ratio = short ? 0.42 : 0.36;
  return clamp(
    Math.round(containerHeight * ratio),
    MIN_TERMINAL_HEIGHT,
    containerHeight * MAX_TERMINAL_HEIGHT_RATIO,
  );
}

function TerminalShell({
  active,
  onStart,
}: {
  active: boolean;
  onStart: () => void;
}) {
  if (active) {
    return (
      <div className="h-full min-h-0 flex flex-col">
        <Suspense
          fallback={
            <div className="h-full flex items-center justify-center text-[11px] text-[#666688] bg-[#06060c]">
              Loading terminal…
            </div>
          }
        >
          <TerminalPanel />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 sm:gap-4 bg-[#06060c] px-4 sm:px-8 text-center">
      <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-[#4ca3ff]/10 border border-[#4ca3ff]/25 flex items-center justify-center">
        <Terminal size={20} className="text-[#4ca3ff] sm:hidden" />
        <Terminal size={22} className="text-[#4ca3ff] hidden sm:block" />
      </div>
      <div>
        <p className="text-[12px] sm:text-[13px] font-medium text-[#d6d6e8]">
          Playground shell
        </p>
        <p className="text-[11px] sm:text-[12px] text-[#666688] max-w-xs leading-relaxed mt-1">
          Interactive zsh in your playground workspace.
        </p>
      </div>
      <button
        type="button"
        onClick={onStart}
        className="h-8 sm:h-9 px-4 sm:px-5 rounded-xl border border-[#4ca3ff]/35 bg-[#4ca3ff]/12 text-[#4ca3ff] hover:bg-[#4ca3ff]/20 cursor-pointer text-[11px] sm:text-[12px] font-medium transition-colors"
      >
        Start terminal
      </button>
    </div>
  );
}

export function ConsoleWorkspace({
  playground,
  sui,
  ika,
  onClear,
  layout = "auto",
  autoStartTerminal = false,
  className = "",
}: {
  playground: PlaygroundLogEntry[];
  sui: Array<string | StreamLogEntry>;
  ika: Array<string | StreamLogEntry>;
  onClear: (target: "playground" | "sui" | "ika" | "all") => void | Promise<void>;
  layout?: "auto" | "split" | "stack";
  autoStartTerminal?: boolean;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const [terminalWidth, setTerminalWidth] = useState(() =>
    loadTerminalWidth(window.innerWidth),
  );
  const [terminalHeight, setTerminalHeight] = useState(() =>
    loadTerminalHeight(window.innerHeight),
  );
  const [terminalActive, setTerminalActive] = useState(autoStartTerminal);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setContainerSize({ width, height });
      setTerminalWidth((prev) =>
        clamp(prev, MIN_TERMINAL_WIDTH, width * MAX_TERMINAL_WIDTH_RATIO),
      );
      setTerminalHeight((prev) =>
        clamp(prev, MIN_TERMINAL_HEIGHT, height * MAX_TERMINAL_HEIGHT_RATIO),
      );
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const useSplit =
    layout === "split" ||
    (layout === "auto" && containerSize.width >= SPLIT_MIN_WIDTH);

  const handleTerminalWidthResize = useCallback((delta: number) => {
    setTerminalWidth((prev) => {
      const max = containerSize.width * MAX_TERMINAL_WIDTH_RATIO;
      const next = clamp(prev + delta, MIN_TERMINAL_WIDTH, max);
      localStorage.setItem(TERMINAL_WIDTH_KEY, String(next));
      return next;
    });
  }, [containerSize.width]);

  const handleTerminalHeightResize = useCallback((delta: number) => {
    setTerminalHeight((prev) => {
      const max = containerSize.height * MAX_TERMINAL_HEIGHT_RATIO;
      const next = clamp(prev - delta, MIN_TERMINAL_HEIGHT, max);
      localStorage.setItem(TERMINAL_HEIGHT_KEY, String(next));
      return next;
    });
  }, [containerSize.height]);

  const stackTerminalHeight = clamp(
    terminalHeight || defaultStackHeight(containerSize.height, containerSize.height < 520),
    MIN_TERMINAL_HEIGHT,
    Math.max(
      MIN_TERMINAL_HEIGHT,
      containerSize.height - MIN_LOGS_HEIGHT,
    ),
  );

  const splitTerminalWidth = clamp(
    terminalWidth,
    MIN_TERMINAL_WIDTH,
    Math.max(
      MIN_TERMINAL_WIDTH,
      containerSize.width - 320,
    ),
  );

  const terminalPane = (
    <div className="flex flex-col h-full min-h-0 rounded-lg sm:rounded-xl border border-[#4ca3ff]/15 bg-[#06060c] overflow-hidden shadow-[inset_0_1px_0_rgba(76,163,255,0.06)]">
      <TerminalShell
        active={terminalActive}
        onStart={() => setTerminalActive(true)}
      />
    </div>
  );

  const logsPane = (
    <div className="flex flex-col h-full min-h-0 rounded-lg sm:rounded-xl border border-white/[0.06] bg-[#080810] overflow-hidden">
      <LogStreamPanel
        playground={playground}
        sui={sui}
        ika={ika}
        onClear={onClear}
      />
    </div>
  );

  if (useSplit) {
    return (
      <div
        ref={rootRef}
        className={`flex items-stretch min-h-0 h-full p-2 sm:p-3 ${className}`}
      >
        <div className="flex-1 min-w-[200px] min-h-0 h-full">{logsPane}</div>
        <ResizeHandle
          direction="horizontal"
          onResize={handleTerminalWidthResize}
        />
        <div
          className="flex-shrink-0 min-h-0 h-full flex flex-col min-w-[240px]"
          style={{ width: splitTerminalWidth }}
        >
          {terminalPane}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={`flex flex-col min-h-0 h-full p-2 sm:p-3 ${className}`}
    >
      <div className="flex-1 min-h-0">{logsPane}</div>
      <ResizeHandle direction="vertical" onResize={handleTerminalHeightResize} />
      <div
        className="flex-shrink-0 min-h-0 flex flex-col"
        style={{ height: stackTerminalHeight }}
      >
        {terminalPane}
      </div>
    </div>
  );
}