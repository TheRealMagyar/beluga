import { useCallback, useEffect, useState } from "react";
import {
  Play,
  Square,
  RefreshCw,
  Loader2,
  Droplets,
  Settings2,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import { LocalnetLogPanel } from "../../components/LocalnetLogPanel";

export type SuiClientPanelMode = "move" | "ika";

type ClientStatus = Awaited<
  ReturnType<typeof window.playground.getClientStatus>
>;
type StackStatus = Awaited<
  ReturnType<typeof window.playground.getIkaLocalnetStackStatus>
>;
type LocalStatus = Awaited<
  ReturnType<typeof window.playground.getLocalNetworkStatus>
>;
type ResumeStatus = Awaited<
  ReturnType<typeof window.playground.getLocalnetResumeStatus>
>;

function streamEntriesToLines(
  lines: Array<string | StreamLogEntry>,
): string[] {
  return lines.map((line) =>
    typeof line === "string" ? line : line.message,
  );
}

function moveStatusLabel(sui: LocalStatus | null): string {
  if (!sui) return "Loading…";
  if (sui.rpcReady) {
    return sui.forIka
      ? "Sui running (Ika profile) — stop from Ika tab to switch"
      : "Sui localnet running";
  }
  if (sui.managed) return "Starting Sui localnet…";
  return "Stopped · press Start";
}

function statusToneMove(sui: LocalStatus | null) {
  if (sui?.rpcReady && !sui.forIka) return "ready";
  if (sui?.rpcReady && sui.forIka) return "progress";
  if (sui?.managed) return "progress";
  return "stopped";
}

function statusToneIka(phase: StackStatus["phase"]) {
  if (phase === "ready") return "ready";
  if (phase === "stopped") return "stopped";
  return "progress";
}

export function SuiClientPanel({
  mode,
  walletAddress,
  onLog,
}: {
  mode: SuiClientPanelMode;
  walletAddress: string | null;
  onLog: (level: "info" | "success" | "warn" | "error", message: string) => void;
}) {
  const [clientStatus, setClientStatus] = useState<ClientStatus | null>(null);
  const [stack, setStack] = useState<StackStatus | null>(null);
  const [localStatus, setLocalStatus] = useState<LocalStatus | null>(null);
  const [resumeStatus, setResumeStatus] = useState<ResumeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [liveSuiLogs, setLiveSuiLogs] = useState<string[]>([]);
  const [liveIkaLogs, setLiveIkaLogs] = useState<string[]>([]);

  const isIka = mode === "ika";

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const client = await window.playground.getClientStatus();
      setClientStatus(client);

      if (isIka) {
        const [nextStack, resume] = await Promise.all([
          window.playground.getIkaLocalnetStackStatus(),
          window.playground.getLocalnetResumeStatus(),
        ]);
        setStack(nextStack);
        setResumeStatus(resume);
        setLocalStatus(nextStack.sui);
        setLiveSuiLogs(nextStack.sui.recentLogs ?? []);
        setLiveIkaLogs(nextStack.ika.recentLogs ?? []);
      } else {
        const sui = await window.playground.getLocalNetworkStatus();
        setLocalStatus(sui);
        setStack(null);
        setResumeStatus(null);
        setLiveSuiLogs(sui.recentLogs ?? []);
        setLiveIkaLogs([]);
      }
    } catch (e: any) {
      onLog("error", e.message || "Failed to load localnet status.");
    }
    setLoading(false);
  }, [onLog, isIka]);

  const sui = isIka ? stack?.sui : localStatus;
  const ika = stack?.ika;
  const isActive = isIka
    ? Boolean(stack?.sui?.rpcReady) || Boolean(stack?.ika?.running)
    : Boolean(localStatus?.rpcReady);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    void window.playground.getLocalnetLogSnapshot().then((snapshot) => {
      setLiveSuiLogs(streamEntriesToLines(snapshot.sui));
      setLiveIkaLogs(streamEntriesToLines(snapshot.ika));
    });

    const unsubscribe = window.playground.onLocalnetLogs((payload) => {
      const lines = streamEntriesToLines(payload.lines);
      if (payload.source === "sui") {
        setLiveSuiLogs(lines);
      } else {
        setLiveIkaLogs(lines);
      }
    });
    return unsubscribe;
  }, []);

  const phase = stack?.phase ?? "stopped";
  const isBootstrapping =
    busy != null ||
    isActive ||
    phase === "starting" ||
    phase === "bootstrapping" ||
    phase === "dkg" ||
    Boolean(localStatus?.managed);

  useEffect(() => {
    const isWindows = window.electronAPI?.platform === "win32";
    const pollMs = isBootstrapping
      ? isWindows
        ? 2_500
        : 800
      : isWindows
        ? 5_000
        : 2_000;

    const poll = () => {
      if (document.visibilityState === "hidden") return;
      if (isIka) {
        window.playground
          .getIkaLocalnetStackStatus()
          .then((nextStack) => {
            setStack(nextStack);
            setLocalStatus(nextStack.sui);
          })
          .catch(() => undefined);
      } else {
        window.playground
          .getLocalNetworkStatus()
          .then((next) => {
            setLocalStatus(next);
          })
          .catch(() => undefined);
      }
    };

    poll();
    const timer = window.setInterval(poll, pollMs);
    return () => window.clearInterval(timer);
  }, [isBootstrapping, isIka]);

  const run = async (
    key: string,
    action: () => Promise<{ message: string }>,
    level: "info" | "success" | "warn" | "error" = "success",
  ) => {
    setBusy(key);
    try {
      const result = await action();
      onLog(level, result.message);
      await refresh();
    } catch (e: any) {
      onLog("error", e.message || "Action failed.");
      await refresh();
    }
    setBusy(null);
  };

  const tone = isIka ? statusToneIka(phase) : statusToneMove(localStatus);

  const canStart = isIka
    ? !busy && !(sui?.rpcReady && ika?.running)
    : !busy &&
      (!localStatus?.rpcReady ||
        (localStatus.rpcReady && localStatus.forIka === true));

  const canStop = !busy && isActive;
  const canReset = !busy;

  const statusClass =
    tone === "ready"
      ? "border-[#00d4aa]/30 text-[#00d4aa] bg-[#00d4aa]/10"
      : tone === "progress"
        ? "border-[#ffb347]/30 text-[#ffb347] bg-[#ffb347]/10"
        : "border-[#8888a0]/20 text-[#8888a0] bg-white/[0.03]";

  const statusLabel = isIka
    ? (stack?.label ?? "Loading…")
    : moveStatusLabel(localStatus);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={refresh}
          disabled={loading}
          className="h-7 px-2.5 flex items-center gap-1.5 rounded-lg border border-[#2a2a3c] text-[11px] text-[#8888a0] hover:text-[#f0f0f5] cursor-pointer disabled:opacity-50"
          title="Refresh status"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {!clientStatus?.configured ? (
        <div className="mb-3">
          <p className="text-[12px] text-[#8888a0] leading-relaxed mb-2">
            Initialize the Sui client once for faucet and local transactions.
          </p>
          <button
            onClick={() =>
              run("init", () => window.playground.initClient(), "success")
            }
            disabled={busy != null}
            className="w-full h-9 rounded-xl text-[12px] font-medium border border-[#4ca3ff]/30 bg-[#4ca3ff]/10 text-[#4ca3ff] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy === "init" ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Settings2 size={13} />
            )}
            Initialize client
          </button>
        </div>
      ) : (
        <div className="mb-1 flex flex-wrap gap-1.5 text-[10px]">
          {clientStatus.environments.map((env) => (
            <button
              key={env.alias}
              onClick={() =>
                run(
                  `env-${env.alias}`,
                  () => window.playground.switchEnv(env.alias),
                  "info",
                )
              }
              disabled={busy != null || env.active}
              className={`h-6 px-2 rounded-md font-mono border cursor-pointer disabled:opacity-60 ${
                env.active
                  ? "border-[#00d4aa]/35 bg-[#00d4aa]/10 text-[#00d4aa]"
                  : "border-[#2a2a3c] bg-transparent text-[#8888a0] hover:text-[#f0f0f5]"
              }`}
            >
              {env.active && <CheckCircle2 size={9} className="inline mr-1" />}
              {env.alias}
            </button>
          ))}
        </div>
      )}

      <div className="border-t border-[#2a2a3c] pt-3">
        <p className="text-[11px] font-bold text-[#8888a0] uppercase tracking-[1.2px] mb-2">
          {isIka ? "Ika dWallet localnet" : "Sui localnet"}
        </p>
        <p className="text-[11px] text-[#8888a0] leading-relaxed mb-2">
          {isIka
            ? "One-click Ika-compatible Sui + Ika localnet for dWallets. Start resumes saved state when possible."
            : "Local Sui node for Move build, publish, and test. Does not start Ika."}
        </p>

        <div
          className={`text-[11px] px-2.5 py-1.5 rounded-lg mb-3 border ${statusClass}`}
        >
          {statusLabel}
        </div>

        {isIka && resumeStatus && !resumeStatus.toolchainWritable && (
          <div className="text-[10px] text-[#ff4d6d] mb-2 leading-relaxed space-y-2">
            <p>
              Toolchain folder not writable at{" "}
              <span className="font-mono">{resumeStatus.toolchainRoot}</span>.
              This usually comes from running Beluga with sudo.
            </p>
            <p className="font-mono text-[9px]">
              cd ~/Documents/GitHub/beluga && npm run fix-permissions
            </p>
          </div>
        )}

        {!isIka && localStatus?.forIka && localStatus.rpcReady && (
          <p className="text-[10px] text-[#ffb347] mb-2 leading-relaxed">
            Port 9000 is running the Ika Sui profile. Stop it from the Ika tab
            before starting Move localnet here.
          </p>
        )}

        {isIka && ika?.readinessHint && (
          <p className="text-[10px] text-[#ffb347] mb-2 leading-relaxed">
            {ika.readinessHint}
          </p>
        )}

        {isIka && phase === "bootstrapping" && (
          <p className="text-[10px] text-[#ffb347] mb-2 leading-relaxed">
            First run can take 5–15 minutes (compile + ika_config.json). Keep
            Beluga open and watch logs below.
          </p>
        )}

        {isIka && phase === "dkg" && !ika?.dwalletReady && (
          <p className="text-[10px] text-[#ffb347] mb-2 leading-relaxed">
            Network DKG is running. Create dWallet unlocks when Ika syncs with
            Sui.
          </p>
        )}

        <div className="grid grid-cols-3 gap-2 mb-2">
          <button
            onClick={() =>
              run(
                "start",
                async () => {
                  if (isIka) {
                    const result =
                      await window.playground.startIkaLocalnetStack();
                    return { message: result.message };
                  }
                  const status = await window.playground.startLocalNetwork({
                    withFaucet: true,
                    forIka: false,
                  });
                  return {
                    message: status.rpcReady
                      ? "Move Sui localnet started."
                      : "Sui localnet is starting…",
                  };
                },
                "success",
              )
            }
            disabled={!canStart}
            className="h-9 rounded-xl text-[12px] font-medium border border-[#00d4aa]/30 bg-[#00d4aa]/10 text-[#00d4aa] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {busy === "start" ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Play size={13} />
            )}
            Start
          </button>
          <button
            onClick={() =>
              run(
                "stop",
                async () => {
                  if (isIka) {
                    const result =
                      await window.playground.stopIkaLocalnetStack();
                    return { message: result.message };
                  }
                  await window.playground.stopLocalNetwork({ stopIka: false });
                  return { message: "Move Sui localnet stopped." };
                },
                "info",
              )
            }
            disabled={!canStop}
            className="h-9 rounded-xl text-[12px] font-medium border border-[#ff4d6d]/25 bg-[#ff4d6d]/10 text-[#ff4d6d] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {busy === "stop" ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Square size={13} />
            )}
            Stop
          </button>
          <button
            onClick={() => {
              const confirmMsg = isIka
                ? "Reset wipes Sui + Ika on-chain state and prepares a fresh chain. Continue?"
                : "Reset wipes persisted Move Sui chain state. Ika state is untouched. Continue?";
              if (!window.confirm(confirmMsg)) {
                return;
              }
              void run(
                "reset",
                async () => {
                  if (isIka) {
                    const result =
                      await window.playground.resetIkaLocalnetStack();
                    return { message: result.message };
                  }
                  await window.playground.resetMoveSuiLocalnet();
                  return {
                    message:
                      "Move Sui localnet reset — press Start for a fresh chain.",
                  };
                },
                "warn",
              );
            }}
            disabled={!canReset}
            className="h-9 rounded-xl text-[12px] font-medium border border-[#ffb347]/40 bg-[#ffb347]/15 text-[#ffb347] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {busy === "reset" ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <RotateCcw size={13} />
            )}
            Reset
          </button>
        </div>

        <button
          onClick={() =>
            run(
              "faucet",
              () => window.playground.requestLocalFaucet(walletAddress ?? undefined),
              "success",
            )
          }
          disabled={busy != null || !sui?.rpcReady || !walletAddress}
          className="w-full h-8 rounded-xl text-[11px] font-medium border border-[#4ca3ff]/30 bg-[#4ca3ff]/10 text-[#4ca3ff] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 mb-2"
        >
          {busy === "faucet" ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Droplets size={12} />
          )}
          Faucet SUI to wallet
        </button>

        <LocalnetLogPanel title="Sui logs" logs={liveSuiLogs} maxLines={40} />
        {isIka && (
          <div className="mt-2">
            <LocalnetLogPanel title="Ika logs" logs={liveIkaLogs} maxLines={40} />
          </div>
        )}
      </div>
    </div>
  );
}