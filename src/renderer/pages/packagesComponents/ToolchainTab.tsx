import { useCallback, useEffect, useRef, useState } from "react";
import {
  usePackagesActivity,
  useToolchainProgress,
} from "../../context/PackagesActivityContext";
import {
  Download,
  RefreshCw,
  ExternalLink,
  Wrench,
  Code2,
  Terminal,
  ArrowRight,
  Circle,
  ArrowUpCircle,
  Trash2,
  Copy,
  Check,
  X,
  GitBranch,
} from "lucide-react";
import {
  AlertBanner,
  IconButton,
  PrimaryButton,
  ProgressBar,
  SectionHeader,
  StatusChip,
} from "./packages-ui";

type ToolchainStatus = Awaited<
  ReturnType<typeof window.packages.getToolchainStatus>
>;

type ToolchainAction = () => Promise<{
  success: boolean;
  message: string;
}>;

type ToolchainProgress = {
  job: string;
  phase: string;
  percent: number | null;
  message: string;
  detail?: string;
  recentLogs: string[];
};

const JOB_LABELS: Record<string, string> = {
  "ika-repo": "Cloning Ika repository",
  "ika-binary": "Building Ika CLI",
  "ika-sdk": "Installing Ika SDK",
};

const PHASE_LABELS: Record<string, string> = {
  starting: "Starting",
  downloading: "Downloading",
  compiling: "Compiling",
  linking: "Linking",
  packaging: "Packaging",
  extracting: "Extracting",
  running: "Running",
  done: "Done",
  error: "Error",
};

function formatProgressForCopy(progress: ToolchainProgress) {
  const header = `${JOB_LABELS[progress.job] ?? progress.job} — ${PHASE_LABELS[progress.phase] ?? progress.phase}${progress.percent != null ? ` (${progress.percent}%)` : ""}`;
  const parts = [
    header,
    progress.detail ? `Detail: ${progress.detail}` : null,
    progress.message ? `Message: ${progress.message}` : null,
    (progress.recentLogs?.length ?? 0) > 0
      ? `\n--- Logs ---\n${(progress.recentLogs ?? []).join("\n")}`
      : null,
  ].filter(Boolean);
  return parts.join("\n");
}

function CopyButton({
  text,
  label = "Copy",
}: {
  text: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? "Copied!" : `Copy ${label.toLowerCase()}`}
      className="h-7 px-2.5 flex items-center gap-1.5 rounded-lg border border-white/[0.08] text-[11px] text-[#8888a0] hover:text-[#f0f0f5] bg-white/[0.03] cursor-pointer flex-shrink-0 transition-all duration-200"
    >
      {copied ? <Check size={12} className="text-[#00d4aa]" /> : <Copy size={12} />}
      {copied ? "Copied" : label}
    </button>
  );
}

const RUNNING_PHASES = new Set([
  "starting",
  "downloading",
  "compiling",
  "linking",
  "packaging",
  "extracting",
  "running",
]);

function ToolchainProgressPanel({
  progress,
  onCancel,
  canCancel = false,
}: {
  progress: ToolchainProgress;
  onCancel?: () => void;
  canCancel?: boolean;
}) {
  const logRef = useRef<HTMLDivElement>(null);
  const copyText = formatProgressForCopy(progress);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [progress.recentLogs?.length]);

  const title = JOB_LABELS[progress.job] ?? progress.job;
  const phaseLabel = PHASE_LABELS[progress.phase] ?? progress.phase;
  const indeterminate = progress.percent == null;

  return (
    <div className="mb-6 rounded-2xl border border-[#00e5ff]/25 bg-gradient-to-br from-[#00e5ff]/[0.07] to-transparent p-5 packages-banner-in shadow-[0_12px_40px_rgba(0,229,255,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <p className="text-[14px] font-semibold text-[#f0f0f5]">{title}</p>
          <p className="text-[11px] text-[#8888a0] mt-0.5">
            {progress.detail ?? progress.message}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {canCancel && onCancel ? (
            <PrimaryButton tone="red" onClick={onCancel}>
              <X size={12} />
              Cancel
            </PrimaryButton>
          ) : null}
          <CopyButton text={copyText} label="Copy log" />
          <StatusChip
            tone={
              progress.phase === "error"
                ? "warn"
                : progress.phase === "done"
                  ? "ok"
                  : "info"
            }
          >
            {phaseLabel}
            {progress.percent != null ? ` · ${progress.percent}%` : ""}
          </StatusChip>
        </div>
      </div>

      <ProgressBar
        value={progress.percent ?? 0}
        indeterminate={indeterminate}
        gradient="from-[#00e5ff] to-[#4ca3ff]"
      />

      <p className="text-[11px] font-mono text-[#a8b0c8] mt-3 mb-2 break-all">
        {progress.message}
      </p>

      {(progress.recentLogs?.length ?? 0) > 0 ? (
        <div
          ref={logRef}
          className="max-h-44 overflow-y-auto rounded-xl bg-[#0c0c14]/90 border border-white/[0.06] p-3"
        >
          {(progress.recentLogs ?? []).map((line, index) => (
            <p
              key={`${index}-${line.slice(0, 24)}`}
              className="text-[10px] font-mono text-[#666688] leading-relaxed break-all"
            >
              {line}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const STEPS = [
  {
    id: "rust",
    title: "Rust toolchain",
    description: "Required for building Sui from source and many Move tools.",
    installKey: "rust",
    installLabel: "Install Rust",
    check: (s: ToolchainStatus) => s.rust.installed,
    version: (s: ToolchainStatus) => s.rust.version,
    action: () => window.packages.installRust(),
    update: () => window.packages.updateRust(),
    uninstall: () => window.packages.uninstallRust(),
    uninstallConfirm:
      "Uninstall Rust? This removes rustup and all installed toolchains.",
  },
  {
    id: "suiup",
    title: "suiup",
    description: "Official installer manager for Sui CLI and stack components.",
    installKey: "suiup",
    installLabel: "Install suiup",
    check: (s: ToolchainStatus) => s.suiup.installed,
    version: (s: ToolchainStatus) => s.suiup.version,
    action: () => window.packages.installSuiup(),
    update: () => window.packages.updateSuiup(),
    uninstall: () => window.packages.uninstallSuiup(),
    uninstallConfirm: "Uninstall suiup? Sui CLI installed via suiup may stop working.",
  },
  {
    id: "sui",
    title: "Sui CLI",
    description: "Compile Move packages, manage client config, run localnet.",
    installKey: "sui-suiup",
    installLabel: "Install via suiup",
    check: (s: ToolchainStatus) => s.sui.installed,
    version: (s: ToolchainStatus) => s.sui.version,
    action: () => window.packages.installSuiCli("suiup"),
    update: () => window.packages.updateSuiCli(),
    uninstall: () => window.packages.uninstallSuiCli(),
    uninstallConfirm: "Uninstall Sui CLI? Playground build and localnet will be unavailable.",
  },
] as const;

const IKA_STEPS = [
  {
    id: "git",
    title: "Git",
    description:
      "Required to clone and update the Ika repository from GitHub.",
    installKey: "git",
    installLabel: "Install Git",
    check: (s: ToolchainStatus) => s.ika.git.installed,
    version: (s: ToolchainStatus) => s.ika.git.version,
    action: () => {
      if (!window.packages.installGit) {
        return Promise.resolve({
          success: false,
          message:
            "This build is outdated. Rebuild Beluga from the latest source:\n\nnpm run make\n\nThen open out/Beluga-darwin-arm64/Beluga.app",
        });
      }
      return window.packages.installGit();
    },
    update: () => {
      if (!window.packages.updateGit) {
        return Promise.resolve({
          success: false,
          message:
            "This build is outdated. Rebuild Beluga from the latest source:\n\nnpm run make\n\nThen open out/Beluga-darwin-arm64/Beluga.app",
        });
      }
      return window.packages.updateGit();
    },
    uninstall: async () => ({
      success: false,
      message: "Git is a system tool — uninstall it outside Beluga.",
    }),
    uninstallConfirm: undefined,
  },
  {
    id: "ika-repo",
    title: "Ika repository",
    description:
      "Source tree used to build the Ika CLI and run Ika localnet.",
    installKey: "ika-repo",
    installLabel: "Clone repository",
    check: (s: ToolchainStatus) => s.ika.repo.installed,
    version: (s: ToolchainStatus) => s.ika.repo.version,
    action: () => window.packages.cloneIkaRepo(),
    update: () => window.packages.updateIkaRepo(),
    uninstall: () => window.packages.uninstallIkaRepo(),
    uninstallConfirm:
      "Remove the cloned Ika repository? You can clone it again later.",
  },
  {
    id: "ika-binary",
    title: "Ika CLI binary",
    description:
      typeof navigator !== "undefined" && /Win/i.test(navigator.userAgent)
        ? "Release build of ika.exe (cargo). First build downloads MystenLabs/sui — often 30–60 min on Windows; requires Visual Studio C++ Build Tools."
        : "Release build of the ika binary (cargo build). First build may take 10+ minutes.",
    installKey: "ika-binary",
    installLabel: "Build Ika CLI",
    check: (s: ToolchainStatus) => s.ika.binary.installed,
    version: (s: ToolchainStatus) => s.ika.binary.version,
    action: () => window.packages.buildIkaBinary(),
    update: () => window.packages.rebuildIkaBinary(),
    uninstall: () => window.packages.uninstallIkaBinary(),
    uninstallConfirm:
      "Remove Ika build artifacts? The repository clone will remain.",
  },
  {
    id: "ika-sdk",
    title: "Ika SDK",
    description:
      "TypeScript SDK (@ika.xyz/sdk) for dWallet flows in Ika Playground.",
    installKey: "ika-sdk",
    installLabel: "Install SDK",
    check: (s: ToolchainStatus) => s.ika.sdk.installed,
    version: (s: ToolchainStatus) => s.ika.sdk.version,
    action: () => window.packages.installIkaSdk(),
    update: () => window.packages.updateIkaSdk(),
    uninstall: () => window.packages.uninstallIkaSdk(),
    uninstallConfirm:
      "Remove @ika.xyz/sdk from Beluga dependencies? Ika Playground will be hidden.",
  },
] as const;

const ALL_STEPS = [...STEPS, ...IKA_STEPS];

function StepCard({
  index,
  isLast,
  title,
  description,
  installed,
  version,
  installing,
  updating,
  uninstalling,
  disabled,
  onInstall,
  onUpdate,
  onUninstall,
  installLabel,
  readOnly = false,
}: {
  index: number;
  isLast: boolean;
  title: string;
  description: string;
  installed: boolean;
  version: string | null;
  installing: boolean;
  updating: boolean;
  uninstalling: boolean;
  disabled: boolean;
  onInstall: () => void;
  onUpdate: () => void;
  onUninstall: () => void;
  installLabel: string;
  readOnly?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex w-7 flex-shrink-0 flex-col items-center self-stretch">
        <div
          className={`relative z-10 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold tabular-nums ${
            installed
              ? "border-[#00d4aa]/50 bg-[#00d4aa] text-[#081210]"
              : "border-white/[0.14] bg-[#0a0a0f] text-[#8888a0]"
          }`}
        >
          {installed ? <Check size={14} strokeWidth={2.75} /> : index}
        </div>
        {!isLast ? (
          <div
            className={`mt-1 w-px flex-1 min-h-[16px] rounded-full ${
              installed ? "bg-[#00d4aa]/45" : "bg-white/[0.1]"
            }`}
          />
        ) : null}
      </div>

      <div
        className={`mb-4 flex-1 min-w-0 rounded-2xl border p-5 transition-colors duration-200 ${
          installed
            ? "border-[#00d4aa]/22 bg-[#14141c]/80"
            : "border-white/[0.08] bg-[#14141c]/75 hover:border-white/[0.12]"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h3 className="text-[15px] font-semibold text-[#f2f2f8]">{title}</h3>
          {installed ? (
            <StatusChip tone="ok">{version ?? "installed"}</StatusChip>
          ) : null}
        </div>
        <p className="text-[12px] text-[#8888a0] leading-relaxed mb-4">
          {description}
        </p>

        {!installed ? (
          readOnly ? (
            <p className="text-[11px] text-[#ffb347]">
              Install Git on your system, then refresh status.
            </p>
          ) : (
            <PrimaryButton
              tone="blue"
              onClick={onInstall}
              disabled={disabled}
              loading={installing}
            >
              {!installing ? <Download size={14} /> : null}
              {installing ? "Installing..." : installLabel}
            </PrimaryButton>
          )
        ) : (
          <div className="flex flex-wrap gap-2">
            <PrimaryButton
              tone="blue"
              onClick={onUpdate}
              disabled={disabled}
              loading={updating}
            >
              {!updating ? <ArrowUpCircle size={14} /> : null}
              {updating ? "Updating..." : "Update"}
            </PrimaryButton>
            <PrimaryButton
              tone="red"
              onClick={onUninstall}
              disabled={disabled}
              loading={uninstalling}
            >
              {!uninstalling ? <Trash2 size={14} /> : null}
              {uninstalling ? "Removing..." : "Uninstall"}
            </PrimaryButton>
          </div>
        )}
      </div>
    </div>
  );
}

function StepSection({
  title,
  steps,
  status,
  busy,
  runAction,
  indexOffset,
}: {
  title: string;
  steps: typeof STEPS | typeof IKA_STEPS;
  status: ToolchainStatus | null;
  busy: string | null;
  runAction: (
    key: string,
    action: ToolchainAction,
    confirmMessage?: string,
  ) => void;
  indexOffset: number;
}) {
  return (
    <div className="mb-8">
      <p className="text-[11px] font-bold text-[#666688] uppercase tracking-[1.3px] mb-3">
        {title}
      </p>
      <div>
        {steps.map((step, index) => (
          <StepCard
            key={step.id}
            index={indexOffset + index + 1}
            isLast={index === steps.length - 1}
            title={step.title}
            description={step.description}
            installed={status ? step.check(status) : false}
            version={status ? step.version(status) : null}
            installing={busy === step.installKey}
            updating={busy === `${step.installKey}-update`}
            uninstalling={busy === `${step.installKey}-uninstall`}
            disabled={busy != null}
            installLabel={step.installLabel}
            readOnly={"readOnly" in step ? step.readOnly : false}
            onInstall={() => runAction(step.installKey, step.action)}
            onUpdate={() =>
              runAction(`${step.installKey}-update`, step.update)
            }
            onUninstall={() =>
              runAction(
                `${step.installKey}-uninstall`,
                step.uninstall,
                "uninstallConfirm" in step ? step.uninstallConfirm : undefined,
              )
            }
          />
        ))}
      </div>
    </div>
  );
}

export function ToolchainTab() {
  const { cancelJob } = usePackagesActivity();
  const toolchainProgress = useToolchainProgress();
  const [status, setStatus] = useState<ToolchainStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await window.packages.getToolchainStatus());
    } catch (e: any) {
      setError(e.message || "Failed to check toolchain.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const runAction = async (
    key: string,
    action: ToolchainAction,
    confirmMessage?: string,
  ) => {
    if (confirmMessage && !window.confirm(confirmMessage)) return;

    setBusy(key);
    setError(null);
    setMessage(null);

    try {
      const result = await action();
      if (!result.success) setError(result.message);
      else setMessage(result.message);
      await refresh();
    } catch (e: any) {
      setError(e.message || "Action failed.");
    }
    setBusy(null);
  };

  const showProgress =
    toolchainProgress &&
    (busy != null ||
      toolchainProgress.phase === "error" ||
      RUNNING_PHASES.has(toolchainProgress.phase));

  const readyCount = status
    ? ALL_STEPS.filter((step) => step.check(status)).length
    : 0;
  const ikaReady = status?.ika.ready ?? false;
  const progressPct = (readyCount / ALL_STEPS.length) * 100;

  return (
    <div className="max-w-3xl">
      <SectionHeader
        title="Development Toolchain"
        subtitle="Set up Rust, Sui CLI, and optionally Ika for Move Playground and dWallet localnet."
        action={
          <IconButton onClick={refresh} disabled={loading} title="Refresh status">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </IconButton>
        }
      />

      <div className="rounded-2xl border border-white/[0.08] bg-[#14141c]/80 backdrop-blur-sm p-5 mb-6 shadow-[0_12px_40px_rgba(0,0,0,0.22)]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <p className="text-[13px] font-medium text-[#e8e8f0]">Setup progress</p>
            <p className="text-[11px] text-[#666688] mt-0.5">
              Rust → Sui → Git → Ika repo → binary → SDK
            </p>
          </div>
          <div className="text-right">
            <p className="text-[22px] font-semibold text-[#4ca3ff] tabular-nums">
              {readyCount}
              <span className="text-[#55556a] text-[14px] font-normal">
                /{ALL_STEPS.length}
              </span>
            </p>
            <p className="text-[10px] text-[#666688] uppercase tracking-wide">
              components ready
            </p>
          </div>
        </div>

        <ProgressBar value={progressPct} />

        <div className="flex flex-wrap items-center gap-2 mt-4 text-[11px] text-[#55556a]">
          <Code2 size={12} className="text-[#4ca3ff]" />
          <ArrowRight size={10} />
          <Terminal size={12} className="text-[#00e5ff]" />
          <ArrowRight size={10} />
          <Wrench size={12} className="text-[#00d4aa]" />
          <ArrowRight size={10} />
          <GitBranch size={12} className="text-[#c4c0ff]" />
          {status?.platform ? (
            <StatusChip tone="neutral">{status.platform}</StatusChip>
          ) : null}
        </div>

        {ikaReady ? (
          <p className="mt-3 text-[12px] text-[#00e5ff] packages-banner-in">
            Ika toolchain ready — Ika Playground is available in Playground.
          </p>
        ) : null}
      </div>

      {message ? <AlertBanner tone="success">{message}</AlertBanner> : null}

      {error ? (
        <div className="mb-4 rounded-2xl border border-[#ff4d6d]/25 bg-[#ff4d6d]/[0.06] overflow-hidden packages-banner-in">
          <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-[#ff4d6d]/15">
            <span className="text-[11px] font-medium text-[#ff8fa3]">Error</span>
            <CopyButton text={error} label="Copy error" />
          </div>
          <div className="px-4 py-3 text-[13px] text-[#ff8fa3] whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">
            {error}
          </div>
        </div>
      ) : null}

      {showProgress && toolchainProgress ? (
        <ToolchainProgressPanel
          progress={toolchainProgress}
          canCancel={RUNNING_PHASES.has(toolchainProgress.phase)}
          onCancel={() => cancelJob(toolchainProgress.job)}
        />
      ) : null}

      <StepSection
        title="Sui toolchain"
        steps={STEPS}
        status={status}
        busy={busy}
        runAction={runAction}
        indexOffset={0}
      />

      <StepSection
        title="Ika toolchain"
        steps={IKA_STEPS}
        status={status}
        busy={busy}
        runAction={runAction}
        indexOffset={STEPS.length}
      />

      {status?.platform === "darwin" && !status.sui.installed ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#14141c]/70 p-4 mb-4">
          <p className="text-[12px] text-[#8888a0] mb-3">
            Alternative on macOS — install Sui via Homebrew:
          </p>
          <PrimaryButton
            tone="ghost"
            onClick={() =>
              runAction("sui-brew", () => window.packages.installSuiCli("brew"))
            }
            disabled={busy != null}
            loading={busy === "sui-brew"}
          >
            {!busy ? <Download size={14} /> : null}
            Install Sui (Homebrew)
          </PrimaryButton>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <a
          href="https://docs.sui.io/guides/developer/getting-started/sui-install"
          target="_blank"
          rel="noreferrer"
          className="h-9 px-4 rounded-xl text-[12px] border border-white/[0.08] text-[#8888a0] hover:text-[#f0f0f5] hover:bg-white/[0.04] no-underline flex items-center gap-2 transition-all duration-200"
        >
          <ExternalLink size={14} />
          Official Sui install guide
        </a>
        <a
          href="https://docs.ika.xyz/docs/sdk/setup-localnet"
          target="_blank"
          rel="noreferrer"
          className="h-9 px-4 rounded-xl text-[12px] border border-white/[0.08] text-[#8888a0] hover:text-[#f0f0f5] hover:bg-white/[0.04] no-underline flex items-center gap-2 transition-all duration-200"
        >
          <ExternalLink size={14} />
          Ika localnet setup
        </a>
      </div>

      <p className="mt-5 text-[11px] text-[#55556a] leading-relaxed flex items-start gap-2">
        <Circle size={8} className="flex-shrink-0 mt-1 text-[#444466]" />
        Installs may take several minutes. Refresh status after completion if tools
        are not detected immediately.
      </p>
    </div>
  );
}