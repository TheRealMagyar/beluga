import React, { useState, useEffect } from "react";
import { HashRouter, useLocation } from "react-router-dom";
import { WalrusMemoryApp } from "./pages/MemoryManager";
import { WalletConnectPage } from "../helper/Walletconnectpage";
import { SettingsPage } from "./pages/SettingsPage";
import { DocsPage } from "./pages/DocumentsPage";
import { Sidebar } from "./components/Sidebar";
import "@mysten/dapp-kit/dist/index.css";
import { Providers } from "./components/Providers";
import ProjectManager from "./pages/ProjectManager";
import PlaygroundPage from "./pages/PlaygroundPage";
import PackagesPage from "./pages/PackagesPage";
import ToolsPage from "./pages/ToolsPage";
import SkillsPage from "./pages/SkillsPage";
import LearningPage from "./pages/LearningPage";
import ConsolePage from "./pages/ConsolePage";
import { TradingChartsPage } from "./pages/TradingChartsPage";
import { TradingFeedsPage } from "./pages/TradingFeedsPage";
import { TradingStrategyPage } from "./pages/TradingStrategyPage";
import { WalletProvider } from "./components/Walletcontext";
import { useMcpHandler } from "./hooks/useMcpHandler";
import { PackagesActivityProvider } from "./context/PackagesActivityContext";
import { Terminal, Sparkles } from "lucide-react";
import { AiAssistantPanel } from "./components/AiAssistantPanel";
import {
  AiAssistantProvider,
  useAiAssistant,
} from "./context/AiAssistantContext";

type Network = "mainnet" | "testnet";

interface MemoryEntry {
  id: string; // local uuid for React keys / storage
  label: string; // user-editable name
  accountId: string;
  delegateKey: string;
  network: Network;
  namespace: string;
  createdAt: number;
}

const isMac = window.electronAPI?.platform === "darwin";

function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    window.electronAPI?.windowIsMaximized().then(setIsMaximized);
  }, []);

  const btnCls =
    "h-9 w-11 flex items-center justify-center border-none bg-transparent cursor-pointer transition-colors text-neutral-500 hover:text-neutral-200";

  return (
    <div className="flex items-center h-full">
      <button
        onClick={() => window.electronAPI?.windowMinimize()}
        className={`${btnCls} hover:bg-white/10`}
        title="Minimize"
      >
        <svg width="11" height="1" viewBox="0 0 11 1" fill="currentColor">
          <rect width="11" height="1" />
        </svg>
      </button>
      <button
        onClick={async () => {
          await window.electronAPI?.windowMaximize();
          const m = await window.electronAPI?.windowIsMaximized();
          setIsMaximized(m);
        }}
        className={`${btnCls} hover:bg-white/10`}
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
        onClick={() => window.electronAPI?.windowClose()}
        className={`${btnCls} hover:bg-red-500 hover:text-white`}
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

function MainContent({
  entries,
  setEntries,
}: {
  entries: MemoryEntry[];
  setEntries: React.Dispatch<React.SetStateAction<MemoryEntry[]>>;
}) {
  const { pathname } = useLocation();

  return (
    <div className="flex-1 min-w-0 min-h-0 overflow-y-auto">
      <div className={pathname === "/" ? "h-full" : "hidden"}>
        <WalrusMemoryApp entries={entries} setEntries={setEntries} />
      </div>
      <div className={pathname === "/projects" ? "h-full" : "hidden"}>
        <ProjectManager />
      </div>
      <div className={pathname === "/skills" ? "h-full min-h-0 overflow-hidden" : "hidden"}>
        <SkillsPage />
      </div>
      <div className={pathname === "/playground" ? "h-full" : "hidden"}>
        <PlaygroundPage />
      </div>
      <div className={pathname === "/packages" ? "h-full" : "hidden"}>
        <PackagesPage />
      </div>
      <div className={pathname === "/tools" ? "h-full" : "hidden"}>
        <ToolsPage />
      </div>
      <div className={pathname === "/charts" ? "h-full" : "hidden"}>
        <TradingChartsPage />
      </div>
      <div className={pathname === "/strategy" ? "h-full" : "hidden"}>
        <TradingStrategyPage />
      </div>
      <div className={pathname === "/feeds" ? "h-full" : "hidden"}>
        <TradingFeedsPage />
      </div>
      {pathname === "/settings" && <SettingsPage />}
      {pathname === "/docs" && <DocsPage />}
      {pathname === "/learning" && <LearningPage />}
      {pathname === "/connect" && <WalletConnectPage />}
    </div>
  );
}

function AppShell({
  entries,
  setEntries,
}: {
  entries: MemoryEntry[];
  setEntries: React.Dispatch<React.SetStateAction<MemoryEntry[]>>;
}) {
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const {
    aiReady,
    isOpen: aiOpen,
    toggleAssistant,
    closeAssistant,
    pendingMessage,
    clearPendingMessage,
  } = useAiAssistant();

  if (pathname === "/console") {
    return <ConsolePage />;
  }

  return (
    <PackagesActivityProvider>
      <div className="flex flex-col h-screen bg-[#0a0a0f] overflow-hidden select-none">
        <div
          className={`flex-shrink-0 flex items-center bg-[#0a0a0f] border-b border-white/[0.05] ${
            isMac ? "h-10" : "h-9"
          }`}
        >
          {isMac && (
            <div
              className="w-[78px] flex-shrink-0 h-full"
              style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
            />
          )}

          <div
            className="flex items-center gap-0.5 flex-shrink-0 h-full px-1"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            <button
              onClick={() => setCollapsed((v) => !v)}
              className="w-9 h-9 flex items-center justify-center text-neutral-400 hover:text-neutral-200 hover:bg-white/5 transition-colors bg-transparent border-none cursor-pointer"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <rect x="1" y="3" width="13" height="1.5" rx="0.75" fill="currentColor" />
                <rect x="1" y="7" width="13" height="1.5" rx="0.75" fill="currentColor" />
                <rect x="1" y="11" width="13" height="1.5" rx="0.75" fill="currentColor" />
              </svg>
            </button>

            <button
              onClick={() => void window.belugaConsole?.open?.()}
              className="w-9 h-9 flex items-center justify-center rounded-lg border-none cursor-pointer transition-colors text-neutral-400 hover:text-[#4ca3ff] hover:bg-[#4ca3ff]/10 bg-transparent"
              title="Open console"
            >
              <Terminal size={15} />
            </button>

            <button
              onClick={() => toggleAssistant()}
              className={`w-9 h-9 flex items-center justify-center transition-colors bg-transparent border-none cursor-pointer ${
                aiOpen
                  ? "text-[#6c63ff] bg-[#6c63ff]/10"
                  : aiReady
                    ? "text-neutral-400 hover:text-neutral-200 hover:bg-white/5"
                    : "text-neutral-600 hover:text-neutral-400 hover:bg-white/5"
              }`}
              title={
                aiReady
                  ? aiOpen
                    ? "Close AI assistant"
                    : "Open AI assistant"
                  : "AI assistant (enable in Settings)"
              }
            >
              <Sparkles size={15} />
            </button>
          </div>

          <div
            className="flex-1 h-full"
            style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
          />

          {!isMac && (
            <div
              className="flex items-center h-full flex-shrink-0"
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            >
              <WindowControls />
            </div>
          )}
        </div>

        <div className="flex flex-1 min-h-0">
          <Sidebar
            collapsed={collapsed}
            onToggle={() => setCollapsed((v) => !v)}
          />
          <MainContent entries={entries} setEntries={setEntries} />
        </div>

        <AiAssistantPanel
          open={aiOpen}
          onClose={closeAssistant}
          pendingMessage={pendingMessage}
          onPendingConsumed={clearPendingMessage}
        />
      </div>
    </PackagesActivityProvider>
  );
}

function App() {
  const [entries, setEntries] = useState<MemoryEntry[]>(() => {
    try {
      const raw = localStorage.getItem("memwal-entries-v1");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useMcpHandler({
    entries,
    walletAddress: null,
    accountState: { accountId: null, delegateKey: null },
    memwalClient: null,
    network: "mainnet",
    health: null,
  });

  return (
    <Providers>
      <WalletProvider>
        <HashRouter>
          <AiAssistantProvider>
            <AppShell entries={entries} setEntries={setEntries} />
          </AiAssistantProvider>
        </HashRouter>
      </WalletProvider>
    </Providers>
  );
}

export default App;