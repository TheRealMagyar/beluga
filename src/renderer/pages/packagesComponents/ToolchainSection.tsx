import { useCallback, useEffect, useState } from "react";
import {
  Download,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Wrench,
} from "lucide-react";

type ToolchainStatus = Awaited<
  ReturnType<typeof window.packages.getToolchainStatus>
>;

function StatusPill({
  label,
  installed,
  version,
}: {
  label: string;
  installed: boolean;
  version: string | null;
}) {
  return (
    <div
      className={`flex items-center gap-2 text-[12px] px-3 py-2 rounded-xl border ${
        installed
          ? "border-[#00d4aa]/30 text-[#00d4aa] bg-[#00d4aa]/10"
          : "border-[#ffb347]/30 text-[#ffb347] bg-[#ffb347]/10"
      }`}
    >
      {installed ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
      <span className="font-medium">{label}</span>
      <span className="text-[#8888a0] font-mono">
        {installed ? version ?? "installed" : "not installed"}
      </span>
    </div>
  );
}

export function ToolchainSection() {
  const [status, setStatus] = useState<ToolchainStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await window.packages.getToolchainStatus();
      setStatus(next);
    } catch (e: any) {
      setError(e.message || "Failed to check toolchain.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const runInstall = async (
    key: string,
    action: () => Promise<{ success: boolean; message: string }>,
  ) => {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      const result = await action();
      if (!result.success) {
        setError(result.message);
      } else {
        setMessage(result.message);
      }
      await refresh();
    } catch (e: any) {
      setError(e.message || "Install failed.");
    }
    setBusy(null);
  };

  return (
    <section className="mb-8 rounded-[18px] border border-[#2a2a3c] bg-[#12121a] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Wrench size={16} className="text-[#4ca3ff]" />
            <h2 className="text-[17px] font-semibold">Development Toolchain</h2>
          </div>
          <p className="text-[13px] text-[#8888a0] max-w-2xl leading-relaxed">
            Install Rust and the Sui CLI to build Move packages in Playground and
            run a local network. Recommended install path: Rust → suiup → Sui CLI.
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-2 h-9 px-3 rounded-xl border border-[#2a2a3c] bg-[#1e1e1e] text-[12px] text-[#8888a0] hover:text-[#f0f0f5] cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <StatusPill
          label="Rust"
          installed={status?.rust.installed ?? false}
          version={status?.rust.version}
        />
        <StatusPill
          label="Cargo"
          installed={status?.cargo.installed ?? false}
          version={status?.cargo.version}
        />
        <StatusPill
          label="suiup"
          installed={status?.suiup.installed ?? false}
          version={status?.suiup.version}
        />
        <StatusPill
          label="Sui CLI"
          installed={status?.sui.installed ?? false}
          version={status?.sui.version}
        />
      </div>

      {message && (
        <div className="mb-3 px-4 py-2.5 rounded-xl border border-[#00d4aa]/25 bg-[#00d4aa]/10 text-[13px] text-[#00d4aa]">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-3 px-4 py-2.5 rounded-xl border border-[#ff4d6d]/25 bg-[#ff4d6d]/10 text-[13px] text-[#ff4d6d] whitespace-pre-wrap">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() =>
            runInstall("rust", () => window.packages.installRust())
          }
          disabled={busy != null || status?.rust.installed}
          className="h-9 px-4 rounded-xl text-[12px] font-medium border border-[#4ca3ff]/30 bg-[#4ca3ff]/10 text-[#4ca3ff] cursor-pointer disabled:opacity-50 flex items-center gap-2"
        >
          {busy === "rust" ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Download size={14} />
          )}
          Install Rust
        </button>
        <button
          onClick={() =>
            runInstall("suiup", () => window.packages.installSuiup())
          }
          disabled={busy != null || status?.suiup.installed}
          className="h-9 px-4 rounded-xl text-[12px] font-medium border border-[#6c63ff]/30 bg-[#6c63ff]/10 text-[#c4c0ff] cursor-pointer disabled:opacity-50 flex items-center gap-2"
        >
          {busy === "suiup" ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Download size={14} />
          )}
          Install suiup
        </button>
        <button
          onClick={() =>
            runInstall("sui-suiup", () =>
              window.packages.installSuiCli("suiup"),
            )
          }
          disabled={busy != null || status?.sui.installed}
          className="h-9 px-4 rounded-xl text-[12px] font-medium border border-[#00d4aa]/30 bg-[#00d4aa]/10 text-[#00d4aa] cursor-pointer disabled:opacity-50 flex items-center gap-2"
        >
          {busy === "sui-suiup" ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Download size={14} />
          )}
          Install Sui (suiup)
        </button>
        {status?.platform === "darwin" && (
          <button
            onClick={() =>
              runInstall("sui-brew", () =>
                window.packages.installSuiCli("brew"),
              )
            }
            disabled={busy != null || status?.sui.installed}
            className="h-9 px-4 rounded-xl text-[12px] font-medium border border-[#2a2a3c] bg-[#1e1e1e] text-[#8888a0] hover:text-[#f0f0f5] cursor-pointer disabled:opacity-50 flex items-center gap-2"
          >
            {busy === "sui-brew" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            Install Sui (Homebrew)
          </button>
        )}
        <a
          href="https://docs.sui.io/guides/developer/getting-started/sui-install"
          target="_blank"
          rel="noreferrer"
          className="h-9 px-4 rounded-xl text-[12px] border border-[#2a2a3c] text-[#8888a0] hover:text-[#f0f0f5] no-underline flex items-center gap-2"
        >
          <ExternalLink size={14} />
          Sui install docs
        </a>
      </div>

      <p className="mt-3 text-[11px] text-[#55556a] leading-relaxed">
        Installs run in the background and may take several minutes (especially
        the first Sui build). Restart Beluga or refresh after install if the CLI
        is not detected immediately.
      </p>
    </section>
  );
}