import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { ConsoleErrorBoundary } from "./ConsoleErrorBoundary";
import { ConsoleWorkspace } from "../pages/consoleComponents/ConsoleWorkspace";

const DRAWER_HEIGHT_KEY = "beluga-console-drawer-height-v1";
const DEFAULT_HEIGHT = 360;
const MIN_HEIGHT = 280;
const MAX_RATIO = 0.75;

function loadHeight(): number {
  try {
    const raw = localStorage.getItem(DRAWER_HEIGHT_KEY);
    const parsed = raw ? Number(raw) : DEFAULT_HEIGHT;
    if (!Number.isFinite(parsed)) return DEFAULT_HEIGHT;
    return Math.min(
      window.innerHeight * MAX_RATIO,
      Math.max(MIN_HEIGHT, parsed),
    );
  } catch {
    return DEFAULT_HEIGHT;
  }
}

export function BelugaConsoleDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [height, setHeight] = useState(loadHeight);
  const [workspaceKey, setWorkspaceKey] = useState(0);
  const [snapshot, setSnapshot] = useState({
    playground: [] as Array<{
      id: string;
      level: "info" | "success" | "warn" | "error";
      message: string;
      timestamp: number;
    }>,
    sui: [] as string[],
    ika: [] as string[],
  });

  useEffect(() => {
    if (!open) return;

    const api = window.belugaConsole;
    if (!api) return;

    void api.getSnapshot().then(setSnapshot);
    const unsub = api.onLogsUpdated((payload) => {
      setSnapshot({
        playground: payload.playground,
        sui: payload.sui,
        ika: payload.ika,
      });
    });

    return () => {
      unsub();
    };
  }, [open]);

  const clearLogs = useCallback(
    async (target: "playground" | "sui" | "ika" | "all") => {
      const api = window.belugaConsole;
      if (!api) return;
      if (target === "all") {
        await Promise.all([
          api.clearLogs("playground"),
          api.clearLogs("sui"),
          api.clearLogs("ika"),
        ]);
        return;
      }
      await api.clearLogs(target);
    },
    [],
  );

  const startResize = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    const startY = event.clientY;
    const startH = height;

    const onMove = (moveEvent: MouseEvent) => {
      const next = Math.min(
        window.innerHeight * MAX_RATIO,
        Math.max(MIN_HEIGHT, startH + (startY - moveEvent.clientY)),
      );
      setHeight(next);
      localStorage.setItem(DRAWER_HEIGHT_KEY, String(next));
    };

    const onUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [height]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-x-0 bottom-0 z-[300] flex flex-col border-t border-[#4ca3ff]/25 bg-[#080810] shadow-[0_-12px_48px_rgba(0,0,0,0.55)]"
      style={{ height }}
    >
      <div
        role="separator"
        aria-orientation="horizontal"
        onMouseDown={startResize}
        className="h-2 cursor-row-resize flex-shrink-0 bg-[#101018] hover:bg-[#4ca3ff]/15 border-b border-white/[0.06] flex items-center justify-center"
      >
        <div className="w-10 h-px rounded-full bg-[#4ca3ff]/40" />
      </div>

      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.06] bg-[#101018] flex-shrink-0">
        <span className="text-[11px] text-[#666688]">Logs &amp; terminal</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void window.belugaConsole?.open?.()}
            className="h-7 px-2 rounded-lg border border-[#2a2a3c] text-[10px] text-[#8888a0] hover:text-[#4ca3ff] cursor-pointer bg-transparent"
          >
            Pop out
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 rounded-lg border border-[#2a2a3c] text-[#8888a0] hover:text-[#f0f0f5] cursor-pointer bg-transparent flex items-center justify-center"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ConsoleErrorBoundary
          onReset={() => {
            setWorkspaceKey((value) => value + 1);
          }}
        >
          {window.belugaConsole ? (
            <ConsoleWorkspace
              key={`drawer-console-${workspaceKey}`}
              playground={snapshot.playground}
              sui={snapshot.sui}
              ika={snapshot.ika}
              onClear={clearLogs}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-[13px] text-[#8888a0]">
              Console bridge unavailable. Restart Beluga.
            </div>
          )}
        </ConsoleErrorBoundary>
      </div>
    </div>,
    document.body,
  );
}