import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { RefreshCw, Trash2 } from "lucide-react";
import { useWallet } from "../components/Walletcontext";
import { NetworkSwitcher } from "../components/NetworkSwitcher";
import { DEFAULT_PLAYGROUND_FILES } from "../../helper/playground-defaults";
import type {
  ConsoleLog,
  PlaygroundBuildResult,
  PlaygroundCliStatus,
  PlaygroundDeployment,
  PlaygroundFile,
} from "./playgroundComponents/types";
import { NETWORK_CONFIG } from "./playgroundComponents/constants";
import {
  clearDeployment,
  createSuiClient,
  resolvePackageIdFromPublish,
  getSuiBalance,
  loadDeployment,
  publishPackage,
  saveDeployment,
  signAndExecuteTransaction,
  uid,
  type PlaygroundSignerId,
} from "./playgroundComponents/utils";
import { Transaction } from "@mysten/sui/transactions";
import { PlaygroundDock } from "./playgroundComponents/PlaygroundDock";
import { PlaygroundConsole } from "./playgroundComponents/PlaygroundConsole";
import { ConsoleErrorBoundary } from "../components/ConsoleErrorBoundary";
import { LocalExplorer } from "./playgroundComponents/LocalExplorer";
import { IkaPlayground } from "./playgroundComponents/IkaPlayground";
import { DefiPlayground } from "./playgroundComponents/DefiPlayground";
import { PtbPlayground } from "./playgroundComponents/PtbPlayground";
import {
  PlaygroundTabs,
  type PlaygroundTab,
} from "./playgroundComponents/PlaygroundTabs";
import {
  listTestableProjects,
  loadProjectIntoPlayground,
  parseMoveEntryFunctions,
  parsePackageName,
  type MoveEntryFunction,
  type TestableProject,
} from "./playgroundComponents/project-loader";
import { buildEntryArgs } from "./playgroundComponents/entry-args";
import {
  entryKey,
  fillObjectParams,
  mergeEntryArgs,
  syncCoinAmounts,
  validateEntryArgs,
  type EntryArgsState,
} from "./playgroundComponents/entry-test-ui";

const FILES_STORAGE_KEY = "beluga-playground-files-v1";
const LOADED_PROJECT_KEY = "beluga-playground-loaded-project-v1";
const PLAYGROUND_TAB_KEY = "beluga-playground-active-tab-v1";

function loadFiles(): PlaygroundFile[] {
  try {
    const raw = localStorage.getItem(FILES_STORAGE_KEY);
    if (!raw) return DEFAULT_PLAYGROUND_FILES;
    const parsed = JSON.parse(raw) as PlaygroundFile[];
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_PLAYGROUND_FILES;
  } catch {
    return DEFAULT_PLAYGROUND_FILES;
  }
}

function persistFiles(files: PlaygroundFile[]) {
  localStorage.setItem(FILES_STORAGE_KEY, JSON.stringify(files));
}

export function PlaygroundPage() {
  const {
    walletInfo,
    refresh: refreshWallet,
    network,
    setNetwork,
    localNetRunning,
  } = useWallet();
  const prevLocalNetRunning = useRef(localNetRunning);
  const [files, setFiles] = useState<PlaygroundFile[]>(loadFiles);
  const [activeFileId, setActiveFileId] = useState(files[0]?.id ?? "move-toml");
  const [cliStatus, setCliStatus] = useState<PlaygroundCliStatus | null>(null);
  const walletAddress = walletInfo?.address ?? null;
  const [activeSignerId, setActiveSignerId] =
    useState<PlaygroundSignerId>("beluga");
  const [playgroundAddress, setPlaygroundAddress] = useState<string | null>(
    walletInfo?.address ?? null,
  );
  const [suiBalance, setSuiBalance] = useState<number | null>(null);
  const [faucetLoading, setFaucetLoading] = useState(false);
  const [deployment, setDeployment] = useState<PlaygroundDeployment | null>(
    loadDeployment,
  );
  const [buildResult, setBuildResult] = useState<PlaygroundBuildResult | null>(
    null,
  );
  const [entryArgs, setEntryArgs] = useState<EntryArgsState>({});
  const [createdObjectIds, setCreatedObjectIds] = useState<string[]>([]);
  const [logs, setLogs] = useState<ConsoleLog[]>([]);
  const [building, setBuilding] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [calling, setCalling] = useState(false);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [testableProjects, setTestableProjects] = useState<TestableProject[]>(
    [],
  );
  const [loadedProject, setLoadedProject] = useState<TestableProject | null>(
    null,
  );
  const [moveEntries, setMoveEntries] = useState<MoveEntryFunction[]>([]);
  const [moveModule, setMoveModule] = useState("counter");
  const [ikaToolchainReady, setIkaToolchainReady] = useState(false);
  const [activeTab, setActiveTab] = useState<PlaygroundTab>(() => {
    const saved = localStorage.getItem(PLAYGROUND_TAB_KEY);
    if (saved === "ika" || saved === "defi" || saved === "ptb") return saved;
    return "move";
  });

  const activeFile = useMemo(
    () => files.find((f) => f.id === activeFileId) ?? files[0],
    [files, activeFileId],
  );

  const addLog = useCallback(
    (level: ConsoleLog["level"], message: string) => {
      const entry = { id: uid(), level, message, timestamp: Date.now() };
      setLogs((prev) => [...prev, entry]);
      void window.belugaConsole.appendPlaygroundLog(entry);
    },
    [],
  );

  const handleConsoleCommand = useCallback(
    async (command: string) => {
      if (command === "__help__") {
        addLog(
          "info",
          [
            "Playground shell (workspace cwd):",
            "  sui client gas",
            "  sui client objects <address>",
            "  sui move build --dump-bytecode-as-base64",
            "  clear — clear console",
            "  help — this message",
          ].join("\n"),
        );
        return;
      }

      addLog("info", `$ ${command}`);

      try {
        if (!window.playground?.runShellCommand) {
          addLog(
            "error",
            "Console commands are unavailable. Restart Beluga to load the latest build.",
          );
          return;
        }
        if (/^\s*sui\s+move\b/i.test(command) && window.playground.syncWorkspace) {
          await window.playground.syncWorkspace(
            files.map((f) => ({ path: f.path, content: f.content })),
          );
        }
        const result = await window.playground.runShellCommand(command);
        if (result.stdout.trim()) {
          for (const line of result.stdout.trim().split("\n")) {
            addLog("info", line);
          }
        }
        if (result.stderr.trim()) {
          for (const line of result.stderr.trim().split("\n")) {
            addLog(result.exitCode === 0 ? "info" : "error", line);
          }
        }
        if (
          result.exitCode !== 0 &&
          !result.stdout.trim() &&
          !result.stderr.trim()
        ) {
          addLog("error", `Command failed with exit code ${result.exitCode}.`);
        } else if (result.exitCode === 0 && !result.stdout.trim() && !result.stderr.trim()) {
          addLog("success", "Command completed.");
        }
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Command failed.";
        addLog("error", message);
      }
    },
    [addLog, files],
  );

  const refreshCliStatus = useCallback(async () => {
    try {
      const status = await window.playground.checkCli();
      setCliStatus(status);
      if (status.installed) {
        addLog("success", `Sui CLI detected: ${status.version}`);
      } else {
        addLog(
          "warn",
          "Sui CLI not found. Install from Packages → Toolchain.",
        );
      }
    } catch (e: any) {
      addLog("error", e.message || "Failed to check Sui CLI.");
    }
  }, [addLog]);

  const effectiveAddress = localNetRunning
    ? (playgroundAddress ?? walletAddress)
    : walletAddress;

  const handlePlaygroundSignerChange = useCallback(
    (address: string | null) => {
      setPlaygroundAddress(address ?? walletAddress);
      void window.playground.getActiveSigner().then((active) => {
        setActiveSignerId(active.activeSignerId);
      });
    },
    [walletAddress],
  );

  const refreshBalance = useCallback(async () => {
    if (!effectiveAddress) {
      setSuiBalance(null);
      return;
    }
    try {
      const balance = await getSuiBalance(effectiveAddress, network);
      setSuiBalance(balance);
    } catch {
      setSuiBalance(null);
    }
  }, [effectiveAddress, network]);

  const syncActiveSigner = useCallback(async () => {
    if (!localNetRunning) {
      setActiveSignerId("beluga");
      setPlaygroundAddress(walletAddress);
      return;
    }
    try {
      const active = await window.playground.getActiveSigner();
      setActiveSignerId(active.activeSignerId);
      setPlaygroundAddress(active.address ?? walletAddress);
    } catch {
      setActiveSignerId("beluga");
      setPlaygroundAddress(walletAddress);
    }
  }, [localNetRunning, walletAddress]);

  const handleLoadProject = useCallback(
    async (project: TestableProject, log = true) => {
      try {
        const loaded = await loadProjectIntoPlayground(project.path);
        setFiles(loaded.files);
        setActiveFileId(loaded.files[0]?.id ?? "move-toml");
        setMoveEntries(loaded.entries);
        setEntryArgs((prev) => mergeEntryArgs(prev, loaded.entries));
        setLoadedProject(project);
        setBuildResult(null);
        setDeployment(null);
        clearDeployment();
        localStorage.setItem(LOADED_PROJECT_KEY, project.path);
        if (log) {
          addLog(
            "success",
            `Loaded Move project "${project.name}" (${loaded.files.length} file(s)).`,
          );
        }
      } catch (e: any) {
        addLog("error", e.message || "Failed to load project.");
      }
    },
    [addLog],
  );

  const loadDefaultTemplate = useCallback(() => {
    setFiles(DEFAULT_PLAYGROUND_FILES);
    setActiveFileId("move-toml");
    setBuildResult(null);
    setLoadedProject(null);
    setMoveModule("counter");
    localStorage.removeItem(LOADED_PROJECT_KEY);
  }, []);

  useEffect(() => {
    refreshCliStatus();
    addLog("info", "Playground ready. Use the dock on the right for tools.");
    listTestableProjects()
      .then(setTestableProjects)
      .catch(() => setTestableProjects([]));

    const pollIkaToolchain = () => {
      window.packages
        .getToolchainStatus()
        .then((status) => setIkaToolchainReady(status.ika.ready))
        .catch(() => setIkaToolchainReady(false));
    };
    pollIkaToolchain();
    const timer = window.setInterval(pollIkaToolchain, 3000);
    return () => window.clearInterval(timer);
  }, [refreshCliStatus, addLog]);

  useEffect(() => {
    if (!ikaToolchainReady && activeTab === "ika") {
      setActiveTab("move");
    }
  }, [ikaToolchainReady, activeTab]);

  useEffect(() => {
    localStorage.setItem(PLAYGROUND_TAB_KEY, activeTab);
  }, [activeTab]);

  useEffect(() => {
    const savedPath = localStorage.getItem(LOADED_PROJECT_KEY);
    if (!savedPath) return;
    const project = testableProjects.find((p) => p.path === savedPath);
    if (project) {
      handleLoadProject(project, false);
    }
  }, [testableProjects, handleLoadProject]);

  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  useEffect(() => {
    void syncActiveSigner();
  }, [syncActiveSigner]);

  useEffect(() => {
    if (localNetRunning) return;
    setPlaygroundAddress(walletAddress);
    setActiveSignerId("beluga");
  }, [localNetRunning, walletAddress]);

  useEffect(() => {
    if (localNetRunning && !prevLocalNetRunning.current && network !== "localnet") {
      setNetwork("localnet");
      addLog("info", "Switched to Localnet — local chain is running.");
    }
    prevLocalNetRunning.current = localNetRunning;
  }, [localNetRunning, network, setNetwork, addLog]);

  useEffect(() => {
    const moveToml =
      files.find((f) => f.path === "Move.toml")?.content ?? "";
    const packageName = parsePackageName(moveToml) ?? "counter";
    const moveSources = files
      .filter((f) => f.path.endsWith(".move"))
      .map((f) => f.content);
    const entries = parseMoveEntryFunctions(moveSources, packageName);
    setMoveEntries(entries);
    setMoveModule(packageName);
    setEntryArgs((prev) => mergeEntryArgs(prev, entries));
  }, [files]);

  useEffect(() => {
    persistFiles(files);
  }, [files]);

  useEffect(() => {
    if (!deployment?.packageId || deployment.entryTargets !== undefined) return;

    let cancelled = false;
    void (async () => {
      try {
        const {
          enrichDeploymentArtifacts,
          getPackageNameFromFiles,
          listBuiltModuleNames,
        } = await import("./playgroundComponents/package-artifacts");
        const client = createSuiClient(deployment.network);
        const artifacts = await enrichDeploymentArtifacts({
          client,
          packageId: deployment.packageId,
          packageName:
            deployment.packageName ?? getPackageNameFromFiles(files),
          moveEntries,
          builtModuleNames: listBuiltModuleNames(files),
        });
        if (cancelled) return;
        const next = { ...deployment, ...artifacts };
        setDeployment(next);
        saveDeployment(next);
      } catch {
        // keep minimal deployment info
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [deployment, files, moveEntries]);

  const updateActiveContent = (content: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === activeFileId ? { ...f, content } : f)),
    );
    setBuildResult(null);
  };

  const resetToTemplate = () => {
    if (!window.confirm("Reset to the default Playground counter template?")) {
      return;
    }
    loadDefaultTemplate();
    addLog("info", "Reset to default counter template.");
  };

  const handleBuild = async () => {
    setBuilding(true);
    addLog("info", "Building Move package...");
    try {
      const result = await window.playground.build(
        files.map((f) => ({ path: f.path, content: f.content })),
      );
      setBuildResult(result);
      addLog(
        "success",
        `Build succeeded — ${result.modules.length} module(s), ${result.dependencies.length} dependenc${result.dependencies.length === 1 ? "y" : "ies"}.`,
      );
      if (result.stderr?.trim()) addLog("info", result.stderr.trim());
    } catch (e: any) {
      setBuildResult(null);
      addLog("error", e.message || "Build failed.");
    }
    setBuilding(false);
  };

  const handlePublish = async () => {
    if (!buildResult) {
      addLog("warn", "Build the package before publishing.");
      return;
    }
    if (!effectiveAddress) {
      addLog("warn", "Connect a wallet before publishing.");
      return;
    }

    setPublishing(true);
    addLog("info", `Publishing to ${NETWORK_CONFIG[network].label}...`);
    try {
      const suiClient = createSuiClient(network);
      const result = await publishPackage(
        suiClient,
        effectiveAddress,
        buildResult.modules,
        buildResult.dependencies,
        network,
        activeSignerId,
      );

      const packageId = await resolvePackageIdFromPublish(suiClient, {
        digest: result.digest,
        objectChanges: result.objectChanges,
      });

      const { enrichDeploymentArtifacts, getPackageNameFromFiles, listBuiltModuleNames } =
        await import("./playgroundComponents/package-artifacts");

      const artifacts = await enrichDeploymentArtifacts({
        client: suiClient,
        packageId,
        packageName: getPackageNameFromFiles(files),
        moveEntries,
        builtModuleNames: listBuiltModuleNames(files),
        publishObjectChanges: result.objectChanges,
      });

      const nextDeployment: PlaygroundDeployment = {
        packageId,
        digest: result.digest,
        network,
        publishedAt: Date.now(),
        ...artifacts,
      };
      setDeployment(nextDeployment);
      saveDeployment(nextDeployment);
      addLog("success", `Published package: ${packageId}`);
      addLog("info", `Transaction digest: ${result.digest}`);
      if (nextDeployment.moduleTargets?.length) {
        addLog(
          "info",
          `Modules: ${nextDeployment.moduleTargets.join(", ")}`,
        );
      }
      if (nextDeployment.entryTargets?.length) {
        addLog(
          "info",
          `Entry targets: ${nextDeployment.entryTargets.join(", ")}`,
        );
      }
    } catch (e: any) {
      addLog("error", e.message || "Publish failed.");
    }
    setPublishing(false);
  };

  const callEntry = async (
    entry: MoveEntryFunction,
    target: string,
  ) => {
    if (!deployment?.packageId) {
      addLog("warn", "Publish the package before calling entry functions.");
      return;
    }
    if (!effectiveAddress) {
      addLog("warn", "Connect a wallet before sending transactions.");
      return;
    }
    if (deployment.network !== network) {
      addLog(
        "warn",
        `Last publish was on ${deployment.network}. Switch network or republish.`,
      );
      return;
    }

    setCalling(true);
    addLog("info", `Calling ${target}...`);
    try {
      const suiClient = createSuiClient(network);
      const tx = new Transaction();
      const args = buildEntryArgs(entry, tx, entryArgs[entryKey(entry)]);
      tx.moveCall({ target, arguments: args });
      const result = await signAndExecuteTransaction(
        suiClient,
        effectiveAddress,
        tx,
        network,
        activeSignerId,
      );
      addLog("success", `Transaction succeeded: ${result.digest}`);

      const created = result.objectChanges?.filter(
        (change) => change.type === "created",
      );
      if (created?.length) {
        const ids = created
          .map((change) => ("objectId" in change ? change.objectId : null))
          .filter(Boolean);
        if (ids.length) {
          setCreatedObjectIds(ids);
          addLog("info", `Created objects: ${ids.join(", ")}`);
          const firstId = ids[0];
          if (entry.name.startsWith("create") && firstId) {
            setEntryArgs((prev) => {
              let next = fillObjectParams(prev, moveEntries, firstId, true);
              const ticketPrice = prev[entryKey(entry)]?.ticket_price;
              if (ticketPrice) {
                next = syncCoinAmounts(next, moveEntries, ticketPrice);
              }
              return next;
            });
          }
        }
      }
    } catch (e: any) {
      addLog("error", e.message || "Transaction failed.");
    }
    setCalling(false);
  };

  const handleCallEntry = (entry: MoveEntryFunction) => {
    if (!deployment?.packageId) return;

    const validationError = validateEntryArgs(
      entry,
      entryArgs[entryKey(entry)],
      deployment.packageId,
    );
    if (validationError) {
      addLog("warn", validationError);
      return;
    }

    const target = `${deployment.packageId}::${entry.module}::${entry.name}`;
    void callEntry(entry, target);
  };

  const handleRequestFaucet = async () => {
    if (network === "mainnet") {
      addLog("warn", "Faucet is not available on Mainnet.");
      return;
    }

    if (!effectiveAddress) {
      addLog("warn", "Connect a wallet before requesting faucet SUI.");
      return;
    }

    if (faucetLoading) return;

    const {
      checkFaucetThrottle,
      faucetDebounceMessage,
      formatFaucetRateLimitMessage,
      isFaucetRateLimitError,
      markFaucetRequested,
    } = await import("../../helper/faucet-throttle");

    const throttle = checkFaucetThrottle();
    if (!throttle.allowed && throttle.waitSeconds) {
      addLog(
        "warn",
        faucetDebounceMessage(
          throttle.waitSeconds,
          NETWORK_CONFIG[network].label,
        ),
      );
      return;
    }

    setFaucetLoading(true);
    addLog("info", `Requesting SUI from ${NETWORK_CONFIG[network].label} faucet...`);
    try {
      markFaucetRequested();
      if (network === "localnet") {
        const result = await window.playground.requestLocalFaucet(
          effectiveAddress,
        );
        addLog("success", result.message);
      } else {
        const result = await window.sui.requestFaucet({
          network,
          recipient: effectiveAddress,
        });
        if (!result.success) {
          const error = result.error || "Faucet request failed.";
          if (isFaucetRateLimitError(error)) {
            throw new Error(formatFaucetRateLimitMessage(NETWORK_CONFIG[network].label));
          }
          throw new Error(error);
        }
        addLog(
          "success",
          `Received ${result.amountSui?.toFixed(2) ?? "some"} SUI from the faucet.`,
        );
        if (result.digest) addLog("info", `Transaction digest: ${result.digest}`);
      }
      await refreshBalance();
      await refreshWallet();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Faucet request failed.";
      addLog("error", message);
    }
    setFaucetLoading(false);
  };

  const openWorkspace = async () => {
    try {
      const path = await window.playground.openWorkspace();
      addLog("info", `Opened workspace: ${path}`);
    } catch (e: any) {
      addLog("error", e.message || "Failed to open workspace.");
    }
  };

  if (activeTab === "ika" && ikaToolchainReady) {
    return (
      <div className="flex flex-col h-full min-h-0 bg-[#080810]">
        <header className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border-b border-white/[0.06] bg-[#101018]">
          <PlaygroundTabs
            active={activeTab}
            onChange={setActiveTab}
            ikaReady={ikaToolchainReady}
          />
        </header>
        <IkaPlayground />
      </div>
    );
  }

  if (activeTab === "defi") {
    return (
      <div className="flex flex-col h-full min-h-0 bg-[#080810]">
        <header className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border-b border-white/[0.06] bg-[#101018]">
          <PlaygroundTabs
            active={activeTab}
            onChange={setActiveTab}
            ikaReady={ikaToolchainReady}
          />
        </header>
        <DefiPlayground />
      </div>
    );
  }

  if (activeTab === "ptb") {
    return (
      <div className="flex flex-col h-full min-h-0 bg-[#080810]">
        <header className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border-b border-white/[0.06] bg-[#101018]">
          <PlaygroundTabs
            active={activeTab}
            onChange={setActiveTab}
            ikaReady={ikaToolchainReady}
          />
        </header>
        <PtbPlayground />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#080810]">
      <header className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border-b border-white/[0.06] bg-[#101018]">
        <PlaygroundTabs
          active={activeTab}
          onChange={setActiveTab}
          ikaReady={ikaToolchainReady}
        />

        <select
          value={loadedProject?.path ?? ""}
          onChange={(e) => {
            const path = e.target.value;
            if (!path) {
              loadDefaultTemplate();
              addLog("info", "Switched to default Playground template.");
              return;
            }
            const project = testableProjects.find((p) => p.path === path);
            if (project) handleLoadProject(project);
          }}
          className="h-8 min-w-[140px] max-w-[220px] px-2.5 rounded-xl text-[11px] bg-[#0d0d14] border border-[#2a2a3c] text-[#d8d8ea] outline-none hover:border-[#4ca3ff]/30 transition-colors"
        >
          <option value="">Default template</option>
          {testableProjects.map((project) => (
            <option key={project.path} value={project.path}>
              {project.name}
            </option>
          ))}
        </select>

        <div className="flex-1" />

        <NetworkSwitcher compact />
        <button
          onClick={refreshCliStatus}
          title="Refresh CLI status"
          className="h-8 w-8 flex items-center justify-center rounded-xl border border-[#2a2a3c] bg-[#0d0d14] text-[#8888a0] hover:text-[#f0f0f5] hover:border-[#4ca3ff]/25 cursor-pointer transition-all"
        >
          <RefreshCw size={14} />
        </button>
      </header>

      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        <LocalExplorer
          open={explorerOpen}
          walletAddress={effectiveAddress}
          onClose={() => setExplorerOpen(false)}
          onLog={addLog}
        />
        <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex flex-col flex-1 min-w-0 min-h-0">
          <div className="flex-shrink-0 flex items-center gap-0.5 px-2 h-10 border-b border-white/[0.06] bg-[#0d0d14] overflow-x-auto scrollbar-none">
            {files.map((file) => (
              <button
                key={file.id}
                onClick={() => setActiveFileId(file.id)}
                className={`px-3 h-8 rounded-lg text-[11px] font-mono border-none cursor-pointer whitespace-nowrap transition-all duration-150 ${
                  file.id === activeFileId
                    ? "bg-[#4ca3ff]/14 text-[#c7e5ff] shadow-[inset_0_0_0_1px_rgba(76,163,255,0.25)]"
                    : "bg-transparent text-[#8888a0] hover:text-[#f0f0f5] hover:bg-white/[0.04]"
                }`}
              >
                {file.name}
              </button>
            ))}
            <div className="flex-1 min-w-2" />
            <button
              onClick={resetToTemplate}
              title="Reset to template"
              className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg text-[11px] text-[#8888a0] hover:text-[#ff4d6d] hover:bg-[#ff4d6d]/10 bg-transparent border-none cursor-pointer transition-colors flex-shrink-0"
            >
              <Trash2 size={12} />
              Reset
            </button>
          </div>

          <div className="flex-1 min-h-0 relative">
            {activeFile && (
              <Editor
                height="100%"
                language={activeFile.language}
                value={activeFile.content}
                theme="vs-dark"
                onChange={(val) => updateActiveContent(val ?? "")}
                options={{
                  fontSize: 13,
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  padding: { top: 16, bottom: 16 },
                  lineNumbers: "on",
                  tabSize: 4,
                  wordWrap: "off",
                  smoothScrolling: true,
                  cursorBlinking: "smooth",
                  cursorSmoothCaretAnimation: "on",
                  renderLineHighlight: "gutter",
                }}
              />
            )}
          </div>
        </div>

        <PlaygroundDock
          network={network}
          walletAddress={effectiveAddress}
          suiBalance={suiBalance}
          cliStatus={cliStatus}
          buildResult={buildResult}
          deployment={deployment}
          entryArgs={entryArgs}
          createdObjectIds={createdObjectIds}
          onEntryArgsChange={setEntryArgs}
          building={building}
          publishing={publishing}
          calling={calling}
          faucetLoading={faucetLoading}
          localNetRunning={localNetRunning}
          onBuild={handleBuild}
          onPublish={handlePublish}
          onOpenWorkspace={openWorkspace}
          onRequestFaucet={handleRequestFaucet}
          moveEntries={moveEntries}
          moveModule={moveModule}
          loadedProjectName={loadedProject?.name ?? null}
          files={files}
          onCallEntry={handleCallEntry}
          onClearDeployment={() => {
            clearDeployment();
            setDeployment(null);
            addLog("info", "Cleared deployment info.");
          }}
          onOpenExplorer={() => setExplorerOpen(true)}
          onPlaygroundSignerChange={handlePlaygroundSignerChange}
          onLog={addLog}
        />
        </div>
      </div>

      <ConsoleErrorBoundary>
        <PlaygroundConsole
          logs={logs}
          onClear={() => setLogs([])}
          onCommand={handleConsoleCommand}
        />
      </ConsoleErrorBoundary>
    </div>
  );
}

export default PlaygroundPage;