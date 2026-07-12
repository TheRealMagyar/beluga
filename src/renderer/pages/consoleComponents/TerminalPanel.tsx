import { useCallback, useEffect, useRef, useState } from "react";
import { FolderOpen, RotateCcw, Terminal } from "lucide-react";
import { useViewport } from "../../hooks/useViewport";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

export function TerminalPanel() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"live" | "stopped" | "starting">(
    "starting",
  );
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const sessionRef = useRef<string | null>(null);
  const bootIdRef = useRef(0);
  const ptyOutputDepthRef = useRef(0);
  const dataDisposableRef = useRef<{ dispose: () => void } | null>(null);
  const { compact } = useViewport();

  const fitTerminal = useCallback(() => {
    const fit = fitRef.current;
    const term = termRef.current;
    const host = hostRef.current;
    if (!fit || !term || !host) return;

    try {
      fit.fit();
      const cols = term.cols;
      const rows = term.rows;
      const id = sessionRef.current;
      if (id && cols > 0 && rows > 0) {
        void window.belugaConsole?.terminalResize?.(id, cols, rows);
      }
      const viewport = host.querySelector(".xterm-viewport");
      if (viewport instanceof HTMLElement) {
        viewport.scrollTop = 0;
      }
    } catch {
      // host may be zero-sized during layout
    }
  }, []);

  const settleLayout = useCallback(async () => {
    for (const delay of [0, 50, 150]) {
      if (delay > 0) {
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, delay);
        });
      }
      fitTerminal();
    }
  }, [fitTerminal]);

  const writePtyOutput = useCallback((data: string) => {
    const term = termRef.current;
    if (!term) return;
    ptyOutputDepthRef.current += 1;
    term.write(data, () => {
      ptyOutputDepthRef.current = Math.max(0, ptyOutputDepthRef.current - 1);
    });
  }, []);

  const disposeTerminal = useCallback(() => {
    dataDisposableRef.current?.dispose();
    dataDisposableRef.current = null;
    termRef.current?.dispose();
    termRef.current = null;
    fitRef.current = null;
  }, []);

  const waitForHostSize = useCallback(async (host: HTMLElement) => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (host.clientWidth > 0 && host.clientHeight > 0) return true;
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    }
    return host.clientWidth > 0 && host.clientHeight > 0;
  }, []);

  const attachInputHandler = useCallback((term: XTerm) => {
    dataDisposableRef.current?.dispose();
    dataDisposableRef.current = term.onData((data) => {
      if (ptyOutputDepthRef.current > 0) return;
      const id = sessionRef.current;
      if (!id) return;
      void window.belugaConsole?.terminalWrite?.(id, data);
    });
  }, []);

  const boot = useCallback(async () => {
    const bootId = ++bootIdRef.current;
    setLoading(true);
    setStatus("starting");
    disposeTerminal();
    sessionRef.current = null;
    setSessionId(null);

    const host = hostRef.current;
    if (!host) {
      setLoading(false);
      setStatus("stopped");
      return;
    }

    if (!(await waitForHostSize(host))) {
      setLoading(false);
      setStatus("stopped");
      return;
    }

    const api = window.belugaConsole;
    if (!api) {
      setLoading(false);
      setStatus("stopped");
      return;
    }

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 13,
      lineHeight: 1,
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
      theme: {
        background: "#06060c",
        foreground: "#d6d6e8",
        cursor: "#4ca3ff",
        selectionBackground: "#4ca3ff44",
      },
      scrollback: 5000,
      allowProposedApi: false,
      customGlyphs: false,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    try {
      term.open(host);
    } catch (err: unknown) {
      disposeTerminal();
      const message =
        err instanceof Error ? err.message : "Terminal UI failed to initialize.";
      setLoading(false);
      setStatus("stopped");
      throw new Error(message);
    }
    termRef.current = term;
    fitRef.current = fit;

    if (bootId !== bootIdRef.current) return;
    await settleLayout();

    try {
      const cwd = await api.getWorkspace();
      if (bootId !== bootIdRef.current) return;

      setWorkspace(cwd);
      await settleLayout();

      const session = await api.terminalCreate({
        cols: Math.max(term.cols, 80),
        rows: Math.max(term.rows, 24),
      });
      if (bootId !== bootIdRef.current) {
        await api.terminalKill(session.id);
        return;
      }

      sessionRef.current = session.id;
      setSessionId(session.id);
      setStatus("live");
      attachInputHandler(term);
      term.focus();
    } catch (err: unknown) {
      if (bootId !== bootIdRef.current) return;
      const message =
        err instanceof Error ? err.message : "Failed to start terminal session.";
      term.writeln(`[error] ${message}`);
      setStatus("stopped");
      sessionRef.current = null;
      setSessionId(null);
    } finally {
      if (bootId === bootIdRef.current) {
        setLoading(false);
      }
    }
  }, [
    attachInputHandler,
    disposeTerminal,
    settleLayout,
    waitForHostSize,
  ]);

  useEffect(() => {
    void boot();
    return () => {
      bootIdRef.current += 1;
      const id = sessionRef.current;
      if (id) void window.belugaConsole?.terminalKill?.(id);
      sessionRef.current = null;
      disposeTerminal();
    };
  }, [boot, disposeTerminal]);

  useEffect(() => {
    const api = window.belugaConsole;
    if (!api) return;

    const unsubData = api.onTerminalData(({ sessionId: id, data }) => {
      if (id !== sessionRef.current) return;
      writePtyOutput(data);
    });
    const unsubExit = api.onTerminalExit(({ sessionId: id, code }) => {
      if (id !== sessionRef.current) return;
      const term = termRef.current;
      term?.writeln(
        `\r\n[session exited${code != null ? ` code ${code}` : ""}]`,
      );
      sessionRef.current = null;
      setSessionId(null);
      setStatus("stopped");
    });
    return () => {
      unsubData();
      unsubExit();
    };
  }, [writePtyOutput]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const observer = new ResizeObserver(() => fitTerminal());
    observer.observe(host);
    window.addEventListener("resize", fitTerminal);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fitTerminal);
    };
  }, [fitTerminal, loading]);

  const restart = async () => {
    if (sessionRef.current) {
      await window.belugaConsole.terminalKill(sessionRef.current);
      sessionRef.current = null;
      setSessionId(null);
    }
    termRef.current?.clear();
    await boot();
  };

  const openWorkspace = async () => {
    await window.playground.openWorkspace();
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#06060c]">
      <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 border-b border-[#4ca3ff]/12 bg-[#0c0c14] flex-shrink-0 min-h-[36px]">
        <Terminal size={13} className="text-[#4ca3ff] flex-shrink-0" />
        <span className="text-[10px] sm:text-[11px] font-semibold text-[#c7c7d8] flex-shrink-0">
          Shell
        </span>
        {workspace && !compact && (
          <span className="text-[10px] font-mono text-[#55556a] truncate min-w-0 max-w-[40%] hidden md:block">
            {workspace}
          </span>
        )}
        <div className="flex-1 min-w-2" />
        <button
          onClick={openWorkspace}
          title="Open workspace folder"
          className="h-7 px-1.5 sm:px-2 rounded-lg border border-[#2a2a3c] text-[#8888a0] hover:text-[#f0f0f5] cursor-pointer flex items-center gap-1 text-[10px] bg-transparent flex-shrink-0"
        >
          <FolderOpen size={11} />
          <span className="hidden sm:inline">Folder</span>
        </button>
        <button
          onClick={restart}
          title="Restart shell"
          className="h-7 px-1.5 sm:px-2 rounded-lg border border-[#2a2a3c] text-[#8888a0] hover:text-[#f0f0f5] cursor-pointer flex items-center gap-1 text-[10px] bg-transparent flex-shrink-0"
        >
          <RotateCcw size={11} />
          <span className="hidden sm:inline">Restart</span>
        </button>
        <span
          className={`text-[9px] uppercase tracking-wide font-semibold flex-shrink-0 ${
            status === "live"
              ? "text-[#00d4aa]"
              : status === "starting"
                ? "text-[#ffb347]"
                : "text-[#ff4d6d]"
          }`}
        >
          {compact
            ? status === "starting"
              ? "…"
              : status === "live"
                ? "●"
                : "×"
            : status === "starting"
              ? "Starting"
              : status === "live"
                ? "Live"
                : "Stopped"}
        </span>
      </div>

      <div
        className="flex-1 min-h-0 overflow-hidden flex flex-col relative"
        onMouseDown={() => termRef.current?.focus()}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-[11px] text-[#666688] bg-[#06060c]/90 z-10">
            Starting shell…
          </div>
        )}
        <div ref={hostRef} className="beluga-xterm-host flex-1 min-h-0 w-full" />
      </div>
    </div>
  );
}