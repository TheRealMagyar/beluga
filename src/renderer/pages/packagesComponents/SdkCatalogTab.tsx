import { useCallback, useEffect, useMemo, useState } from "react";
import { usePackagesActivity } from "../../context/PackagesActivityContext";
import {
  Package,
  Download,
  RefreshCw,
  Trash2,
  ExternalLink,
  Search,
  CheckCircle2,
  Terminal,
  X,
  Sparkles,
} from "lucide-react";
import {
  AlertBanner,
  CategoryPill,
  IconButton,
  PackageCardSkeleton,
  PrimaryButton,
  SearchField,
  SectionHeader,
  StatusChip,
} from "./packages-ui";

type PackageCategory =
  | "all"
  | "core"
  | "wallet"
  | "storage"
  | "payments"
  | "tooling";

interface CatalogEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  dependencies: Record<string, string>;
  devDependencies?: Record<string, string>;
  docsUrl: string;
  installCommand: string;
  accent: string;
  source?: "builtin" | "custom";
}

interface InstalledEntry {
  id: string;
  installedAt: number;
  updatedAt: number;
  versions: Record<string, string>;
  path: string;
}

const CATEGORY_LABELS: Record<Exclude<PackageCategory, "all">, string> = {
  core: "Core",
  wallet: "Wallet",
  storage: "Storage",
  payments: "Payments",
  tooling: "Tooling",
};

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function versionSummary(versions: Record<string, string>) {
  const values = Object.entries(versions);
  if (!values.length) return "Installed";
  if (values.length === 1) return `v${values[0][1]}`;
  return values.map(([name, ver]) => `${name}@${ver}`).join(", ");
}

export function SdkCatalogTab() {
  const { registerCatalogJob, clearCatalogJob, cancelJob } =
    usePackagesActivity();
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [installed, setInstalled] = useState<InstalledEntry[]>([]);
  const [npmStatus, setNpmStatus] = useState<{
    installed: boolean;
    version: string | null;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<PackageCategory>("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const installedMap = useMemo(
    () => new Map(installed.map((entry) => [entry.id, entry])),
    [installed],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [catalogRes, installedRes, npmRes] = await Promise.all([
        window.packages.listCatalog(),
        window.packages.listInstalled(),
        window.packages.checkNpm(),
      ]);
      setCatalog(catalogRes);
      setInstalled(installedRes);
      setNpmStatus(npmRes);
    } catch (e: any) {
      setActionError(e.message || "Failed to load packages.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.filter((entry) => {
      if (category !== "all" && entry.category !== category) return false;
      if (!q) return true;
      return (
        entry.name.toLowerCase().includes(q) ||
        entry.description.toLowerCase().includes(q) ||
        entry.installCommand.toLowerCase().includes(q) ||
        Object.keys(entry.dependencies).some((dep) =>
          dep.toLowerCase().includes(q),
        )
      );
    });
  }, [catalog, search, category]);

  const selected = catalog.find((entry) => entry.id === selectedId) ?? null;
  const selectedInstalled = selected ? installedMap.get(selected.id) : null;

  const runAction = async (
    id: string,
    action: "install" | "update" | "uninstall",
  ) => {
    setBusyId(id);
    setActionError(null);
    registerCatalogJob(id, action);
    try {
      if (action === "install") await window.packages.install(id);
      if (action === "update") await window.packages.update(id);
      if (action === "uninstall") await window.packages.uninstall(id);
      await refresh();
    } catch (e: any) {
      setActionError(e.message || `Failed to ${action} package.`);
    } finally {
      clearCatalogJob(id);
      setBusyId(null);
    }
  };

  const cancelCatalogAction = (id: string) => {
    cancelJob(`catalog:${id}`);
  };

  return (
    <div className="flex flex-col xl:flex-row gap-7 h-full min-h-0">
      <div className="flex-1 min-w-0">
        <SectionHeader
          title="SDK Catalog"
          subtitle="Install and cache Sui ecosystem packages locally, then link them to projects."
          action={
            <IconButton onClick={refresh} disabled={loading} title="Refresh">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </IconButton>
          }
        />

        <div className="flex flex-wrap items-center gap-2.5 mb-5">
          <StatusChip
            tone={npmStatus?.installed ? "ok" : "warn"}
            icon={
              npmStatus?.installed ? (
                <CheckCircle2 size={12} />
              ) : (
                <Sparkles size={12} />
              )
            }
          >
            {npmStatus?.installed
              ? `npm ${npmStatus.version}`
              : "npm not installed"}
          </StatusChip>
          <StatusChip tone="neutral">
            {installed.length} installed · {catalog.length} available
          </StatusChip>
        </div>

        {actionError ? (
          <AlertBanner tone="error">{actionError}</AlertBanner>
        ) : null}

        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 mb-6">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Search packages, dependencies..."
            icon={<Search size={14} />}
          />
          <div className="flex flex-wrap gap-2">
            {(
              [
                "all",
                "core",
                "wallet",
                "storage",
                "payments",
                "tooling",
              ] as PackageCategory[]
            ).map((cat) => (
              <CategoryPill
                key={cat}
                active={category === cat}
                onClick={() => setCategory(cat)}
              >
                {cat === "all" ? "All" : CATEGORY_LABELS[cat]}
              </CategoryPill>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(268px,1fr))] gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <PackageCardSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="border border-dashed border-white/[0.1] rounded-3xl py-20 text-center">
            <Package size={36} className="mx-auto mb-3 text-[#333348]" />
            <p className="text-[14px] text-[#8888a0]">No packages match your search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(268px,1fr))] gap-4">
            {filtered.map((entry, index) => {
              const info = installedMap.get(entry.id);
              const isBusy = busyId === entry.id;
              const isSelected = selectedId === entry.id;

              return (
                <div
                  key={entry.id}
                  onClick={() => setSelectedId(entry.id)}
                  className={`packages-card-in rounded-2xl border p-5 cursor-pointer transition-all duration-200 ease-out ${
                    isSelected
                      ? "border-[#4ca3ff]/40 bg-[#161622]/90"
                      : "border-white/[0.08] bg-[#14141c]/70 hover:border-white/[0.14] hover:bg-[#181824]/90"
                  }`}
                  style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center border border-white/[0.06]"
                      style={{ background: `${entry.accent}18` }}
                    >
                      <Package size={18} color={entry.accent} />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.7px] px-2 py-1 rounded-full bg-white/[0.05] text-[#8888a0] border border-white/[0.06]">
                      {entry.source === "custom"
                        ? "Custom"
                        : CATEGORY_LABELS[
                            entry.category as keyof typeof CATEGORY_LABELS
                          ] ?? entry.category}
                    </span>
                  </div>

                  <h3 className="text-[15px] font-semibold text-[#f2f2f8] mb-1.5">
                    {entry.name}
                  </h3>
                  <p className="text-[12px] text-[#8888a0] leading-relaxed mb-4 min-h-[40px] line-clamp-3">
                    {entry.description}
                  </p>

                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-white/[0.05]">
                    <span
                      className={`min-w-0 truncate text-[11px] font-mono ${
                        info ? "text-[#00d4aa]" : "text-[#55556a]"
                      }`}
                    >
                      {info ? versionSummary(info.versions) : "Not installed"}
                    </span>
                    <div
                      className="flex flex-shrink-0 gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {!info ? (
                        isBusy ? (
                          <PrimaryButton
                            tone="red"
                            onClick={() => cancelCatalogAction(entry.id)}
                          >
                            <X size={12} />
                            Cancel
                          </PrimaryButton>
                        ) : (
                          <PrimaryButton
                            tone="blue"
                            disabled={!npmStatus?.installed}
                            onClick={() => runAction(entry.id, "install")}
                          >
                            Install
                          </PrimaryButton>
                        )
                      ) : (
                        <>
                          {isBusy ? (
                            <PrimaryButton
                              tone="red"
                              size="icon"
                              title="Cancel"
                              onClick={() => cancelCatalogAction(entry.id)}
                            >
                              <X size={13} className="flex-shrink-0" />
                            </PrimaryButton>
                          ) : (
                            <PrimaryButton
                              tone="ghost"
                              size="icon"
                              title="Update"
                              onClick={() => runAction(entry.id, "update")}
                            >
                              <RefreshCw size={14} className="flex-shrink-0" />
                            </PrimaryButton>
                          )}
                          <PrimaryButton
                            tone="red"
                            size="icon"
                            title="Uninstall"
                            disabled={isBusy}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Remove ${entry.name} from local cache?`,
                                )
                              ) {
                                runAction(entry.id, "uninstall");
                              }
                            }}
                          >
                            <Trash2 size={14} className="flex-shrink-0" />
                          </PrimaryButton>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <aside className="w-full xl:w-[320px] flex-shrink-0">
        <div className="xl:sticky xl:top-0 rounded-2xl border border-white/[0.08] bg-[#14141c]/85 backdrop-blur-sm overflow-hidden shadow-[0_16px_48px_rgba(0,0,0,0.28)]">
          {!selected ? (
            <div className="text-center py-16 px-6">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                <Package size={24} className="text-[#444466]" />
              </div>
              <p className="text-[13px] text-[#8888a0] leading-relaxed">
                Select a package to view install commands, dependencies, and
                actions.
              </p>
            </div>
          ) : (
            <div className="packages-panel-in p-5">
                <div className="flex items-start gap-3 mb-4">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center border border-white/[0.06] flex-shrink-0"
                    style={{ background: `${selected.accent}18` }}
                  >
                    <Package size={20} color={selected.accent} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-[17px] font-semibold text-[#f4f4fa] mb-1 truncate">
                      {selected.name}
                    </h2>
                    <p className="text-[12px] text-[#8888a0] leading-relaxed">
                      {selected.description}
                    </p>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-[1.1px] text-[#666688] mb-2">
                    Install command
                  </p>
                  <div className="rounded-xl border border-white/[0.08] bg-[#0c0c14] p-3">
                    <code className="text-[11px] font-mono text-[#a8d8ff] break-all leading-relaxed">
                      {selected.installCommand}
                    </code>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-[1.1px] text-[#666688] mb-2">
                    Dependencies
                  </p>
                  <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-0.5">
                    {[
                      ...Object.keys(selected.dependencies),
                      ...Object.keys(selected.devDependencies ?? {}),
                    ].map((dep) => (
                      <div
                        key={dep}
                        className="text-[11px] font-mono text-[#a8b0c8] px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.04]"
                      >
                        {dep}
                        {selected.devDependencies?.[dep] ? " (dev)" : ""}
                        {selectedInstalled?.versions[dep]
                          ? ` · v${selectedInstalled.versions[dep]}`
                          : ""}
                      </div>
                    ))}
                  </div>
                </div>

                {selectedInstalled ? (
                  <div className="mb-4 flex flex-wrap gap-2">
                    <StatusChip tone="ok">Installed {formatDate(selectedInstalled.installedAt)}</StatusChip>
                    <StatusChip tone="neutral">Updated {formatDate(selectedInstalled.updatedAt)}</StatusChip>
                  </div>
                ) : null}

                <div className="flex flex-col gap-2">
                  {!selectedInstalled ? (
                    busyId === selected.id ? (
                      <PrimaryButton
                        tone="red"
                        className="w-full"
                        onClick={() => cancelCatalogAction(selected.id)}
                      >
                        <X size={14} />
                        Cancel install
                      </PrimaryButton>
                    ) : (
                      <PrimaryButton
                        tone="blue"
                        className="w-full"
                        disabled={!npmStatus?.installed}
                        onClick={() => runAction(selected.id, "install")}
                      >
                        <Download size={14} />
                        Install
                      </PrimaryButton>
                    )
                  ) : (
                    <>
                      {busyId === selected.id ? (
                        <PrimaryButton
                          tone="red"
                          className="w-full"
                          onClick={() => cancelCatalogAction(selected.id)}
                        >
                          <X size={14} />
                          Cancel update
                        </PrimaryButton>
                      ) : (
                        <PrimaryButton
                          tone="green"
                          className="w-full"
                          onClick={() => runAction(selected.id, "update")}
                        >
                          <RefreshCw size={14} />
                          Update
                        </PrimaryButton>
                      )}
                      <PrimaryButton
                        tone="red"
                        className="w-full"
                        disabled={busyId === selected.id}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Remove ${selected.name} from local cache?`,
                            )
                          ) {
                            runAction(selected.id, "uninstall");
                          }
                        }}
                      >
                        <Trash2 size={14} />
                        Uninstall
                      </PrimaryButton>
                    </>
                  )}
                  <a
                    href={selected.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full h-10 flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] text-[#8888a0] hover:text-[#f0f0f5] hover:bg-white/[0.04] text-[13px] no-underline transition-all duration-200"
                  >
                    <ExternalLink size={14} />
                    Documentation
                  </a>
                </div>

                <div className="mt-4 flex items-start gap-2 text-[11px] text-[#55556a] leading-relaxed">
                  <Terminal size={13} className="flex-shrink-0 mt-0.5" />
                  Link installed packages to projects from the Projects page.
                </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}