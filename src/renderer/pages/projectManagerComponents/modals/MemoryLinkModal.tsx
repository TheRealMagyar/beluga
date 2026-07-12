import { useState, useEffect } from "react";
import { MemoryFragment } from "../types";
import {
  loadMemoryFragments,
  getLinkedMemoryIds,
  saveLinkedMemoryIds,
} from "../utils/memory";
import { ModalWrapper } from "../ui";

// ── MemoryLinkModal ───────────────────────────────────────────────────────────

export function MemoryLinkModal({
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
  const [fragments] = useState<MemoryFragment[]>(() => loadMemoryFragments());
  const [selected, setSelected] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const ids = await getLinkedMemoryIds(projectPath);
      setSelected(ids);
      setLoaded(true);
    })();
  }, [projectPath]);

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveLinkedMemoryIds(projectPath, selected, projectName);
      onSaved();
    } catch (e: any) {
      setError(e.message || "Failed to save.");
    }
    setSaving(false);
  };

  return (
    <ModalWrapper onClose={onClose}>
      <div className="text-lg font-bold mb-1">🧠 Link memories</div>
      <div className="text-[13px] text-[#8888a0] mb-5">
        Memory fragments linked to{" "}
        <span className="font-mono text-[#4ca3ff]">{projectName}</span>.
      </div>

      {!loaded ? (
        <div className="text-[13px] text-[#8888a0] py-6 text-center">
          Loading...
        </div>
      ) : fragments.length === 0 ? (
        <div className="text-[13px] text-[#8888a0] py-6 text-center">
          No memory fragments yet. Create one in the Memory Manager.
        </div>
      ) : (
        <div className="flex flex-col gap-2 mb-5 max-h-64 overflow-y-auto pr-1">
          {fragments.map((f) => {
            const isChecked = selected.includes(f.id);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => toggle(f.id)}
                className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors
                  ${
                    isChecked
                      ? "border-[#4ca3ff]/60 bg-[#4ca3ff]/10"
                      : "border-[#2a2a2a] bg-[#262626] hover:border-[#4ca3ff]/30"
                  }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-base flex-shrink-0">🧩</span>
                  <span className="text-[13px] font-medium truncate">
                    {f.label}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                      f.network === "mainnet"
                        ? "bg-[#00d4aa]/10 text-[#00d4aa]"
                        : "bg-[#ffd66b]/10 text-[#ffd66b]"
                    }`}
                  >
                    {f.network === "mainnet" ? "Mainnet" : "Testnet"}
                  </span>
                </div>
                <span
                  className={`text-sm flex-shrink-0 ${isChecked ? "opacity-100" : "opacity-0"}`}
                >
                  ✓
                </span>
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <div className="text-[12px] text-[#ff4d6d] bg-[#ff4d6d]/08 border border-[#ff4d6d]/20 rounded-lg px-3 py-2 mb-4">
          ⚠️ {error}
        </div>
      )}

      <div className="flex gap-3 justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-xl text-[13px] text-[#8888a0] bg-[#262626] border border-[#2a2a2a] hover:text-[#f0f0f5] transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !loaded}
          className="px-4 py-2 rounded-xl text-[13px] font-semibold text-white disabled:opacity-40 transition-opacity hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #4ca3ff, #3a85e0)" }}
        >
          {saving ? "⏳ Saving..." : "💾 Save"}
        </button>
      </div>
    </ModalWrapper>
  );
}
