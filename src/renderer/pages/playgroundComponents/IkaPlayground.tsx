import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Compass,
  Wrench,
  Loader2,
  Plus,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { useWallet } from "../../components/Walletcontext";
import { PlaygroundConsole } from "./PlaygroundConsole";
import { IkaExplorer } from "./IkaExplorer";
import { SuiClientPanel } from "./SuiClientPanel";
import { IkaLocalnetProgressPanel } from "./IkaLocalnetProgress";
import type { IkaLocalnetProgressInput } from "./ika-localnet-progress";
import type { ConsoleLog } from "./types";
import { uid } from "./utils";
import {
  createLocalIkaClient,
  createSharedDWallet,
  listOwnedDWalletCaps,
  resetIkaPlaygroundSeed,
  toIkaConfig,
  type CreatedDWallet,
  type IkaCurveOption,
} from "./ika-playground";

const DWALLET_STORAGE_KEY = "beluga-ika-playground-dwallets-v1";

function loadSavedDwallets(): CreatedDWallet[] {
  try {
    const raw = localStorage.getItem(DWALLET_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CreatedDWallet[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function IkaPlayground() {
  const { walletInfo, localNetRunning } = useWallet();
  const walletAddress = walletInfo?.address ?? null;

  const [logs, setLogs] = useState<ConsoleLog[]>([]);
  const [progressStatus, setProgressStatus] =
    useState<IkaLocalnetProgressInput | null>(null);
  const [ikaRunning, setIkaRunning] = useState(false);
  const [configReady, setConfigReady] = useState(false);
  const [dwalletReady, setDwalletReady] = useState(false);
  const [readinessHint, setReadinessHint] = useState<string | null>(null);
  const [healing, setHealing] = useState(false);
  const [curve, setCurve] = useState<IkaCurveOption>("secp256k1");
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dwallets, setDwallets] = useState<CreatedDWallet[]>(loadSavedDwallets);
  const [ownedCaps, setOwnedCaps] = useState<
    Array<{ id: string; dwallet_id: string }>
  >([]);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const bootLoggedRef = useRef(false);

  const addLog = useCallback(
    (level: ConsoleLog["level"], message: string) => {
      const entry = { id: uid(), level, message, timestamp: Date.now() };
      setLogs((prev) => [...prev, entry]);
      void window.belugaConsole.appendPlaygroundLog(entry);
    },
    [],
  );

  const refreshStatus = useCallback(async () => {
    try {
      const [stack, ikaStatus] = await Promise.all([
        window.playground.getIkaLocalnetStackStatus(),
        window.playground.getIkaLocalnetStatus(),
      ]);
      setIkaRunning(ikaStatus.running);
      setConfigReady(ikaStatus.configReady);
      setDwalletReady(ikaStatus.dwalletReady);
      setReadinessHint(ikaStatus.readinessHint);
      setProgressStatus({
        suiRunning: stack.sui.rpcReady,
        ikaRunning: ikaStatus.running,
        configReady: ikaStatus.configReady,
        networkDkgReady: ikaStatus.networkDkgReady,
        dwalletReady: ikaStatus.dwalletReady,
        coordinatorEpoch: ikaStatus.coordinatorEpoch,
        encryptionKeyState: ikaStatus.encryptionKeyState,
        dkgChunkCount: ikaStatus.dkgChunkCount,
        suiCheckpointLag: ikaStatus.suiCheckpointLag,
        readinessHint: ikaStatus.readinessHint,
        resumeAvailable: ikaStatus.resumeAvailable,
        stateOutOfSync: ikaStatus.stateOutOfSync,
        ikaStartedAt: ikaStatus.startedAt,
        phase: stack.phase,
      });
    } catch (e: any) {
      addLog("error", e.message || "Failed to refresh Ika status.");
    }
  }, [addLog]);

  const refreshOwnedCaps = useCallback(async () => {
    if (
      !walletAddress ||
      !configReady ||
      !localNetRunning ||
      !ikaRunning
    ) {
      setOwnedCaps([]);
      return;
    }

    setRefreshing(true);
    try {
      const ikaConfig = await window.playground.getIkaConfig();
      if (!ikaConfig.config) {
        throw new Error("Ika localnet config is not available yet.");
      }

      const { suiClient, ikaClient } = createLocalIkaClient(
        toIkaConfig(ikaConfig.config),
      );
      const caps = await listOwnedDWalletCaps(
        ikaClient,
        suiClient,
        walletAddress,
      );
      setOwnedCaps(
        caps.map((cap) => ({
          id: cap.id,
          dwallet_id: cap.dwallet_id,
        })),
      );
      addLog("success", `Loaded ${caps.length} dWallet cap(s) for your wallet.`);
    } catch (e: any) {
      setOwnedCaps([]);
      const message = e.message || "Failed to load owned dWallet caps.";
      if (/failed to fetch objects/i.test(message)) {
        return;
      }
      addLog("error", message);
    }
    setRefreshing(false);
  }, [walletAddress, configReady, localNetRunning, ikaRunning, addLog]);

  useEffect(() => {
    refreshStatus();
    if (!bootLoggedRef.current) {
      bootLoggedRef.current = true;
      addLog(
        "info",
        "Ika Playground ready. Start Sui + Ika localnet to create dWallets.",
      );
    }
    const timer = window.setInterval(refreshStatus, 3000);
    return () => window.clearInterval(timer);
  }, [refreshStatus, addLog]);

  useEffect(() => {
    if (configReady && walletAddress && localNetRunning && ikaRunning) {
      refreshOwnedCaps();
    }
  }, [configReady, walletAddress, localNetRunning, ikaRunning, refreshOwnedCaps]);

  useEffect(() => {
    localStorage.setItem(DWALLET_STORAGE_KEY, JSON.stringify(dwallets));
  }, [dwallets]);

  const canCreate = useMemo(
    () =>
      Boolean(
        walletAddress &&
          localNetRunning &&
          ikaRunning &&
          configReady &&
          dwalletReady &&
          !creating,
      ),
    [
      walletAddress,
      localNetRunning,
      ikaRunning,
      configReady,
      dwalletReady,
      creating,
    ],
  );

  const handleCreateDWallet = async () => {
    if (!walletAddress) {
      addLog("warn", "Connect your Beluga wallet first.");
      return;
    }
    if (!localNetRunning || !ikaRunning || !configReady) {
      addLog(
        "warn",
        "Start Sui localnet (Ika-compatible) and Ika localnet before creating a dWallet.",
      );
      return;
    }

    setCreating(true);
    addLog("info", `Creating shared dWallet on curve ${curve}...`);
    try {
      const ikaStatus = await window.playground.getIkaLocalnetStatus();
      if (!ikaStatus.dwalletReady) {
        throw new Error(
          ikaStatus.readinessHint ??
            "Ika localnet is not ready for dWallet creation yet.",
        );
      }

      const ikaConfigRes = await window.playground.getIkaConfig();
      if (!ikaConfigRes.config) {
        throw new Error(
          "ika_config.json not found. Restart Ika localnet to generate package IDs.",
        );
      }

      const { suiClient, ikaClient } = createLocalIkaClient(
        toIkaConfig(ikaConfigRes.config),
      );

      const created = await createSharedDWallet({
        ikaClient,
        suiClient,
        walletAddress,
        curve,
        onProgress: (message) => addLog("info", message),
      });

      setDwallets((prev) => [created, ...prev]);
      addLog("success", `dWallet created: ${created.dWalletId}`);
      addLog("info", `Cap object: ${created.dWalletCapId}`);
      await refreshOwnedCaps();
    } catch (e: any) {
      const message = e.message || "dWallet creation failed.";
      if (/dynamic fields object/i.test(message)) {
        addLog(
          "error",
          `${message} — Ika network DKG is not ready yet (encryption key data is still being written on-chain). Wait until the “Network DKG” badge turns green, or restart: Stop both → Sui with Reset chain + Ika-compatible → Start Ika → wait a few minutes.`,
        );
      } else {
        addLog("error", message);
      }
    }
    setCreating(false);
  };

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      <IkaExplorer
        open={explorerOpen}
        onClose={() => setExplorerOpen(false)}
        onLog={addLog}
      />
      <div className="flex flex-1 min-h-0">
        <div className="flex flex-col flex-1 min-w-0 border-r border-[#2a2a3c]">
          <div className="flex-shrink-0 px-5 py-4 border-b border-white/[0.06]">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span
                className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border ${
                  localNetRunning
                    ? "border-[#7dd3fc]/30 text-[#7dd3fc] bg-[#7dd3fc]/10"
                    : "border-[#8888a0]/20 text-[#8888a0] bg-white/[0.03]"
                }`}
              >
                Sui localnet
              </span>
              <span
                className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border ${
                  ikaRunning
                    ? "border-[#00e5ff]/30 text-[#00e5ff] bg-[#00e5ff]/10"
                    : "border-[#8888a0]/20 text-[#8888a0] bg-white/[0.03]"
                }`}
              >
                Ika localnet
              </span>
              <span
                className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border ${
                  configReady
                    ? "border-[#00d4aa]/30 text-[#00d4aa] bg-[#00d4aa]/10"
                    : "border-[#ffb347]/30 text-[#ffb347] bg-[#ffb347]/10"
                }`}
              >
                {configReady ? (
                  <CheckCircle2 size={11} />
                ) : (
                  <AlertCircle size={11} />
                )}
                {configReady ? "ika_config.json" : "config pending"}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border ${
                  dwalletReady
                    ? "border-[#00d4aa]/30 text-[#00d4aa] bg-[#00d4aa]/10"
                    : ikaRunning && configReady
                      ? "border-[#ffb347]/30 text-[#ffb347] bg-[#ffb347]/10"
                      : "border-[#8888a0]/20 text-[#8888a0] bg-white/[0.03]"
                }`}
              >
                {dwalletReady ? (
                  <CheckCircle2 size={11} />
                ) : (
                  <AlertCircle size={11} />
                )}
                {dwalletReady
                  ? "dWallet ready"
                  : ikaRunning && configReady
                    ? "Network DKG…"
                    : "Network DKG"}
              </span>
            </div>

            <p className="text-[12px] text-[#8888a0] leading-relaxed mb-4">
              Create zero-trust shared dWallets on your local Ika network using the
              Beluga wallet. Network DKG may take a few minutes after the first
              transaction.
            </p>

            {progressStatus && (
              <IkaLocalnetProgressPanel status={progressStatus} />
            )}

            <div className="flex flex-wrap items-center gap-2 mb-3">
              <button
                onClick={() => {
                  if (!localNetRunning) {
                    addLog("warn", "Start Sui localnet first to open Ika Explorer.");
                    return;
                  }
                  setExplorerOpen(true);
                }}
                disabled={!localNetRunning}
                className="h-8 px-3 flex items-center gap-2 rounded-xl text-[12px] border border-[#00e5ff]/30 bg-[#00e5ff]/10 text-[#00e5ff] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Compass size={14} />
                Ika Explorer
              </button>
              {readinessHint?.includes("out of sync") && (
                <button
                  onClick={async () => {
                    setHealing(true);
                    addLog(
                      "info",
                      "Healing localnet: regenesis Sui + fresh Ika bootstrap (5–10 minutes)...",
                    );
                    try {
                      const result = await window.playground.healIkaLocalnet();
                      addLog("success", result.message);
                      await refreshStatus();
                    } catch (e: any) {
                      addLog("error", e.message || "Heal failed.");
                    }
                    setHealing(false);
                  }}
                  disabled={healing}
                  className="h-8 px-3 flex items-center gap-2 rounded-xl text-[12px] border border-[#ffb347]/40 bg-[#ffb347]/15 text-[#ffb347] cursor-pointer disabled:opacity-50"
                >
                  {healing ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Wrench size={14} />
                  )}
                  Fix dWallet localnet
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
              <label className="block">
                <span className="text-[11px] text-[#8888a0] mb-1.5 block">
                  Curve
                </span>
                <select
                  value={curve}
                  onChange={(e) => setCurve(e.target.value as IkaCurveOption)}
                  disabled={creating}
                  className="w-full h-9 px-3 rounded-xl text-[12px] bg-[#1e1e1e] border border-[#2a2a3c] text-[#f0f0f5] outline-none"
                >
                  <option value="secp256k1">Secp256k1 (EVM / Bitcoin)</option>
                  <option value="secp256r1">Secp256r1</option>
                  <option value="ed25519">Ed25519 (Sui / Solana)</option>
                  <option value="ristretto">Ristretto</option>
                </select>
              </label>
              <button
                onClick={handleCreateDWallet}
                disabled={!canCreate}
                className="h-9 px-4 rounded-xl text-[12px] font-medium border border-[#00e5ff]/30 bg-[#00e5ff]/10 text-[#00e5ff] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {creating ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                {creating ? "Creating..." : "Create dWallet"}
              </button>
            </div>

            {!canCreate && !creating && !progressStatus?.dwalletReady && (
              <p className="mt-3 text-[11px] text-[#ffb347] leading-relaxed">
                {readinessHint?.includes("out of sync")
                  ? readinessHint
                  : "Create dWallet unlocks when the progress bar above reaches 100%."}
              </p>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[12px] font-bold text-[#8888a0] uppercase tracking-[1.2px]">
                  Created in Playground
                </h3>
                <button
                  onClick={() => {
                    if (
                      !window.confirm(
                        "Reset saved dWallet list and encryption seed for this playground?",
                      )
                    ) {
                      return;
                    }
                    setDwallets([]);
                    resetIkaPlaygroundSeed();
                    addLog("info", "Cleared saved Ika playground state.");
                  }}
                  className="text-[11px] text-[#8888a0] hover:text-[#f0f0f5] bg-transparent border-none cursor-pointer"
                >
                  Reset saved
                </button>
              </div>
              {dwallets.length === 0 ? (
                <p className="text-[12px] text-[#55556a]">
                  No dWallets created yet in this session.
                </p>
              ) : (
                <div className="space-y-2">
                  {dwallets.map((dw) => (
                    <div
                      key={`${dw.dWalletId}-${dw.digest}`}
                      className="rounded-xl border border-[#2a2a3c] bg-[#12121a] p-3"
                    >
                      <p className="text-[11px] text-[#00e5ff] font-mono break-all">
                        {dw.dWalletId}
                      </p>
                      <p className="text-[10px] text-[#55556a] mt-1">
                        curve: {dw.curve} · cap: {dw.dWalletCapId.slice(0, 10)}…
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[12px] font-bold text-[#8888a0] uppercase tracking-[1.2px] flex items-center gap-1.5">
                  <Wallet size={12} />
                  Owned caps (wallet)
                </h3>
                <button
                  onClick={refreshOwnedCaps}
                  disabled={refreshing || !walletAddress || !configReady}
                  className="h-7 px-2.5 flex items-center gap-1.5 rounded-lg border border-[#2a2a3c] text-[11px] text-[#8888a0] hover:text-[#f0f0f5] cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw
                    size={12}
                    className={refreshing ? "animate-spin" : ""}
                  />
                  Refresh
                </button>
              </div>
              {!walletAddress ? (
                <p className="text-[12px] text-[#55556a]">
                  Connect wallet to list owned dWallet capabilities.
                </p>
              ) : ownedCaps.length === 0 ? (
                <p className="text-[12px] text-[#55556a]">
                  No owned dWallet caps found on localnet.
                </p>
              ) : (
                <div className="space-y-2">
                  {ownedCaps.map((cap) => (
                    <div
                      key={cap.id}
                      className="rounded-xl border border-[#2a2a3c] bg-[#1e1e1e] p-3"
                    >
                      <p className="text-[10px] text-[#8888a0]">cap</p>
                      <p className="text-[11px] font-mono text-[#c7c7d8] break-all">
                        {cap.id}
                      </p>
                      <p className="text-[10px] text-[#55556a] mt-1 break-all">
                        dWallet: {cap.dwallet_id}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>

        <aside className="w-[320px] flex-shrink-0 overflow-y-auto p-4 bg-[#12121a]">
          <p className="text-[11px] font-bold text-[#8888a0] uppercase tracking-[1.2px] mb-3">
            Local networks
          </p>
          <SuiClientPanel mode="ika" walletAddress={walletAddress} onLog={addLog} />
        </aside>
      </div>

      <PlaygroundConsole logs={logs} onClear={() => setLogs([])} />
    </div>
  );
}