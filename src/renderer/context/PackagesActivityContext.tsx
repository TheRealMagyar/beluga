import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import { Loader2, X } from "lucide-react";

export type ToolchainProgress = {
  job: string;
  phase: string;
  percent: number | null;
  message: string;
  detail?: string;
  recentLogs: string[];
};

type CatalogJob = {
  id: string;
  action: "install" | "update" | "uninstall";
};

interface PackagesActivityContextValue {
  catalogJobs: CatalogJob[];
  registerCatalogJob: (id: string, action: CatalogJob["action"]) => void;
  clearCatalogJob: (id: string) => void;
  cancelJob: (jobId: string) => Promise<void>;
}

const PackagesActivityContext =
  createContext<PackagesActivityContextValue | null>(null);

const TOOLCHAIN_JOB_LABELS: Record<string, string> = {
  "ika-repo": "Cloning Ika repository",
  "ika-binary": "Building Ika CLI",
  "ika-sdk": "Installing Ika SDK",
};

const RUNNING_TOOLCHAIN_PHASES = new Set([
  "starting",
  "downloading",
  "compiling",
  "linking",
  "packaging",
  "extracting",
  "running",
]);

let toolchainProgressSnapshot: ToolchainProgress | null = null;
const toolchainProgressListeners = new Set<() => void>();

function emitToolchainProgress(event: ToolchainProgress | null) {
  toolchainProgressSnapshot = event;
  toolchainProgressListeners.forEach((listener) => listener());
}

function subscribeToolchainProgress(listener: () => void) {
  toolchainProgressListeners.add(listener);
  return () => toolchainProgressListeners.delete(listener);
}

export function useToolchainProgress() {
  return useSyncExternalStore(
    subscribeToolchainProgress,
    () => toolchainProgressSnapshot,
    () => toolchainProgressSnapshot,
  );
}

function catalogJobId(id: string) {
  return `catalog:${id}`;
}

export function PackagesActivityProvider({ children }: { children: ReactNode }) {
  const [catalogJobs, setCatalogJobs] = useState<CatalogJob[]>([]);

  useEffect(() => {
    const unsubscribe = window.packages.onToolchainProgress((event) => {
      const normalized: ToolchainProgress = {
        ...event,
        recentLogs: event.recentLogs ?? [],
      };
      emitToolchainProgress(normalized);
      if (event.phase === "done" || event.phase === "error") {
        window.setTimeout(() => {
          if (toolchainProgressSnapshot?.job === event.job) {
            emitToolchainProgress(null);
          }
        }, 2500);
      }
    });
    return unsubscribe;
  }, []);

  const registerCatalogJob = useCallback(
    (id: string, action: CatalogJob["action"]) => {
      setCatalogJobs((prev) => {
        if (prev.some((job) => job.id === id)) return prev;
        return [...prev, { id, action }];
      });
    },
    [],
  );

  const clearCatalogJob = useCallback((id: string) => {
    setCatalogJobs((prev) => prev.filter((job) => job.id !== id));
  }, []);

  const cancelJob = useCallback(async (jobId: string) => {
    await window.packages.cancelJob(jobId);
  }, []);

  const value = useMemo(
    () => ({
      catalogJobs,
      registerCatalogJob,
      clearCatalogJob,
      cancelJob,
    }),
    [catalogJobs, registerCatalogJob, clearCatalogJob, cancelJob],
  );

  return (
    <PackagesActivityContext.Provider value={value}>
      {children}
      <BackgroundTasksBar />
    </PackagesActivityContext.Provider>
  );
}

export function usePackagesActivity() {
  const context = useContext(PackagesActivityContext);
  if (!context) {
    throw new Error(
      "usePackagesActivity must be used within PackagesActivityProvider",
    );
  }
  return context;
}

function BackgroundTasksBar() {
  const location = useLocation();
  const { catalogJobs, cancelJob } = usePackagesActivity();
  const toolchainProgress = useToolchainProgress();

  const toolchainActive =
    toolchainProgress != null &&
    RUNNING_TOOLCHAIN_PHASES.has(toolchainProgress.phase);

  const hasBackgroundWork = catalogJobs.length > 0 || toolchainActive;

  if (!hasBackgroundWork || location.pathname === "/packages") {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] max-w-sm rounded-2xl border border-[#4ca3ff]/30 bg-[#12121a] shadow-2xl p-4"
      style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
    >
      <p className="text-[11px] font-bold uppercase tracking-[1px] text-[#8888a0] mb-2">
        Background tasks
      </p>
      <div className="space-y-2">
        {toolchainActive && toolchainProgress && (
          <TaskRow
            label={
              TOOLCHAIN_JOB_LABELS[toolchainProgress.job] ?? toolchainProgress.job
            }
            detail={toolchainProgress.detail ?? toolchainProgress.message}
            percent={toolchainProgress.percent}
            onCancel={() => cancelJob(toolchainProgress.job)}
          />
        )}
        {catalogJobs.map((job) => (
          <TaskRow
            key={job.id}
            label={`${job.action === "install" ? "Installing" : job.action === "update" ? "Updating" : "Removing"} ${job.id}`}
            detail="npm running in background"
            percent={null}
            onCancel={() => cancelJob(catalogJobId(job.id))}
          />
        ))}
      </div>
    </div>
  );
}

function TaskRow({
  label,
  detail,
  percent,
  onCancel,
}: {
  label: string;
  detail: string;
  percent: number | null;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-[#2a2a3c] bg-[#1e1e1e] px-3 py-2.5">
      <Loader2 size={14} className="text-[#4ca3ff] animate-spin flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-[#f0f0f5] truncate">{label}</p>
        <p className="text-[10px] text-[#8888a0] truncate">{detail}</p>
        {percent != null && (
          <div className="h-1 rounded-full bg-[#0d0d18] mt-1.5 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#4ca3ff] transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onCancel}
        title="Cancel"
        className="h-7 w-7 flex items-center justify-center rounded-lg border border-[#ff4d6d]/25 text-[#ff4d6d] bg-transparent cursor-pointer hover:bg-[#ff4d6d]/10 flex-shrink-0"
      >
        <X size={13} />
      </button>
    </div>
  );
}