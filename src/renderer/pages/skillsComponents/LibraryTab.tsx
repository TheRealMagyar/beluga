import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { SkillEditor, type SkillDraft } from "./SkillEditor";
import {
  CodePreview,
  EmptyState,
  LoadingSpinner,
  PrimaryButton,
  SearchField,
  SkillCardSkeleton,
  StatusChip,
} from "./skills-ui";

export interface SkillRecord {
  id: string;
  name: string;
  description: string;
  content: string;
  source: "builtin" | "custom";
  catalogId: string | null;
  createdAt: number;
  updatedAt: number;
}

const EMPTY_DRAFT: SkillDraft = {
  name: "",
  description: "",
  content: "",
};

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function LibraryTab({
  pendingSkillId,
  onPendingHandled,
}: {
  pendingSkillId: string | null;
  onPendingHandled: () => void;
}) {
  const [skills, setSkills] = useState<SkillRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [draft, setDraft] = useState<SkillDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setSkills(await window.skills.list());
    } catch (e: any) {
      setError(e.message || "Failed to load skills.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!pendingSkillId || loading) return;
    const skill = skills.find((s) => s.id === pendingSkillId);
    if (skill) {
      setSelectedId(skill.id);
      setIsNew(false);
      setEditing(true);
      setDraft({
        name: skill.name,
        description: skill.description,
        content: skill.content,
      });
      onPendingHandled();
    }
  }, [pendingSkillId, loading, skills, onPendingHandled]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return skills;
    return skills.filter(
      (skill) =>
        skill.name.toLowerCase().includes(q) ||
        skill.description.toLowerCase().includes(q) ||
        skill.id.toLowerCase().includes(q),
    );
  }, [skills, search]);

  const selectedSkill = skills.find((s) => s.id === selectedId) ?? null;

  const startCreate = () => {
    setSelectedId(null);
    setIsNew(true);
    setEditing(true);
    setDraft(EMPTY_DRAFT);
    setError(null);
  };

  const startEdit = (skill: SkillRecord) => {
    setSelectedId(skill.id);
    setIsNew(false);
    setEditing(true);
    setDraft({
      name: skill.name,
      description: skill.description,
      content: skill.content,
    });
    setError(null);
  };

  const cancelEdit = () => {
    setEditing(false);
    setIsNew(false);
    setDraft(EMPTY_DRAFT);
    setError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        const created = await window.skills.create(draft);
        setSelectedId(created.id);
        setIsNew(false);
      } else if (selectedId) {
        await window.skills.update(selectedId, draft);
      }
      await refresh();
      setEditing(false);
    } catch (e: any) {
      setError(e.message || "Failed to save skill.");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (
      !window.confirm(
        "Delete this skill? Projects linking it will keep the ID but agents won't find it.",
      )
    ) {
      return;
    }
    try {
      await window.skills.delete(id);
      if (selectedId === id) {
        setSelectedId(null);
        setEditing(false);
      }
      await refresh();
    } catch (e: any) {
      setError(e.message || "Failed to delete skill.");
    }
  };

  return (
    <div className="flex h-full min-h-0">
      <aside className="w-[280px] flex-shrink-0 border-r border-white/[0.06] flex flex-col min-h-0 bg-[#0e0e14]/40">
        <div className="flex-shrink-0 p-4 border-b border-white/[0.06] space-y-3">
          <div className="flex items-center justify-between gap-2">
            <StatusChip tone="neutral">
              {skills.length} skill{skills.length === 1 ? "" : "s"}
            </StatusChip>
            <PrimaryButton tone="blue" onClick={startCreate}>
              <Plus size={14} className="flex-shrink-0" />
              New
            </PrimaryButton>
          </div>
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Search skills..."
            icon={<Search size={14} />}
          />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <SkillCardSkeleton key={i} compact />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-[12px] text-[#8888a0] text-center py-10 px-3 leading-relaxed">
              {skills.length === 0
                ? "No skills yet. Create one or import a template."
                : "No skills match your search."}
            </p>
          ) : (
            filtered.map((skill) => {
              const isSelected = selectedId === skill.id;
              return (
                <div
                  key={skill.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setSelectedId(skill.id);
                    setEditing(false);
                    setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedId(skill.id);
                      setEditing(false);
                      setError(null);
                    }
                  }}
                  className={`w-full text-left rounded-xl border px-3 py-2.5 cursor-pointer group ${
                    isSelected
                      ? "border-[#4ca3ff]/40 bg-[#161622]/90"
                      : "border-white/[0.08] bg-[#14141c]/70 hover:border-white/[0.14] hover:bg-[#181824]/90"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-[#f2f2f8] truncate leading-snug">
                        {skill.name}
                      </div>
                      <div className="text-[11px] text-[#8888a0] truncate mt-0.5 leading-snug">
                        {skill.description}
                      </div>
                      <div className="text-[10px] text-[#55556a] mt-1 font-mono truncate">
                        {skill.id}
                      </div>
                    </div>
                    <button
                      type="button"
                      title="Delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(skill.id);
                      }}
                      className="h-7 w-7 flex-shrink-0 flex items-center justify-center rounded-lg border border-transparent text-[#666688] hover:text-[#ff8fa3] hover:border-[#ff4d6d]/25 hover:bg-[#ff4d6d]/10 cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      <div className="flex-1 min-w-0 min-h-0 overflow-y-auto px-8 py-6">
        {editing ? (
          <SkillEditor
            draft={draft}
            onChange={setDraft}
            onSave={handleSave}
            onCancel={cancelEdit}
            saving={saving}
            error={error}
            isNew={isNew}
          />
        ) : selectedSkill ? (
          <div className="max-w-3xl packages-panel-in">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
              <div className="min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-11 h-11 rounded-xl bg-[#4ca3ff]/12 border border-[#4ca3ff]/25 flex items-center justify-center">
                    <Sparkles size={20} className="text-[#4ca3ff]" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-[22px] font-semibold tracking-[-0.35px] text-[#f4f4fa] truncate">
                      {selectedSkill.name}
                    </h2>
                    <p className="text-[13px] text-[#8888a0] mt-0.5">
                      {selectedSkill.description}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <StatusChip tone="neutral">{selectedSkill.id}</StatusChip>
                  <StatusChip tone="info">
                    {selectedSkill.source === "builtin" ? "From template" : "Custom"}
                  </StatusChip>
                  <StatusChip tone="neutral">
                    Updated {formatDate(selectedSkill.updatedAt)}
                  </StatusChip>
                </div>
              </div>
              <PrimaryButton tone="blue" onClick={() => startEdit(selectedSkill)}>
                <Pencil size={14} className="flex-shrink-0" />
                Edit
              </PrimaryButton>
            </div>
            <CodePreview>{selectedSkill.content}</CodePreview>
          </div>
        ) : loading ? (
          <LoadingSpinner />
        ) : (
          <EmptyState
            icon={<Sparkles size={24} />}
            title="Select or create a skill"
            description="Skills teach AI agents how to work on your projects. Link them from the Projects manager after creating them here."
            action={
              <PrimaryButton tone="blue" onClick={startCreate}>
                <Plus size={14} className="flex-shrink-0" />
                Create skill
              </PrimaryButton>
            }
          />
        )}
      </div>
    </div>
  );
}