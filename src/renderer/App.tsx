import React, { useState, useEffect } from "react";
import { Routes, Route, HashRouter } from "react-router-dom";
import { WalrusMemoryApp } from "./pages/MemoryManager";
import { WalletConnectPage } from "../helper/Walletconnectpage";
import { SettingsPage } from "./pages/SettingsPage";
import { DocsPage } from "./pages/DocumentsPage";
import { Sidebar } from "./components/Sidebar";
import "@mysten/dapp-kit/dist/index.css";
import { Providers } from "./components/Providers";
import ProjectManager from "./pages/ProjectManager";
import { WalletProvider } from "./components/Walletcontext";
import { useMcpHandler } from "./hooks/useMcpHandler";

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

function App() {
  const [collapsed, setCollapsed] = useState(false);
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
          <div className="flex flex-col h-screen bg-[#0a0a0f] overflow-hidden select-none">
            {/* Titlebar */}
            <div
              className="flex-shrink-0 h-9 flex items-center bg-[#0a0a0f] border-b border-white/[0.05]"
              style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
            >
              {isMac && <div className="w-20 flex-shrink-0" />}

              <button
                onClick={() => setCollapsed((v) => !v)}
                className="w-9 h-9 flex items-center justify-center text-neutral-600 hover:text-neutral-300 hover:bg-white/5 transition-colors bg-transparent border-none cursor-pointer flex-shrink-0"
                style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <rect
                    x="1"
                    y="3"
                    width="13"
                    height="1.5"
                    rx="0.75"
                    fill="currentColor"
                  />
                  <rect
                    x="1"
                    y="7"
                    width="13"
                    height="1.5"
                    rx="0.75"
                    fill="currentColor"
                  />
                  <rect
                    x="1"
                    y="11"
                    width="13"
                    height="1.5"
                    rx="0.75"
                    fill="currentColor"
                  />
                </svg>
              </button>

              <div className="flex-1" />

              {!isMac && (
                <div
                  className="flex items-center h-full flex-shrink-0"
                  style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
                >
                  <WindowControls />
                </div>
              )}
            </div>

            {/* Body */}
            <div className="flex flex-1 min-h-0">
              <Sidebar
                collapsed={collapsed}
                onToggle={() => setCollapsed((v) => !v)}
              />
              <div className="flex-1 min-w-0 overflow-y-auto">
                <Routes>
                  <Route
                    path="/"
                    element={
                      <WalrusMemoryApp
                        entries={entries}
                        setEntries={setEntries}
                      />
                    }
                  />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/docs" element={<DocsPage />} />
                  <Route path="/connect" element={<WalletConnectPage />} />
                  <Route path="/projects" element={<ProjectManager />} />
                </Routes>
              </div>
            </div>
          </div>
        </HashRouter>
      </WalletProvider>
    </Providers>
  );
}

export default App;