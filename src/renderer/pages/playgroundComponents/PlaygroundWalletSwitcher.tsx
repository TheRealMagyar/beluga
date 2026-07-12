import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw, Wallet } from "lucide-react";

type PlaygroundSigner = Awaited<
  ReturnType<typeof window.playground.getTestWallets>
>["signers"][number];

function shortenAddress(address: string) {
  if (address.length <= 14) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function PlaygroundWalletSwitcher({
  onSignerChange,
  onLog,
}: {
  onSignerChange: (address: string | null) => void;
  onLog: (level: "info" | "success" | "warn" | "error", message: string) => void;
}) {
  const [signers, setSigners] = useState<PlaygroundSigner[]>([]);
  const [activeSignerId, setActiveSignerId] = useState<string>("beluga");
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const onSignerChangeRef = useRef(onSignerChange);
  onSignerChangeRef.current = onSignerChange;

  const notifyActiveSigner = useCallback(
    (result: Awaited<ReturnType<typeof window.playground.getTestWallets>>) => {
      const active = result.signers.find(
        (signer) => signer.id === result.activeSignerId,
      );
      onSignerChangeRef.current(active?.address ?? null);
    },
    [],
  );

  const refresh = useCallback(
    async (notifyParent = false) => {
      setRefreshing(true);
      try {
        const result = await window.playground.getTestWallets();
        setSigners(result.signers);
        setActiveSignerId(result.activeSignerId);
        if (notifyParent) {
          notifyActiveSigner(result);
        }
      } catch (e: unknown) {
        const message =
          e instanceof Error ? e.message : "Failed to load wallets.";
        onLog("error", message);
      }
      setRefreshing(false);
      setLoading(false);
    },
    [notifyActiveSigner, onLog],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        await window.playground.ensureTestWallets();
        if (cancelled) return;
        const result = await window.playground.getTestWallets();
        if (cancelled) return;
        setSigners(result.signers);
        setActiveSignerId(result.activeSignerId);
        notifyActiveSigner(result);
      } catch (e: unknown) {
        if (!cancelled) {
          const message =
            e instanceof Error
              ? e.message
              : "Failed to provision test wallets.";
          onLog("warn", message);
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [notifyActiveSigner, onLog]);

  const handleSelect = async (signerId: string) => {
    if (signerId === activeSignerId) return;
    setSwitching(signerId);
    try {
      const result = await window.playground.setActiveSigner(
        signerId as PlaygroundSigner["id"],
      );
      setActiveSignerId(result.activeSignerId);
      onSignerChangeRef.current(result.address);
      const signer = signers.find((entry) => entry.id === signerId);
      onLog(
        "info",
        `Active wallet: ${signer?.label ?? signerId} (${result.address ?? "unknown"})`,
      );
      await refresh(false);
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Failed to switch wallet.";
      onLog("error", message);
    }
    setSwitching(null);
  };

  return (
    <div className="rounded-xl border border-[#2a2a3c] bg-[#1a1a26] overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 min-w-0">
          <Wallet size={14} className="text-[#c4c0ff] flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-[#f0f0f5]">
              Localnet wallets
            </p>
            <p className="text-[10px] text-[#8888a0] leading-relaxed">
              Beluga + 10 funded test wallets
            </p>
          </div>
        </div>
        <button
          onClick={() => void refresh(false)}
          disabled={refreshing || loading}
          title="Refresh balances"
          className="h-7 w-7 flex items-center justify-center rounded-lg border border-[#2a2a3c] text-[#8888a0] hover:text-[#f0f0f5] cursor-pointer disabled:opacity-50 bg-transparent"
        >
          <RefreshCw
            size={12}
            className={refreshing || loading ? "animate-spin" : ""}
          />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-6 text-[11px] text-[#8888a0]">
          <Loader2 size={14} className="animate-spin" />
          Provisioning test wallets…
        </div>
      ) : signers.length === 0 ? (
        <p className="px-3 py-4 text-[11px] text-[#8888a0]">
          No wallets available. Connect your Beluga wallet first.
        </p>
      ) : (
        <div className="max-h-[280px] overflow-y-auto divide-y divide-white/[0.04]">
          {signers.map((signer) => {
            const active = signer.id === activeSignerId;
            const busy = switching === signer.id;
            return (
              <button
                key={signer.id}
                onClick={() => void handleSelect(signer.id)}
                disabled={busy || switching != null}
                className={`w-full text-left px-3 py-2.5 flex items-start gap-2.5 transition-colors cursor-pointer border-none ${
                  active
                    ? "bg-[#6c63ff]/12"
                    : "bg-transparent hover:bg-white/[0.03]"
                } disabled:opacity-60`}
              >
                <span
                  className={`mt-1 w-3.5 h-3.5 rounded-full border flex-shrink-0 flex items-center justify-center ${
                    active
                      ? "border-[#c4c0ff] bg-[#c4c0ff]/20"
                      : "border-[#44445a]"
                  }`}
                >
                  {active && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#c4c0ff]" />
                  )}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2">
                    <span
                      className={`text-[12px] font-medium truncate ${
                        active ? "text-[#f0f0f5]" : "text-[#d8d8ea]"
                      }`}
                    >
                      {signer.label}
                    </span>
                    {signer.isBeluga && (
                      <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-md border border-[#6c63ff]/30 text-[#c4c0ff] bg-[#6c63ff]/10">
                        default
                      </span>
                    )}
                  </span>
                  <span className="block text-[10px] font-mono text-[#8888a0] mt-0.5 truncate">
                    {shortenAddress(signer.address)}
                  </span>
                  <span className="block text-[10px] text-[#a8b0c8] mt-0.5">
                    {signer.balanceSui != null
                      ? `${signer.balanceSui.toFixed(4)} SUI`
                      : "Balance unavailable"}
                  </span>
                </span>
                {busy && (
                  <Loader2
                    size={13}
                    className="animate-spin text-[#8888a0] flex-shrink-0 mt-0.5"
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}