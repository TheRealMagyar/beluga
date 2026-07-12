import { useCallback, useState, type ReactNode } from "react";
import {
  Hammer,
  Droplets,
  Server,
  Play,
  Package,
  X,
  Rocket,
  FolderOpen,
  Trash2,
  Loader2,
  AlertCircle,
  Globe,
  Wallet,
} from "lucide-react";
import { ResizeHandle } from "../../components/ResizeHandle";
import type {
  ConsoleLog,
  PlaygroundBuildResult,
  PlaygroundCliStatus,
  PlaygroundDeployment,
  PlaygroundNetwork,
} from "./types";
import type { MoveEntryFunction } from "./project-loader";
import { EntryTestCard } from "./EntryTestCard";
import type { EntryArgsState } from "./entry-test-ui";
import { NETWORK_CONFIG } from "./constants";
import { SuiClientPanel } from "./SuiClientPanel";
import {
  BuildArtifactsPanel,
  DeploymentArtifactsPanel,
} from "./PackageArtifactsPanel";
import { PlaygroundWalletSwitcher } from "./PlaygroundWalletSwitcher";
import { getPackageNameFromFiles, listBuiltModuleNames } from "./package-artifacts";
import type { PlaygroundFile } from "./types";

const DOCK_WIDTH_KEY = "beluga-playground-dock-width-v1";
const DEFAULT_DOCK_WIDTH = 380;
const MIN_DOCK_WIDTH = 280;
const MAX_DOCK_WIDTH = 560;

export type DockPanel =
  | "deploy"
  | "faucet"
  | "client"
  | "explorer"
  | "test"
  | "deployment"
  | "accounts"
  | null;

const DOCK_ITEMS: Array<{
  id: Exclude<DockPanel, null | "accounts">;
  icon: typeof Hammer;
  label: string;
  accent: string;
}> = [
  { id: "deploy", icon: Hammer, label: "Build", accent: "#6c63ff" },
  { id: "faucet", icon: Droplets, label: "Faucet", accent: "#4ca3ff" },
  { id: "client", icon: Server, label: "CLI", accent: "#00d4aa" },
  { id: "explorer", icon: Globe, label: "Explorer", accent: "#7dd3fc" },
  { id: "test", icon: Play, label: "Test", accent: "#ffb347" },
  { id: "deployment", icon: Package, label: "Last Deployment", accent: "#c4c0ff" },
];

function shortenAddress(address: string) {
  if (address.length <= 14) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function loadDockWidth(): number {
  try {
    const raw = localStorage.getItem(DOCK_WIDTH_KEY);
    const parsed = raw ? Number(raw) : DEFAULT_DOCK_WIDTH;
    if (!Number.isFinite(parsed)) return DEFAULT_DOCK_WIDTH;
    return Math.min(MAX_DOCK_WIDTH, Math.max(MIN_DOCK_WIDTH, parsed));
  } catch {
    return DEFAULT_DOCK_WIDTH;
  }
}

function PanelShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col h-full min-h-0 playground-panel-in">
      <div className="flex items-start gap-2 px-4 py-3 border-b border-white/[0.06] flex-shrink-0 bg-[#101018]/80">
        <div className="flex-1 min-w-0">
          <h3 className="text-[13px] font-semibold text-[#f0f0f5]">{title}</h3>
          {subtitle && (
            <p className="text-[11px] text-[#8888a0] mt-0.5 leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#2a2a3c] text-[#8888a0] hover:text-[#f0f0f5] hover:bg-white/[0.04] cursor-pointer bg-transparent transition-colors"
        >
          <X size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 min-h-0">{children}</div>
    </div>
  );
}

export function PlaygroundDock({
  network,
  walletAddress,
  suiBalance,
  cliStatus,
  buildResult,
  deployment,
  entryArgs,
  createdObjectIds,
  onEntryArgsChange,
  building,
  publishing,
  calling,
  faucetLoading,
  localNetRunning,
  onBuild,
  onPublish,
  onOpenWorkspace,
  onRequestFaucet,
  moveEntries,
  moveModule,
  loadedProjectName,
  files,
  onCallEntry,
  onClearDeployment,
  onOpenExplorer,
  onPlaygroundSignerChange,
  onLog,
}: {
  network: PlaygroundNetwork;
  walletAddress: string | null;
  suiBalance: number | null;
  cliStatus: PlaygroundCliStatus | null;
  buildResult: PlaygroundBuildResult | null;
  deployment: PlaygroundDeployment | null;
  entryArgs: EntryArgsState;
  createdObjectIds: string[];
  onEntryArgsChange: (values: EntryArgsState) => void;
  building: boolean;
  publishing: boolean;
  calling: boolean;
  faucetLoading: boolean;
  localNetRunning: boolean;
  onBuild: () => void;
  onPublish: () => void;
  onOpenWorkspace: () => void;
  onRequestFaucet: () => void;
  moveEntries: MoveEntryFunction[];
  moveModule: string;
  loadedProjectName: string | null;
  files: PlaygroundFile[];
  onCallEntry: (entry: MoveEntryFunction) => void;
  onClearDeployment: () => void;
  onOpenExplorer: () => void;
  onPlaygroundSignerChange: (address: string | null) => void;
  onLog: (level: ConsoleLog["level"], message: string) => void;
}) {
  const [panel, setPanel] = useState<DockPanel>(null);
  const [panelWidth, setPanelWidth] = useState(loadDockWidth);

  const toggle = (id: Exclude<DockPanel, null>) => {
    setPanel((prev) => (prev === id ? null : id));
  };

  const handleResize = useCallback((delta: number) => {
    setPanelWidth((prev) => {
      const next = Math.min(
        MAX_DOCK_WIDTH,
        Math.max(MIN_DOCK_WIDTH, prev + delta),
      );
      localStorage.setItem(DOCK_WIDTH_KEY, String(next));
      return next;
    });
  }, []);

  const panelMeta = (() => {
    switch (panel) {
      case "deploy":
        return {
          title: "Build & Publish",
          subtitle: "Compile Move and publish to chain.",
        };
      case "faucet":
        return {
          title: "Network Faucet",
          subtitle: `Request SUI on ${NETWORK_CONFIG[network].label}.`,
        };
      case "client":
        return {
          title: "Sui Client",
          subtitle: "Sui CLI and Move localnet only.",
        };
      case "test":
        return {
          title: "Test Functions",
          subtitle: moveEntries.length
            ? `${moveEntries.length} entry function(s) from Move source`
            : "No entry functions found in source",
        };
      case "deployment":
        return {
          title: "Last Deployment",
          subtitle: deployment
            ? `Published on ${deployment.network}`
            : undefined,
        };
      case "accounts":
        return {
          title: "Localnet Accounts",
          subtitle: walletAddress
            ? `Active: ${shortenAddress(walletAddress)} · Beluga + 10 test wallets`
            : "Beluga wallet + 10 funded test wallets",
        };
      default:
        return null;
    }
  })();

  return (
    <div className="flex flex-shrink-0 h-full min-h-0">
      {panel && panelMeta && (
        <>
          <ResizeHandle direction="horizontal" onResize={handleResize} />
          <div
            className="flex flex-col min-h-0 border-l border-white/[0.06] bg-[#0d0d16]"
            style={{ width: panelWidth }}
          >
            <PanelShell
              title={panelMeta.title}
              subtitle={panelMeta.subtitle}
              onClose={() => setPanel(null)}
            >
              {panel === "deploy" && (
                <div className="space-y-3">
                  {loadedProjectName && (
                    <div className="rounded-xl border border-[#ffb347]/20 bg-[#ffb347]/5 px-3 py-2 text-[11px] text-[#ffb347]">
                      Testing project:{" "}
                      <span className="font-semibold">{loadedProjectName}</span>
                    </div>
                  )}
                  {!cliStatus?.installed && (
                    <div className="rounded-xl border border-[#ffb347]/20 bg-[#ffb347]/5 p-3">
                      <div className="flex items-center gap-2 text-[#ffb347] text-[12px] font-medium mb-1">
                        <AlertCircle size={14} />
                        Sui CLI required
                      </div>
                      <p className="text-[11px] text-[#8888a0] leading-relaxed">
                        Install from Packages → Toolchain tab.
                      </p>
                    </div>
                  )}
                  <button
                    onClick={onBuild}
                    disabled={building || !cliStatus?.installed}
                    className="w-full flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-medium border border-[#2a2a3c] bg-[#1a1a26] text-[#f0f0f5] hover:bg-[#222232] disabled:opacity-50 cursor-pointer transition-colors"
                  >
                    {building ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Hammer size={15} />
                    )}
                    {building ? "Building..." : "Build package"}
                  </button>
                  <button
                    onClick={onPublish}
                    disabled={publishing || !buildResult || !walletAddress}
                    className="w-full flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-medium border border-[#6c63ff]/40 bg-[#6c63ff]/15 text-[#c4c0ff] hover:bg-[#6c63ff]/25 disabled:opacity-50 cursor-pointer transition-colors"
                  >
                    {publishing ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Rocket size={15} />
                    )}
                    {publishing ? "Publishing..." : "Publish"}
                  </button>
                  <button
                    onClick={onOpenWorkspace}
                    className="w-full flex items-center justify-center gap-2 h-9 rounded-xl text-[12px] border border-[#2a2a3c] bg-transparent text-[#8888a0] hover:text-[#f0f0f5] cursor-pointer transition-colors"
                  >
                    <FolderOpen size={14} />
                    Open workspace
                  </button>
                  {buildResult && (
                    <BuildArtifactsPanel
                      buildResult={buildResult}
                      packageName={getPackageNameFromFiles(files)}
                      moduleNames={listBuiltModuleNames(files)}
                    />
                  )}
                </div>
              )}

              {panel === "faucet" && (
                <div className="space-y-3">
                  {network === "mainnet" ? (
                    <p className="text-[12px] text-[#8888a0] leading-relaxed">
                      Faucet is unavailable on Mainnet. Switch to Testnet,
                      Devnet, or Localnet.
                    </p>
                  ) : (
                    <>
                      <p className="text-[12px] text-[#8888a0] leading-relaxed">
                        {network === "localnet"
                          ? "Request SUI from the local faucet for gas on your running localnet."
                          : `Request free SUI from the official ${NETWORK_CONFIG[network].label} faucet for gas fees.`}
                      </p>
                      {walletAddress && suiBalance != null && (
                        <div className="rounded-xl border border-[#2a2a3c] bg-[#1a1a26] px-3 py-2 text-[12px] font-mono text-[#a8b0c8]">
                          Balance: {suiBalance.toFixed(4)} SUI
                        </div>
                      )}
                      <button
                        onClick={onRequestFaucet}
                        disabled={faucetLoading || !walletAddress}
                        className="w-full flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-medium border border-[#4ca3ff]/30 bg-[#4ca3ff]/10 text-[#4ca3ff] cursor-pointer disabled:opacity-50 transition-colors"
                      >
                        {faucetLoading ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : (
                          <Droplets size={15} />
                        )}
                        {faucetLoading
                          ? "Requesting..."
                          : `Request SUI (${NETWORK_CONFIG[network].label})`}
                      </button>
                      {!walletAddress && (
                        <p className="text-[11px] text-[#ffb347]">
                          Connect your wallet first.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              {panel === "client" && (
                <SuiClientPanel
                  mode="move"
                  walletAddress={walletAddress}
                  onLog={onLog}
                />
              )}

              {panel === "test" && (
                <div className="space-y-3">
                  <p className="text-[12px] text-[#8888a0] leading-relaxed">
                    {loadedProjectName
                      ? `Arguments are parsed from Move source in "${loadedProjectName}".`
                      : "Arguments are parsed from the loaded Move source."}
                  </p>
                  {!deployment && (
                    <p className="text-[11px] text-[#ffb347]">
                      Publish the package before running entry functions.
                    </p>
                  )}
                  {moveEntries.length === 0 ? (
                    <p className="text-[11px] text-[#8888a0]">
                      No entry functions detected. Load a Move project or use
                      the default template.
                    </p>
                  ) : (
                    moveEntries.map((entry) => (
                      <EntryTestCard
                        key={`${entry.module}::${entry.name}`}
                        entry={entry}
                        entryArgs={entryArgs}
                        createdObjectIds={createdObjectIds}
                        calling={calling}
                        disabled={!deployment}
                        onEntryArgsChange={onEntryArgsChange}
                        onCall={onCallEntry}
                      />
                    ))
                  )}
                </div>
              )}

              {panel === "deployment" && (
                <div className="space-y-3">
                  {!deployment ? (
                    <p className="text-[12px] text-[#8888a0]">
                      No package published yet. Build and publish first.
                    </p>
                  ) : (
                    <>
                      <DeploymentArtifactsPanel deployment={deployment} />
                      <button
                        onClick={onClearDeployment}
                        className="w-full h-9 rounded-xl text-[12px] border border-[#ff4d6d]/25 bg-[#ff4d6d]/10 text-[#ff4d6d] cursor-pointer flex items-center justify-center gap-2 transition-colors hover:bg-[#ff4d6d]/16"
                      >
                        <Trash2 size={13} />
                        Clear deployment
                      </button>
                    </>
                  )}
                </div>
              )}

              {panel === "accounts" && (
                <div className="space-y-3">
                  {localNetRunning ? (
                    <PlaygroundWalletSwitcher
                      onSignerChange={onPlaygroundSignerChange}
                      onLog={onLog}
                    />
                  ) : (
                    <p className="text-[12px] text-[#8888a0] leading-relaxed rounded-xl border border-[#2a2a3c] bg-[#1a1a26] px-3 py-2.5">
                      Start the local chain from the CLI panel first. Then pick
                      Beluga or any of the 10 auto-funded test wallets here.
                    </p>
                  )}
                </div>
              )}
            </PanelShell>
          </div>
        </>
      )}

      <div className="w-[52px] flex-shrink-0 border-l border-white/[0.06] bg-[#101018] flex flex-col items-center h-full min-h-0 py-3">
        <div className="flex flex-col items-center gap-1.5">
          {DOCK_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = panel === item.id;
            const hasBadge =
              (item.id === "deployment" && deployment) ||
              (item.id === "deploy" && buildResult) ||
              (item.id === "explorer" && localNetRunning);

            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === "explorer") {
                    if (!localNetRunning) {
                      onLog("warn", "Start local network first to open Explorer.");
                      return;
                    }
                    onOpenExplorer();
                    return;
                  }
                  toggle(item.id);
                }}
                title={
                  item.id === "explorer" && !localNetRunning
                    ? "Start local network to use Explorer"
                    : item.label
                }
                disabled={item.id === "explorer" && !localNetRunning}
                className={`relative w-9 h-9 rounded-xl border flex items-center justify-center transition-all duration-200 ${
                  item.id === "explorer" && !localNetRunning
                    ? "opacity-35 cursor-not-allowed border-transparent"
                    : "cursor-pointer"
                } ${
                  active
                    ? "border-white/20 bg-white/[0.08] shadow-[0_0_14px_rgba(76,163,255,0.18)] scale-[1.02]"
                    : "border-transparent bg-transparent hover:bg-white/[0.05] hover:border-[#2a2a3c]"
                }`}
                style={active ? { color: item.accent } : { color: "#8888a0" }}
              >
                <Icon size={17} />
                {hasBadge && (
                  <span
                    className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full ring-2 ring-[#101018]"
                    style={{ background: item.accent }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex-1 min-h-3" />

        <button
          type="button"
          onClick={() => {
            if (!localNetRunning) {
              onLog("warn", "Start local network first to manage accounts.");
              return;
            }
            toggle("accounts");
          }}
          title={
            localNetRunning
              ? "Localnet accounts"
              : "Start local chain to manage accounts"
          }
          disabled={!localNetRunning}
          className={`relative w-9 h-9 rounded-xl border flex items-center justify-center transition-all duration-200 flex-shrink-0 ${
            !localNetRunning
              ? "opacity-35 cursor-not-allowed border-transparent"
              : "cursor-pointer"
          } ${
            panel === "accounts"
              ? "border-[#c4c0ff]/40 bg-[#6c63ff]/20 shadow-[0_0_12px_rgba(196,192,255,0.22)] scale-[1.02]"
              : localNetRunning
                ? "border-[#c4c0ff]/25 bg-[#6c63ff]/10 hover:bg-[#6c63ff]/18 hover:border-[#c4c0ff]/35"
                : "border-transparent bg-transparent"
          }`}
          style={{ color: localNetRunning ? "#c4c0ff" : "#8888a0" }}
        >
          <Wallet size={17} />
          {localNetRunning && (
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full ring-2 ring-[#101018] bg-[#c4c0ff]" />
          )}
        </button>
      </div>
    </div>
  );
}