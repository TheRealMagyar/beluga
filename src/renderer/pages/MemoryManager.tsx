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
import { walrusStyles } from "./memoryMangerComponents/styles";
import { ManagerView } from "./memoryMangerComponents/ManagerView";
import { WorkspaceView } from "./memoryMangerComponents/WorkspaceView";
import {
  CreateModal,
  ImportModal,
  RenameModal,
  DeleteModal,
} from "./memoryMangerComponents/Modals";
import { Plus, Download, ArrowLeft } from "lucide-react";

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

  return (
    <>
      <style>{walrusStyles}</style>

      <div className="walrus-app">
        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-[#2a2a3c] px-8 h-16 flex items-center justify-between bg-[#1e1e1e]">
          {/* Left: back button in workspace */}
          <div className="flex items-center gap-3">
            {view === "workspace" && (
              <button
                onClick={() => setView("manager")}
                className="flex items-center gap-2 text-[#8888a0] hover:text-[#f0f0f5] transition-colors"
                aria-label="Back to Memory Manager"
              >
                <ArrowLeft size={16} />
                <span className="text-[15px] font-semibold text-[#f0f0f5]">
                  {activeEntry?.label ?? "Back"}
                </span>
              </button>
            )}
          </div>

          {/* Right: dropdown trigger */}
          <div className="relative" onMouseDown={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowCreateMenu((v) => !v)}
              className="flex items-center gap-1.5 text-[13px] font-semibold px-4 py-2 rounded-[10px] bg-gradient-to-br from-[#6c63ff] to-[#5148d4] text-white active:scale-[0.97] transition-transform"
            >
              <Plus size={13} />
              New / Import
            </button>

            {showCreateMenu && (
              <div className="absolute top-[calc(100%+8px)] right-0 bg-[#1e1e1e] border border-[#2a2a3c] rounded-[12px] p-2 w-[220px] z-50 shadow-[0_18px_40px_-16px_#000]">
                <button
                  disabled={!walletAddress}
                  onClick={() => {
                    if (!walletAddress) return;
                    setShowCreateMenu(false);
                    setShowCreateModal(true);
                  }}
                  className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-[8px] text-[13.5px] text-[#f0f0f5] hover:bg-[#2a2a3c] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                >
                  <span className="w-7 h-7 rounded-[8px] bg-[#6c63ff22] flex items-center justify-center flex-shrink-0">
                    <Plus size={14} color="#9d97ff" />
                  </span>
                  <span>
                    <div className="font-semibold">New account</div>
                    <div className="text-[11px] text-[#555570]">
                      {walletAddress ? "On-chain creation" : "Wallet required"}
                    </div>
                  </span>
                </button>
                <button
                  onClick={() => {
                    setShowCreateMenu(false);
                    setShowImportModal(true);
                  }}
                  className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-[8px] text-[13.5px] text-[#f0f0f5] hover:bg-[#2a2a3c] transition-colors"
                >
                  <span className="w-7 h-7 rounded-[8px] bg-[#4ca3ff1a] flex items-center justify-center flex-shrink-0">
                    <Download size={14} color="#4ca3ff" />
                  </span>
                  <span>
                    <div className="font-semibold">Import</div>
                    <div className="text-[11px] text-[#555570]">Existing ID + key</div>
                  </span>
                </button>
              </div>
            )}
          </div>
        </header>

        {view === "manager" ? (
          <ManagerView
            entries={entries}
            walletAddress={walletAddress}
            onOpen={openWorkspace}
            onRename={(id, current) => {
              setRenamingId(id);
              setRenameValue(current);
            }}
            onDelete={(id) => setConfirmDeleteId(id)}
            onCreate={() => setShowCreateMenu((v) => !v)}
            showCreateMenu={showCreateMenu}
            onPickCreate={() => setShowCreateModal(true)}
            onPickImport={() => setShowImportModal(true)}
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
    </>
  );
}