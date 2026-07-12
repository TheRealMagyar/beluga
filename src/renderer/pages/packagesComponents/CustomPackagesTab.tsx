import { useCallback, useEffect, useMemo, useState } from "react";
import { usePackagesActivity } from "../../context/PackagesActivityContext";
import {
  Boxes,
  Download,
  Plus,
  RefreshCw,
  Trash2,
  Pencil,
  ArrowUpCircle,
  X,
  Package,
} from "lucide-react";
import {
  AlertBanner,
  IconButton,
  PackageCardSkeleton,
  PrimaryButton,
  SearchField,
  SectionHeader,
  StatusChip,
} from "./packages-ui";

type DepRow = { name: string; version: string };

interface CustomPackage {
  id: string;
  name: string;
  description: string;
  category: string;
  dependencies: Record<string, string>;
  devDependencies?: Record<string, string>;
  docsUrl: string;
  installCommand: string;
  accent: string;
  source: "custom";
  createdAt: number;
  updatedAt: number;
}

interface InstalledEntry {
  id: string;
  versions: Record<string, string>;
}

const EMPTY_FORM = {
  name: "",
  description: "",
  id: "",
  docsUrl: "",
  deps: [{ name: "", version: "latest" }] as DepRow[],
  devDeps: [] as DepRow[],
};

function rowsFromRecord(record?: Record<string, string>): DepRow[] {
  const entries = Object.entries(record ?? {});
  if (!entries.length) return [{ name: "", version: "latest" }];
  return entries.map(([name, version]) => ({ name, version }));
}

function recordFromRows(rows: DepRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of rows) {
    const name = row.name.trim();
    if (!name) continue;
    out[name] = row.version.trim() || "latest";
  }
  return out;
}

function versionSummary(versions: Record<string, string>) {
  const values = Object.entries(versions);
  if (!values.length) return "Installed";
  if (values.length === 1) return `v${values[0][1]}`;
  return values.map(([name, ver]) => `${name}@${ver}`).join(", ");
}

function DepEditor({
  title,
  rows,
  onChange,
}: {
  title: string;
  rows: DepRow[];
  onChange: (rows: DepRow[]) => void;
}) {
  return (
    <div className="mb-4">
      <p className="text-[11px] font-semibold text-[#8888a0] uppercase tracking-wider mb-2">
        {title}
      </p>
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={index} className="flex gap-2">
            <input
              value={row.name}
              onChange={(e) => {
                const next = [...rows];
                next[index] = { ...next[index], name: e.target.value };
                onChange(next);
              }}
              placeholder="package-name"
              className="flex-1 h-9 px-3 rounded-xl bg-[#12121a]/90 border border-white/[0.08] text-[12px] text-[#e8e8f0] outline-none focus:border-[#ff9f43]/40"
            />
            <input
              value={row.version}
              onChange={(e) => {
                const next = [...rows];
                next[index] = { ...next[index], version: e.target.value };
                onChange(next);
              }}
              placeholder="latest"
              className="w-28 h-9 px-3 rounded-xl bg-[#12121a]/90 border border-white/[0.08] text-[12px] text-[#e8e8f0] outline-none focus:border-[#ff9f43]/40"
            />
            <button
              type="button"
              onClick={() => onChange(rows.filter((_, i) => i !== index))}
              className="h-9 w-9 rounded-xl border border-white/[0.08] text-[#8888a0] hover:text-[#ff4d6d] cursor-pointer"
            >
              <X size={14} className="mx-auto" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...rows, { name: "", version: "latest" }])}
        className="mt-2 text-[12px] text-[#ff9f43] hover:text-[#ffb86c] cursor-pointer"
      >
        + Add dependency
      </button>
    </div>
  );
}

export function CustomPackagesTab() {
  const { registerCatalogJob, clearCatalogJob } = usePackagesActivity();
  const [packages, setPackages] = useState<CustomPackage[]>([]);
  const [installed, setInstalled] = useState<InstalledEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CustomPackage | "new" | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const installedMap = useMemo(
    () => new Map(installed.map((entry) => [entry.id, entry])),
    [installed],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [customRes, installedRes] = await Promise.all([
        window.packages.listCustomPackages(),
        window.packages.listInstalled(),
      ]);
      setPackages(customRes);
      setInstalled(installedRes);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load custom packages.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return packages;
    return packages.filter(
      (entry) =>
        entry.name.toLowerCase().includes(q) ||
        entry.description.toLowerCase().includes(q) ||
        entry.id.toLowerCase().includes(q) ||
        Object.keys(entry.dependencies).some((dep) =>
          dep.toLowerCase().includes(q),
        ),
    );
  }, [packages, search]);

  const openCreate = () => {
    setEditing("new");
    setForm(EMPTY_FORM);
    setError(null);
  };

  const openEdit = (entry: CustomPackage) => {
    setEditing(entry);
    setForm({
      name: entry.name,
      description: entry.description,
      id: entry.id,
      docsUrl: entry.docsUrl,
      deps: rowsFromRecord(entry.dependencies),
      devDeps: rowsFromRecord(entry.devDependencies),
    });
    setError(null);
  };

  const closeEditor = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const savePackage = async () => {
    setSaving(true);
    setError(null);
    try {
      const dependencies = recordFromRows(form.deps);
      const devDependencies = recordFromRows(form.devDeps);
      const payload = {
        name: form.name,
        description: form.description,
        dependencies,
        devDependencies,
        docsUrl: form.docsUrl,
      };

      if (editing === "new") {
        await window.packages.createCustomPackage({
          ...payload,
          id: form.id.trim() || undefined,
        });
      } else if (editing) {
        await window.packages.updateCustomPackage(editing.id, payload);
      }
      closeEditor();
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save custom package.");
    }
    setSaving(false);
  };

  const runAction = async (
    id: string,
    action: "install" | "update" | "uninstall" | "delete",
  ) => {
    if (action === "delete") {
      if (!window.confirm(`Delete custom package "${id}"?`)) return;
    }

    setBusyId(id);
    setError(null);
    if (action !== "delete") registerCatalogJob(id, action);

    try {
      if (action === "install") await window.packages.install(id);
      if (action === "update") await window.packages.update(id);
      if (action === "uninstall") await window.packages.uninstall(id);
      if (action === "delete") await window.packages.deleteCustomPackage(id);
      await refresh();
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : `Failed to ${action} custom package.`,
      );
    } finally {
      if (action !== "delete") clearCatalogJob(id);
      setBusyId(null);
    }
  };

  if (editing) {
    return (
      <div className="max-w-2xl">
        <SectionHeader
          title={editing === "new" ? "New custom package" : "Edit custom package"}
          subtitle="Bundle multiple npm packages into one installable unit for projects and AI agents."
        />

        {error ? <AlertBanner tone="error">{error}</AlertBanner> : null}

        <div className="rounded-2xl border border-white/[0.08] bg-[#14141c]/80 p-5 mb-4">
          <label className="block text-[11px] font-semibold text-[#8888a0] uppercase tracking-wider mb-1.5">
            Display name
          </label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full h-10 px-3 rounded-xl bg-[#12121a]/90 border border-white/[0.08] text-[13px] text-[#e8e8f0] outline-none focus:border-[#ff9f43]/40 mb-4"
            placeholder="My Sui Stack"
          />

          {editing === "new" ? (
            <>
              <label className="block text-[11px] font-semibold text-[#8888a0] uppercase tracking-wider mb-1.5">
                Id (optional)
              </label>
              <input
                value={form.id}
                onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
                className="w-full h-10 px-3 rounded-xl bg-[#12121a]/90 border border-white/[0.08] text-[13px] font-mono text-[#e8e8f0] outline-none focus:border-[#ff9f43]/40 mb-4"
                placeholder="my-sui-stack"
              />
            </>
          ) : null}

          <label className="block text-[11px] font-semibold text-[#8888a0] uppercase tracking-wider mb-1.5">
            Description
          </label>
          <textarea
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            rows={3}
            className="w-full px-3 py-2 rounded-xl bg-[#12121a]/90 border border-white/[0.08] text-[13px] text-[#e8e8f0] outline-none focus:border-[#ff9f43]/40 mb-4 resize-y"
            placeholder="What this bundle is for..."
          />

          <DepEditor
            title="Dependencies"
            rows={form.deps}
            onChange={(deps) => setForm((f) => ({ ...f, deps }))}
          />

          <DepEditor
            title="Dev dependencies (optional)"
            rows={
              form.devDeps.length
                ? form.devDeps
                : [{ name: "", version: "latest" }]
            }
            onChange={(devDeps) => setForm((f) => ({ ...f, devDeps }))}
          />
        </div>

        <div className="flex gap-2">
          <PrimaryButton tone="blue" onClick={savePackage} loading={saving}>
            {saving ? "Saving..." : "Save package"}
          </PrimaryButton>
          <PrimaryButton tone="ghost" onClick={closeEditor} disabled={saving}>
            Cancel
          </PrimaryButton>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        title="Custom Packages"
        subtitle="Create bundles of npm packages. Install them here, link to projects, or let AI agents add them via MCP."
        action={
          <div className="flex gap-2">
            <IconButton onClick={refresh} disabled={loading} title="Refresh">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </IconButton>
            {packages.length > 0 ? (
              <PrimaryButton tone="blue" onClick={openCreate}>
                <Plus size={14} />
                New package
              </PrimaryButton>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2.5 mb-5">
        <StatusChip tone="neutral" icon={<Boxes size={12} />}>
          {packages.length} custom bundle{packages.length === 1 ? "" : "s"}
        </StatusChip>
      </div>

      {error ? <AlertBanner tone="error">{error}</AlertBanner> : null}

      {packages.length > 0 ? (
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Search custom packages..."
          icon={<Package size={14} />}
        />
      ) : null}

      <div className={packages.length > 0 ? "mt-6" : ""}>
        {loading ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(268px,1fr))] gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <PackageCardSkeleton key={i} />
            ))}
          </div>
        ) : packages.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center border border-dashed border-white/[0.1] rounded-3xl py-20 px-6">
            <div className="w-14 h-14 mb-4 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-[#444466]">
              <Boxes size={28} />
            </div>
            <p className="text-[15px] font-semibold text-[#e8e8f0] mb-2">
              No custom packages yet
            </p>
            <p className="text-[13px] text-[#8888a0] leading-relaxed max-w-sm mb-5">
              Bundle multiple npm dependencies into one installable unit for
              projects and AI agents.
            </p>
            <PrimaryButton tone="blue" onClick={openCreate}>
              <Plus size={14} />
              Create your first bundle
            </PrimaryButton>
          </div>
        ) : filtered.length === 0 ? (
          <div className="border border-dashed border-white/[0.1] rounded-3xl py-20 text-center">
            <Package size={36} className="mx-auto mb-3 text-[#333348]" />
            <p className="text-[14px] text-[#8888a0]">
              No packages match your search.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(268px,1fr))] gap-4">
            {filtered.map((entry) => {
              const info = installedMap.get(entry.id);
              const isBusy = busyId === entry.id;
              const depCount =
                Object.keys(entry.dependencies).length +
                Object.keys(entry.devDependencies ?? {}).length;

              return (
                <div
                  key={entry.id}
                  className="rounded-2xl border border-[#ff9f43]/20 bg-[#14141c]/70 p-5"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center border border-white/[0.06]"
                      style={{ background: `${entry.accent}18` }}
                    >
                      <Boxes size={18} color={entry.accent} />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.7px] px-2 py-1 rounded-full bg-[#ff9f43]/10 text-[#ffb86c] border border-[#ff9f43]/25">
                      Custom
                    </span>
                  </div>

                  <h3 className="text-[15px] font-semibold text-[#f2f2f8] mb-1">
                    {entry.name}
                  </h3>
                  <p className="text-[11px] font-mono text-[#666688] mb-2">
                    {entry.id}
                  </p>
                  <p className="text-[12px] text-[#8888a0] leading-relaxed mb-3 line-clamp-2">
                    {entry.description}
                  </p>
                  <p className="text-[11px] text-[#55556a] mb-4">
                    {depCount} npm package{depCount === 1 ? "" : "s"}
                  </p>

                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-white/[0.05]">
                    <span
                      className={`text-[11px] font-mono truncate ${
                        info ? "text-[#00d4aa]" : "text-[#55556a]"
                      }`}
                    >
                      {info ? versionSummary(info.versions) : "Not installed"}
                    </span>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <PrimaryButton
                        tone="ghost"
                        size="icon"
                        title="Edit"
                        onClick={() => openEdit(entry)}
                      >
                        <Pencil size={12} />
                      </PrimaryButton>
                      {!info ? (
                        <PrimaryButton
                          tone="blue"
                          size="icon"
                          title="Install"
                          loading={isBusy}
                          onClick={() => runAction(entry.id, "install")}
                        >
                          <Download size={12} />
                        </PrimaryButton>
                      ) : (
                        <PrimaryButton
                          tone="blue"
                          size="icon"
                          title="Update"
                          loading={isBusy}
                          onClick={() => runAction(entry.id, "update")}
                        >
                          <ArrowUpCircle size={12} />
                        </PrimaryButton>
                      )}
                      <PrimaryButton
                        tone="red"
                        size="icon"
                        title="Delete bundle"
                        onClick={() => runAction(entry.id, "delete")}
                      >
                        <Trash2 size={12} />
                      </PrimaryButton>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}