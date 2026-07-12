import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, LayoutTemplate, Search, Sparkles } from "lucide-react";
import {
  AlertBanner,
  EmptyState,
  PrimaryButton,
  SearchField,
  SectionHeader,
  SkillCardSkeleton,
  StatusChip,
} from "./skills-ui";

interface CatalogEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  accent: string;
  source?: "builtin" | "walrus-official";
}

type TemplateFilter = "all" | "walrus" | "beluga";

export function TemplatesTab({
  onImported,
}: {
  onImported: (skillId: string) => void;
}) {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TemplateFilter>("all");
  const [importingId, setImportingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [templates, library] = await Promise.all([
        window.skills.listCatalog(),
        window.skills.list(),
      ]);
      setCatalog(templates);
      setOwnedIds(new Set(library.map((s) => s.id)));
    } catch (e: any) {
      setError(e.message || "Failed to load templates.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const stats = useMemo(() => {
    const walrus = catalog.filter((e) => e.source === "walrus-official");
    const beluga = catalog.filter((e) => e.source !== "walrus-official");
    return {
      total: catalog.length,
      walrus: walrus.length,
      beluga: beluga.length,
    };
  }, [catalog]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.filter((entry) => {
      if (filter === "walrus" && entry.source !== "walrus-official") return false;
      if (filter === "beluga" && entry.source === "walrus-official") return false;
      if (!q) return true;
      return (
        entry.name.toLowerCase().includes(q) ||
        entry.description.toLowerCase().includes(q) ||
        entry.category.toLowerCase().includes(q) ||
        entry.id.toLowerCase().includes(q)
      );
    });
  }, [catalog, search, filter]);

  const handleImport = async (catalogId: string) => {
    setImportingId(catalogId);
    setError(null);
    try {
      const imported = await window.skills.importFromCatalog(catalogId);
      await refresh();
      onImported(imported.id);
    } catch (e: any) {
      setError(e.message || "Failed to import template.");
    }
    setImportingId(null);
  };

  return (
    <div>
      <SectionHeader
        title="Skill templates"
        subtitle="Official Mysten Walrus skills plus Beluga templates. Import the ones you need into your library."
      />

      {error ? <AlertBanner tone="error">{error}</AlertBanner> : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(
          [
            ["all", "All", stats.total],
            ["walrus", "Walrus official", stats.walrus],
            ["beluga", "Beluga", stats.beluga],
          ] as const
        ).map(([id, label, count]) => {
          const active = filter === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`flex items-center gap-1.5 rounded-lg border cursor-pointer whitespace-nowrap px-2.5 py-1.5 text-[11px] font-medium ${
                active
                  ? "border-[#6c63ff]/35 bg-[#6c63ff]/10 text-[#b8b0ff]"
                  : "border-[#2a2a2a] bg-[#1e1e1e]/60 text-[#a8a8c0] hover:border-[#3a3a48]"
              }`}
            >
              {label}
              <span
                className={`text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-md ${
                  active ? "bg-[#6c63ff]/20" : "bg-[#262626] text-[#8888a0]"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mb-6 max-w-md">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Search templates..."
          icon={<Search size={14} />}
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkillCardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<LayoutTemplate size={24} />}
          title="No templates match"
          description="Try a different search term or filter."
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {filtered.map((entry, index) => {
            const owned = ownedIds.has(entry.id);
            const busy = importingId === entry.id;
            const isOfficial = entry.source === "walrus-official";

            return (
              <div
                key={entry.id}
                className="packages-card-in rounded-2xl border border-white/[0.08] bg-[#14141c]/70 p-5 transition-all duration-200 hover:border-white/[0.14] hover:bg-[#181824]/90"
                style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center border border-white/[0.06]"
                    style={{ background: `${entry.accent}18` }}
                  >
                    <Sparkles size={18} color={entry.accent} />
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    {isOfficial ? (
                      <StatusChip tone="info">Mysten</StatusChip>
                    ) : null}
                    <span
                      className="text-[10px] font-semibold uppercase tracking-[0.7px] px-2 py-1 rounded-full border border-white/[0.06] bg-white/[0.04]"
                      style={{ color: entry.accent }}
                    >
                      {entry.category}
                    </span>
                  </div>
                </div>

                <h3 className="text-[15px] font-semibold text-[#f2f2f8] mb-1.5">
                  {entry.name}
                </h3>
                <p className="text-[11px] font-mono text-[#55556a] mb-1.5 truncate">
                  {entry.id}
                </p>
                <p className="text-[12px] text-[#8888a0] leading-relaxed mb-4 min-h-[48px] line-clamp-3">
                  {entry.description}
                </p>

                <div className="flex items-center justify-between gap-2 pt-3 border-t border-white/[0.05]">
                  {owned ? (
                    <StatusChip tone="ok">In library</StatusChip>
                  ) : (
                    <StatusChip tone="neutral">Not imported</StatusChip>
                  )}
                  <PrimaryButton
                    tone={owned ? "ghost" : "blue"}
                    disabled={owned || busy}
                    loading={busy}
                    onClick={() => handleImport(entry.id)}
                  >
                    {!busy ? <Download size={14} className="flex-shrink-0" /> : null}
                    {busy ? "Importing..." : owned ? "Imported" : "Add to library"}
                  </PrimaryButton>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}