import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSignPersonalMessage,
} from "@mysten/dapp-kit";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { useState, useEffect, useMemo } from "react";
import { useMcpHandler } from "../hooks/useMcpHandler";

import type {
  MemoryEntry,
  Network,
  Tab,
  RecallResult,
  AnalyzedFact,
} from "./memoryMangerComponents/types";
import {
  MAINNET,
  TESTNET,
  isElectron,
} from "./memoryMangerComponents/constants";
import { saveEntries, uid } from "./memoryMangerComponents/utils";
import { ManagerView } from "./memoryMangerComponents/ManagerView";
import { WorkspaceView } from "./memoryMangerComponents/WorkspaceView";
import {
  CreateModal,
  ImportModal,
  RenameModal,
  DeleteModal,
} from "./memoryMangerComponents/Modals";
import {
  MemoryFilterChip,
  MemorySortSelect,
  MemoryViewToggle,
  SearchField,
} from "./memoryMangerComponents/memory-ui";
import { ArrowLeft, Download, Plus, Search } from "lucide-react";

type MemoryFilter = "all" | "mainnet" | "testnet";
type MemorySort = "recent" | "name" | "network";
type MemoryViewMode = "grid" | "list";

export function WalrusMemoryApp({
  entries,
  setEntries,
}: {
  entries: MemoryEntry[];
  setEntries: React.Dispatch<React.SetStateAction<MemoryEntry[]>>;
}) {
  const account = useCurrentAccount();

  const [electronAddress, setElectronAddress] = useState<string | null>(null);
  const [electronAgentChecked, setElectronAgentChecked] = useState(false);

  const walletAddress = isElectron
    ? electronAddress
    : (account?.address ?? null);

  const { mutateAsync: signAndExecTx } = useSignAndExecuteTransaction();
  const { mutateAsync: signMsg } = useSignPersonalMessage();

  // ── Manager state ───────────────────────────────────────────────────
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<"manager" | "workspace">("manager");

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<MemoryFilter>("all");
  const [sort, setSort] = useState<MemorySort>("recent");
  const [cardView, setCardView] = useState<MemoryViewMode>("grid");
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [revealedKeyId, setRevealedKeyId] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Import modal fields
  const [importLabel, setImportLabel] = useState("");
  const [importAccountId, setImportAccountId] = useState("");
  const [importDelegateKey, setImportDelegateKey] = useState("");
  const [importNetwork, setImportNetwork] = useState<Network>("mainnet");

  // Create modal fields
  const [createLabel, setCreateLabel] = useState("");
  const [createNetwork, setCreateNetwork] = useState<Network>("mainnet");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // ── Workspace state ─────────────────────────────────────────────────
  const [tab, setTab] = useState<Tab>("remember");
  const [memwalClient, setMemwalClient] = useState<any>(null);
  const [rememberText, setRememberText] = useState("");
  const [recallQuery, setRecallQuery] = useState("");
  const [analyzeText, setAnalyzeText] = useState("");
  const [recallResults, setRecallResults] = useState<RecallResult[]>([]);
  const [analyzeFacts, setAnalyzeFacts] = useState<AnalyzedFact[]>([]);
  const [log, setLog] = useState<
    { type: "info" | "success" | "error"; msg: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState<string | null>(null);

  const activeEntry = useMemo(
    () => entries.find((e) => e.id === activeId) ?? null,
    [entries, activeId],
  );

  const stats = useMemo(() => {
    const mainnet = entries.filter((e) => e.network === "mainnet").length;
    const testnet = entries.filter((e) => e.network === "testnet").length;
    return { total: entries.length, mainnet, testnet };
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = entries.filter((e) => {
      if (q) {
        const hay = `${e.label} ${e.namespace} ${e.accountId}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filter === "mainnet") return e.network === "mainnet";
      if (filter === "testnet") return e.network === "testnet";
      return true;
    });

    list = [...list].sort((a, b) => {
      if (sort === "name") return a.label.localeCompare(b.label);
      if (sort === "network") {
        const net = a.network.localeCompare(b.network);
        return net !== 0 ? net : a.label.localeCompare(b.label);
      }
      return b.createdAt - a.createdAt;
    });

    return list;
  }, [entries, search, filter, sort]);

  useMcpHandler({
    entries,
    walletAddress,
    accountState: activeEntry
      ? {
          accountId: activeEntry.accountId,
          delegateKey: activeEntry.delegateKey,
        }
      : { accountId: null, delegateKey: null },
    memwalClient,
    network: activeEntry?.network ?? "mainnet",
    health,
  });

  const addLog = (type: "info" | "success" | "error", msg: string) => {
    setLog((prev) => [{ type, msg }, ...prev].slice(0, 30));
  };

  useEffect(() => {
    saveEntries(entries);
  }, [entries]);

  useEffect(() => {
    if (!showCreateMenu) return;
    const handler = () => setShowCreateMenu(false);
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showCreateMenu]);

  useEffect(() => {
    if (!isElectron) {
      setElectronAgentChecked(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const info = await window.sui.getWalletInfo();
        if (!cancelled && info?.success) setElectronAddress(info.address);
      } finally {
        if (!cancelled) setElectronAgentChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── MemWal SDK init ─────────────────────────────────────────────────
  useEffect(() => {
    if (!activeEntry) {
      setMemwalClient(null);
      setHealth(null);
      return;
    }
    let cancelled = false;
    const cfg = activeEntry.network === "mainnet" ? MAINNET : TESTNET;
    (async () => {
      try {
        const { MemWal } = await import("@mysten-incubation/memwal");
        const client = MemWal.create({
          key: activeEntry.delegateKey,
          accountId: activeEntry.accountId,
          serverUrl: cfg.RELAYER,
          namespace: activeEntry.namespace || "default",
        });
        if (!cancelled) {
          setMemwalClient(client);
          const h = await client.health();
          setHealth(h.status);
          addLog("success", `Connection OK (${h.status})`);
        }
      } catch (e: any) {
        if (!cancelled) addLog("error", "SDK init error: " + e.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeEntry?.id, activeEntry?.network, activeEntry?.namespace]);

  // ── Wallet signer builder ───────────────────────────────────────────
  const buildWalletSigner = (suiClient: SuiJsonRpcClient) => {
    const address = isElectron ? electronAddress! : account!.address;

    if (isElectron) {
      return {
        address,
        signAndExecuteTransaction: async (input: { transaction: any }) => {
          const tx = input.transaction;
          tx.setSender(address);
          const txBytes = await tx.build({ client: suiClient });
          const txBytesB64 =
            typeof Buffer !== "undefined"
              ? Buffer.from(txBytes).toString("base64")
              : btoa(String.fromCharCode(...new Uint8Array(txBytes)));

          const signed = await window.electronAPI.signTransaction(txBytesB64);
          if (!signed.success)
            throw new Error(signed.error || "Transaction signing failed.");
          if (!signed.bytes || !signed.signature)
            throw new Error("Transaction signing failed.");

          const execResult = await suiClient.executeTransactionBlock({
            transactionBlock: txBytesB64,
            signature: signed.signature,
            options: { showEffects: true },
          });
          return { digest: execResult.digest };
        },
        signPersonalMessage: async (input: { message: Uint8Array }) => {
          const messageB64 =
            typeof Buffer !== "undefined"
              ? Buffer.from(input.message).toString("base64")
              : btoa(String.fromCharCode(...input.message));

          const signed =
            await window.electronAPI.signPersonalMessage(messageB64);
          if (!signed.success)
            throw new Error(signed.error || "Message signing failed.");
          if (!signed.signature) throw new Error("Message signing failed.");
          return { signature: signed.signature };
        },
      };
    }

    return {
      address,
      signAndExecuteTransaction: async (input: { transaction: any }) => {
        const tx = input.transaction;
        tx.setSender(address);
        await tx.build({ client: suiClient });
        const result = await signAndExecTx({ transaction: tx });
        return { digest: result.digest };
      },
      signPersonalMessage: async (input: { message: Uint8Array }) => {
        const result = await signMsg({ message: input.message });
        return { signature: result.signature };
      },
    };
  };

  // ── Create account ──────────────────────────────────────────────────
  const runCreateAccount = async () => {
    if (!walletAddress) return;
    setCreateLoading(true);
    setCreateError(null);
    const cfg = createNetwork === "mainnet" ? MAINNET : TESTNET;
    try {
      const {
        createAccount: createAcc,
        addDelegateKey,
        generateDelegateKey,
      } = await import("@mysten-incubation/memwal/account");
      const suiClient = new SuiJsonRpcClient({
        url: cfg.RPC,
        network: cfg.NETWORK,
      });
      const walletSigner = buildWalletSigner(suiClient);

      let accountId: string;
      try {
        const result = await createAcc({
          packageId: cfg.PACKAGE_ID,
          registryId: cfg.REGISTRY_ID,
          walletSigner,
          suiClient,
          suiNetwork: cfg.NETWORK,
        });
        accountId = result.accountId;
      } catch (e: any) {
        if (e.message?.includes("abort code: 3")) {
          setCreateError(
            "An account already exists for this wallet on this network. Use the Import option instead.",
          );
          setCreateLoading(false);
          return;
        }
        throw e;
      }

      const delegate = await generateDelegateKey();
      await addDelegateKey({
        packageId: cfg.PACKAGE_ID,
        accountId,
        publicKey: delegate.publicKey,
        label: `${isElectron ? "Desktop App" : "Web App"} ${new Date().toLocaleDateString("en-US")}`,
        walletSigner,
        suiClient,
        suiNetwork: cfg.NETWORK,
      });

      const entry: MemoryEntry = {
        id: uid(),
        label: createLabel.trim() || `Memory ${entries.length + 1}`,
        accountId,
        delegateKey: delegate.privateKey,
        network: createNetwork,
        namespace: "default",
        createdAt: Date.now(),
      };
      setEntries((prev) => [entry, ...prev]);
      setShowCreateModal(false);
      setCreateLabel("");
      setActiveId(entry.id);
      setView("workspace");
    } catch (e: any) {
      setCreateError(e.message || String(e));
    }
    setCreateLoading(false);
  };

  const runImport = () => {
    if (!importAccountId.trim() || !importDelegateKey.trim()) return;
    const entry: MemoryEntry = {
      id: uid(),
      label: importLabel.trim() || `Memory ${entries.length + 1}`,
      accountId: importAccountId.trim(),
      delegateKey: importDelegateKey.trim(),
      network: importNetwork,
      namespace: "default",
      createdAt: Date.now(),
    };
    setEntries((prev) => [entry, ...prev]);
    setShowImportModal(false);
    setImportLabel("");
    setImportAccountId("");
    setImportDelegateKey("");
  };

  const deleteEntry = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    if (activeId === id) {
      setActiveId(null);
      setView("manager");
    }
    setConfirmDeleteId(null);
  };

  const commitRename = () => {
    if (!renamingId) return;
    setEntries((prev) =>
      prev.map((e) =>
        e.id === renamingId
          ? { ...e, label: renameValue.trim() || e.label }
          : e,
      ),
    );
    setRenamingId(null);
  };

  const updateNamespace = (id: string, ns: string) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, namespace: ns } : e)),
    );
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    } catch {}
  };

  // ── Workspace actions ───────────────────────────────────────────────
  const handleRemember = async () => {
    if (!memwalClient || !rememberText.trim()) return;
    setLoading(true);
    addLog("info", "Saving memory...");
    try {
      const result = await memwalClient.rememberAndWait(
        rememberText,
        activeEntry?.namespace || "default",
      );
      addLog("success", `Saved! Blob: ${result.blob_id?.slice(0, 12) ?? ""}…`);
      setRememberText("");
    } catch (e: any) {
      addLog("error", "Remember error: " + e.message);
    }
    setLoading(false);
  };

  const handleRecall = async () => {
    if (!memwalClient || !recallQuery.trim()) return;
    setLoading(true);
    addLog("info", "Searching...");
    try {
      const result = await memwalClient.recall({
        query: recallQuery,
        limit: 5,
        namespace: activeEntry?.namespace || "default",
      });
      setRecallResults(result.results);
      addLog("success", `${result.total} results found`);
    } catch (e: any) {
      addLog("error", "Recall error: " + e.message);
    }
    setLoading(false);
  };

  const handleAnalyze = async () => {
    if (!memwalClient || !analyzeText.trim()) return;
    setLoading(true);
    addLog("info", "Analyzing text...");
    try {
      const result = await memwalClient.analyze(
        analyzeText,
        activeEntry?.namespace || "default",
      );
      setAnalyzeFacts(result.facts);
      addLog("success", `${result.fact_count} facts extracted`);
    } catch (e: any) {
      addLog("error", "Analyze error: " + e.message);
    }
    setLoading(false);
  };

  const openWorkspace = (id: string) => {
    setActiveId(id);
    setView("workspace");
    setTab("remember");
    setRecallResults([]);
    setAnalyzeFacts([]);
    setLog([]);
  };

  const openCreateModal = () => {
    if (!walletAddress) return;
    setShowCreateMenu(false);
    setShowCreateModal(true);
  };

  const openImportModal = () => {
    setShowCreateMenu(false);
    setShowImportModal(true);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#161616] text-[#f0f0f5] memory-main-glow">
      <header className="flex-shrink-0 sticky top-0 z-30 border-b border-[#2a2a2a] bg-[#1e1e1e]/95 backdrop-blur-sm">
        <div className="px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-3">
            {view === "workspace" ? (
              <button
                type="button"
                onClick={() => setView("manager")}
                className="flex items-center gap-2 text-[#8888a0] hover:text-[#f0f0f5] cursor-pointer"
                aria-label="Back to Memory Manager"
              >
                <ArrowLeft size={16} />
                <span className="text-[15px] font-semibold text-[#f4f4fa] truncate max-w-[240px]">
                  {activeEntry?.label ?? "Back"}
                </span>
              </button>
            ) : (
              <div>
                <h1 className="text-[15px] font-semibold text-[#f4f4fa]">Memory</h1>
                <p className="text-[11px] text-[#666688] mt-0.5">
                  {stats.total} fragment{stats.total === 1 ? "" : "s"}
                  <span className="mx-1.5 text-[#3a3a48]">·</span>
                  {stats.mainnet} mainnet
                  <span className="mx-1.5 text-[#3a3a48]">·</span>
                  {stats.testnet} testnet
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {view === "manager" ? (
              <MemoryViewToggle view={cardView} onChange={setCardView} />
            ) : null}

            <div className="relative" onMouseDown={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setShowCreateMenu((v) => !v)}
                className="h-9 px-4 flex items-center gap-2 rounded-xl text-[12px] font-semibold cursor-pointer border border-[#6c63ff]/40 bg-[#6c63ff]/18 text-[#b8b0ff] hover:bg-[#6c63ff]/26"
              >
                <Plus size={14} />
                New / Import
              </button>

              {showCreateMenu && (
                <div className="absolute top-[calc(100%+8px)] right-0 bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-2 w-[220px] z-50 shadow-[0_18px_40px_-16px_#000]">
                  <button
                    type="button"
                    disabled={!walletAddress}
                    onClick={openCreateModal}
                    className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] text-[#f0f0f5] hover:bg-white/[0.05] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span className="w-7 h-7 rounded-lg bg-[#6c63ff]/15 flex items-center justify-center flex-shrink-0">
                      <Plus size={14} className="text-[#9d97ff]" />
                    </span>
                    <span>
                      <div className="font-semibold">New account</div>
                      <div className="text-[11px] text-[#55556a]">
                        {walletAddress ? "On-chain creation" : "Wallet required"}
                      </div>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={openImportModal}
                    className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] text-[#f0f0f5] hover:bg-white/[0.05] cursor-pointer"
                  >
                    <span className="w-7 h-7 rounded-lg bg-[#4ca3ff]/12 flex items-center justify-center flex-shrink-0">
                      <Download size={14} className="text-[#4ca3ff]" />
                    </span>
                    <span>
                      <div className="font-semibold">Import</div>
                      <div className="text-[11px] text-[#55556a]">Existing ID + key</div>
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {view === "manager" ? (
          <div className="px-6 pb-3 flex flex-wrap items-center gap-2.5">
            <div className="flex-1 min-w-[200px] max-w-md">
              <SearchField
                value={search}
                onChange={setSearch}
                placeholder="Search fragments..."
                icon={<Search size={14} />}
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <MemoryFilterChip
                active={filter === "all"}
                onClick={() => setFilter("all")}
                count={stats.total}
              >
                All
              </MemoryFilterChip>
              <MemoryFilterChip
                active={filter === "mainnet"}
                onClick={() => setFilter("mainnet")}
                count={stats.mainnet}
              >
                Mainnet
              </MemoryFilterChip>
              <MemoryFilterChip
                active={filter === "testnet"}
                onClick={() => setFilter("testnet")}
                count={stats.testnet}
              >
                Testnet
              </MemoryFilterChip>
            </div>

            <MemorySortSelect
              value={sort}
              onChange={(v) => setSort(v as MemorySort)}
            />
          </div>
        ) : null}
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-6 py-6 max-w-[1400px] mx-auto">
          {view === "manager" ? (
            <ManagerView
              entries={filteredEntries}
              view={cardView}
              search={search}
              walletConnected={!!walletAddress}
              onOpen={openWorkspace}
              onRename={(id, current) => {
                setRenamingId(id);
                setRenameValue(current);
              }}
              onDelete={(id) => setConfirmDeleteId(id)}
              onCreate={openCreateModal}
              onImport={openImportModal}
              revealedKeyId={revealedKeyId}
              setRevealedKeyId={setRevealedKeyId}
              copiedField={copiedField}
              copyToClipboard={copyToClipboard}
            />
          ) : (
            <WorkspaceView
              entry={activeEntry}
              isReady={!!memwalClient}
              tab={tab}
              setTab={setTab}
              rememberText={rememberText}
              setRememberText={setRememberText}
              recallQuery={recallQuery}
              setRecallQuery={setRecallQuery}
              analyzeText={analyzeText}
              setAnalyzeText={setAnalyzeText}
              recallResults={recallResults}
              analyzeFacts={analyzeFacts}
              loading={loading}
              health={health}
              log={log}
              handleRemember={handleRemember}
              handleRecall={handleRecall}
              handleAnalyze={handleAnalyze}
              onNamespaceChange={(ns) =>
                activeEntry && updateNamespace(activeEntry.id, ns)
              }
            />
          )}
        </div>
      </main>

      {/* Modals */}
      {showCreateModal && (
        <CreateModal
          walletAddress={walletAddress}
          createLabel={createLabel}
          setCreateLabel={setCreateLabel}
          createNetwork={createNetwork}
          setCreateNetwork={setCreateNetwork}
          createLoading={createLoading}
          createError={createError}
          onConfirm={runCreateAccount}
          onClose={() => !createLoading && setShowCreateModal(false)}
        />
      )}

      {showImportModal && (
        <ImportModal
          importLabel={importLabel}
          setImportLabel={setImportLabel}
          importAccountId={importAccountId}
          setImportAccountId={setImportAccountId}
          importDelegateKey={importDelegateKey}
          setImportDelegateKey={setImportDelegateKey}
          importNetwork={importNetwork}
          setImportNetwork={setImportNetwork}
          onConfirm={runImport}
          onClose={() => setShowImportModal(false)}
        />
      )}

      {renamingId && (
        <RenameModal
          renameValue={renameValue}
          setRenameValue={setRenameValue}
          onConfirm={commitRename}
          onClose={() => setRenamingId(null)}
        />
      )}

      {confirmDeleteId && (
        <DeleteModal
          onConfirm={() => deleteEntry(confirmDeleteId)}
          onClose={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  );
}