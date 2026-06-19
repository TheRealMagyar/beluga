import { useState } from "react";
import { Project, MemoryFragment } from "../types";
import { ModalWrapper } from "../ui";

// ── NewProjectModal ───────────────────────────────────────────────────────────

export function NewProjectModal({
  availableFragments,
  actionError,
  actionLoading,
  onClose,
  onCreate,
}: {
  availableFragments: MemoryFragment[];
  actionError: string | null;
  actionLoading: boolean;
  onClose: () => void;
  onCreate: (name: string, memoryIds: string[]) => void;
}) {
  const [newName, setNewName] = useState("");
  const [newProjectMemoryIds, setNewProjectMemoryIds] = useState<string[]>([]);

  return (
    <ModalWrapper onClose={onClose}>
      <div className="text-lg font-bold mb-1">✨ New project</div>
      <div className="text-[13px] text-[#8888a0] mb-5">
        Creates a folder with the default files (README.md, WALRUS.md,
        CLAUDE.md).
      </div>
      <label className="block text-[11px] font-semibold text-[#8888a0] uppercase tracking-wider mb-1.5">
        Project name
      </label>
      <input
        autoFocus
        value={newName}
        onChange={(e) =>
          setNewName(e.target.value.replace(/[^a-zA-Z0-9_\-]/g, ""))
        }
        onKeyDown={(e) =>
          e.key === "Enter" && onCreate(newName, newProjectMemoryIds)
        }
        placeholder="e.g. my-ai-agent"
        className="w-full bg-[#262626] border border-[#2a2a2a] text-[#f0f0f5] placeholder-[#8888a0]
          rounded-xl px-4 py-2.5 text-[14px] outline-none focus:border-[#4ca3ff]/60 transition-colors mb-1"
      />
      <div className="text-[11px] text-[#8888a0] mb-4">
        Letters, numbers, - and _ only
      </div>

      {availableFragments.length > 0 && (
        <div className="mb-4">
          <label className="block text-[11px] font-semibold text-[#8888a0] uppercase tracking-wider mb-1.5">
            Link memories (optional)
          </label>
          <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
            {availableFragments.map((f) => {
              const checked = newProjectMemoryIds.includes(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() =>
                    setNewProjectMemoryIds((prev) =>
                      prev.includes(f.id)
                        ? prev.filter((x) => x !== f.id)
                        : [...prev, f.id],
                    )
                  }
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-left text-[12.5px] transition-colors
                    ${checked ? "border-[#4ca3ff]/60 bg-[#4ca3ff]/10" : "border-[#2a2a2a] bg-[#262626] hover:border-[#4ca3ff]/30"}`}
                >
                  <span className="truncate">🧩 {f.label}</span>
                  <span className={checked ? "opacity-100" : "opacity-0"}>
                    ✓
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {actionError && (
        <div className="text-[12px] text-[#ff4d6d] bg-[#ff4d6d]/08 border border-[#ff4d6d]/20 rounded-lg px-3 py-2 mb-4">
          ⚠️ {actionError}
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
          onClick={() => onCreate(newName, newProjectMemoryIds)}
          disabled={!newName.trim() || actionLoading}
          className="px-4 py-2 rounded-xl text-[13px] font-semibold text-white disabled:opacity-40 transition-opacity hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #4ca3ff, #3a85e0)" }}
        >
          {actionLoading ? "⏳ Creating..." : "✨ Create"}
        </button>
      </div>
    </ModalWrapper>
  );
}

// ── RenameModal ───────────────────────────────────────────────────────────────

export function RenameModal({
  project,
  actionError,
  actionLoading,
  onClose,
  onRename,
}: {
  project: Project;
  actionError: string | null;
  actionLoading: boolean;
  onClose: () => void;
  onRename: (newName: string) => void;
}) {
  const [renameValue, setRenameValue] = useState(project.name);

  return (
    <ModalWrapper onClose={onClose}>
      <div className="text-lg font-bold mb-1">✏️ Rename project</div>
      <div className="text-[13px] text-[#8888a0] mb-5">
        Renaming{" "}
        <span className="font-mono text-[#4ca3ff]">{project.name}</span>
      </div>
      <label className="block text-[11px] font-semibold text-[#8888a0] uppercase tracking-wider mb-1.5">
        New name
      </label>
      <input
        autoFocus
        value={renameValue}
        onChange={(e) =>
          setRenameValue(e.target.value.replace(/[^a-zA-Z0-9_\-]/g, ""))
        }
        onKeyDown={(e) => e.key === "Enter" && onRename(renameValue)}
        className="w-full bg-[#262626] border border-[#2a2a2a] text-[#f0f0f5] rounded-xl px-4 py-2.5 text-[14px] outline-none focus:border-[#4ca3ff]/60 transition-colors mb-4"
      />
      {actionError && (
        <div className="text-[12px] text-[#ff4d6d] bg-[#ff4d6d]/08 border border-[#ff4d6d]/20 rounded-lg px-3 py-2 mb-4">
          ⚠️ {actionError}
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
          onClick={() => onRename(renameValue)}
          disabled={!renameValue.trim() || actionLoading}
          className="px-4 py-2 rounded-xl text-[13px] font-semibold text-white disabled:opacity-40 transition-opacity hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #4ca3ff, #3a85e0)" }}
        >
          {actionLoading ? "⏳ Renaming..." : "✏️ Rename"}
        </button>
      </div>
    </ModalWrapper>
  );
}

// ── DeleteModal ───────────────────────────────────────────────────────────────

export function DeleteModal({
  project,
  actionError,
  actionLoading,
  onClose,
  onDelete,
}: {
  project: Project;
  actionError: string | null;
  actionLoading: boolean;
  onClose: () => void;
  onDelete: () => void;
}) {
  return (
    <ModalWrapper onClose={onClose}>
      <div className="text-lg font-bold mb-1">🗑️ Delete project</div>
      <div className="text-[13px] text-[#8888a0] mb-5 leading-relaxed">
        Are you sure you want to delete{" "}
        <span className="font-mono text-[#ff4d6d]">{project.name}</span>? This
        action cannot be undone.
      </div>
      {actionError && (
        <div className="text-[12px] text-[#ff4d6d] bg-[#ff4d6d]/08 border border-[#ff4d6d]/20 rounded-lg px-3 py-2 mb-4">
          ⚠️ {actionError}
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
          onClick={onDelete}
          disabled={actionLoading}
          className="px-4 py-2 rounded-xl text-[13px] font-semibold text-white bg-[#ff4d6d] hover:bg-[#e03058] disabled:opacity-40 transition-colors"
        >
          {actionLoading ? "⏳ Deleting..." : "🗑️ Yes, delete"}
        </button>
      </div>
    </ModalWrapper>
  );
}
