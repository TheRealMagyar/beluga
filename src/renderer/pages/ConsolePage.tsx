import { useEffect, useState, type CSSProperties } from "react";
import { ConsoleErrorBoundary } from "../components/ConsoleErrorBoundary";
import { ConsoleWorkspace } from "./consoleComponents/ConsoleWorkspace";

const isMac = window.electronAPI?.platform === "darwin";

function ConsoleWindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    window.belugaConsole.isMaximized().then(setIsMaximized);
  }, []);

  const btn =
    "h-8 w-10 flex items-center justify-center border-none bg-transparent cursor-pointer transition-colors text-neutral-500 hover:text-neutral-200";

  return (
    <div className="flex items-center h-full">
      <button
        onClick={() => window.belugaConsole.minimize()}
        className={`${btn} hover:bg-white/10`}
        title="Minimize"
      >
        <svg width="11" height="1" viewBox="0 0 11 1" fill="currentColor">
          <rect width="11" height="1" />
        </svg>
      </button>
      <button
        onClick={async () => {
          await window.belugaConsole.maximize();
          setIsMaximized(await window.belugaConsole.isMaximized());
        }}
        className={`${btn} hover:bg-white/10`}
        title={isMaximized ? "Restore" : "Maximize"}
      >
        {isMaximized ? (
          <svg
            width="11"
            height="11"
            viewBox="0 0 11 11"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          >
            <rect x="3" y="0" width="8" height="8" />
            <path d="M0 3 L0 11 L8 11" />
          </svg>
        ) : (
          <svg
            width="11"
            height="11"
            viewBox="0 0 11 11"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          >
            <rect x="0" y="0" width="11" height="11" />
          </svg>
        )}
      </button>
      <button
        onClick={() => window.belugaConsole.close()}
        className={`${btn} hover:bg-red-500 hover:text-white`}
        title="Close"
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 11 11"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
        >
          <path d="M0 0 L11 11 M11 0 L0 11" />
        </svg>
      </button>
    </div>
  );
}

export function ConsolePage() {
  const [snapshot, setSnapshot] = useState({
    playground: [] as Array<{
      id: string;
      level: "info" | "success" | "warn" | "error";
      message: string;
      timestamp: number;
    }>,
    sui: [] as StreamLogEntry[],
    ika: [] as StreamLogEntry[],
  });
  const [workspaceKey, setWorkspaceKey] = useState(0);

  useEffect(() => {
    window.belugaConsole.getSnapshot().then(setSnapshot);
    return window.belugaConsole.onLogsUpdated((payload) => {
      setSnapshot({
        playground: payload.playground,
        sui: payload.sui,
        ika: payload.ika,
      });
    });
  }, []);

  const clearLogs = async (target: "playground" | "sui" | "ika" | "all") => {
    if (target === "all") {
      await Promise.all([
        window.belugaConsole.clearLogs("playground"),
        window.belugaConsole.clearLogs("sui"),
        window.belugaConsole.clearLogs("ika"),
      ]);
      return;
    }
    await window.belugaConsole.clearLogs(target);
  };

  return (
    <div className="flex flex-col h-screen bg-[#07070e] text-[#f0f0f5] overflow-hidden select-none">
      <div
        className={`flex-shrink-0 flex items-center border-b border-white/[0.05] bg-[#0a0a0f] ${
          isMac ? "h-10" : "h-9"
        }`}
        style={{ WebkitAppRegion: "drag" } as CSSProperties}
      >
        {isMac && <div className="w-[78px] flex-shrink-0 h-full" />}
        <div className="flex-1 h-full" />
        {!isMac && (
          <div style={{ WebkitAppRegion: "no-drag" } as CSSProperties}>
            <ConsoleWindowControls />
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 h-0">
        <ConsoleErrorBoundary
          onReset={() => setWorkspaceKey((value) => value + 1)}
        >
          <ConsoleWorkspace
            key={`console-workspace-${workspaceKey}`}
            playground={snapshot.playground}
            sui={snapshot.sui}
            ika={snapshot.ika}
            onClear={clearLogs}
            layout="auto"
            autoStartTerminal
          />
        </ConsoleErrorBoundary>
      </div>
    </div>
  );
}

export default ConsolePage;