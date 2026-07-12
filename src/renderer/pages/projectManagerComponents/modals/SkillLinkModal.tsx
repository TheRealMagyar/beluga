import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ModalWrapper } from "../ui";
import { SearchField } from "../projects-ui";
import {
  getLinkedSkillIds,
  saveLinkedSkillIds,
} from "../utils/beluga";

interface SkillSummary {
  id: string;
  name: string;
  description: string;
  source: "builtin" | "custom";
}

export function SkillLinkModal({
  projectPath,
  projectName,
  onClose,
  onSaved,
}: {
  projectPath: string;
  projectName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [library, linked] = await Promise.all([
        window.skills.list(),
        getLinkedSkillIds(projectPath),
      ]);
      setSkills(library);
      setSelected(linked);
      setLoaded(true);
    })();
  }, [projectPath]);

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

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveLinkedSkillIds(projectPath, selected, projectName);
      onSaved();
    } catch (e: any) {
      setError(e.message || "Failed to save skills.");
    }
    setSaving(false);
  };

  return (
    <ModalWrapper onClose={onClose}>
      <div className="text-lg font-bold mb-1">✨ Link skills</div>
      <div className="text-[13px] text-[#8888a0] mb-4">
        Agent skills linked to{" "}
        <span className="font-mono text-[#4ca3ff]">{projectName}</span>. MCP
        agents receive these instructions when opening the project via{" "}
        <span className="font-mono">project_open</span>.
      </div>

      {!loaded ? (
        <div className="text-[13px] text-[#8888a0] py-6 text-center">
          Loading...
        </div>
      ) : skills.length === 0 ? (
        <div className="text-[13px] text-[#8888a0] py-6 text-center">
          No skills in your library yet. Create skills in the Skills manager
          first.
        </div>
      ) : (
        <>
          <div className="mb-3">
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder="Search skills..."
              icon={<Search size={14} />}
            />
          </div>

          <div className="flex items-center justify-between gap-2 mb-3 text-[11px] text-[#666688]">
            <span>
              {filtered.length} of {skills.length} skill
              {skills.length === 1 ? "" : "s"}
            </span>
            <span>
              {selected.length} selected
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="text-[13px] text-[#8888a0] py-8 text-center mb-5">
              No skills match &ldquo;{search.trim()}&rdquo;.
            </div>
          ) : (
            <div className="flex flex-col gap-2 mb-5 max-h-72 overflow-y-auto pr-1">
              {filtered.map((skill) => {
                const isChecked = selected.includes(skill.id);
                return (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => toggle(skill.id)}
                    className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors cursor-pointer
                      ${isChecked ? "border-[#4ca3ff]/40 bg-[#4ca3ff]/08" : "border-[#2a2a3c] bg-[#1e1e1e] hover:border-[#444466]"}
                    `}
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-[#f0f0f5] truncate">
                        {skill.name}
                      </div>
                      <div className="text-[11px] text-[#8888a0] truncate">
                        {skill.description}
                      </div>
                      <div className="text-[10px] text-[#55556a] font-mono truncate mt-0.5">
                        {skill.id}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-[#8888a0]">
                        {skill.source === "builtin" ? "Template" : "Custom"}
                      </span>
                      <span
                        className={`w-4 h-4 rounded border flex items-center justify-center text-[10px]
                          ${isChecked ? "bg-[#4ca3ff] border-[#4ca3ff] text-white" : "border-[#444466]"}`}
                      >
                        {isChecked ? "✓" : ""}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {error && (
        <div className="mb-4 px-3 py-2 rounded-xl border border-[#ff4d6d]/25 bg-[#ff4d6d]/10 text-[12px] text-[#ff4d6d]">
          {error}
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-xl border border-[#2a2a3c] text-[#8888a0] text-sm cursor-pointer bg-transparent hover:text-[#f0f0f5]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !loaded}
          className="px-4 py-2 rounded-xl bg-[#4ca3ff] text-white text-sm font-medium cursor-pointer disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </ModalWrapper>
  );
}