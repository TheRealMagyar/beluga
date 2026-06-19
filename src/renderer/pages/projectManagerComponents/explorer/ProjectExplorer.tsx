import { useState, useCallback } from "react";
import Editor from "@monaco-editor/react";
import { SelectedProject, FileTreeNode, ContextMenu } from "../types";
import {
  filterHiddenMemoryFile,
  getLinkedMemoryIds,
  loadMemoryFragments,
} from "../utils/memory";
import { useFileEditor } from "../hooks/useFileEditor";
import { useExplorerActions } from "../hooks/useExplorerActions";
import { FileTreeItem } from "./FileTreeItem";
import { ContextMenuPopup } from "./ContextMenuPopup";
import { MemoryLinkModal } from "../modals/MemoryLinkModal";

// ── Language detection ────────────────────────────────────────────────────────

function getLanguageFromFilename(name: string): string {
  const ext = name.split(".").pop() ?? "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript",
    js: "javascript", jsx: "javascript",
    json: "json", md: "markdown",
    css: "css", scss: "css",
    html: "html", xml: "xml",
    py: "python", rs: "rust",
    go: "go", rb: "ruby",
    sh: "shell", yaml: "yaml", yml: "yaml",
    toml: "ini", env: "ini",
  };
  return map[ext] ?? "plaintext";
}

// ── Shared UI primitives (mirrored from SettingsPage) ────────────────────────

function BtnPrimary({
  children,
  onClick,
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 bg-gradient-to-br from-[#6c63ff] to-[#5148d4] text-white rounded-lg px-4 py-2 text-[12px] font-semibold active:scale-[0.97] transition-transform disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

function BtnSecondary({
  children,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 border border-[#2a2a3c] text-[#8888a0] hover:text-[#f0f0f5] hover:border-[#444466] rounded-lg px-4 py-2 text-[12px] font-semibold transition-colors active:scale-[0.97] ${className}`}
      style={{ background: "#111111" }}
    >
      {children}
    </button>
  );
}

function Toast({
  msg,
  danger,
  visible,
}: {
  msg: string;
  danger?: boolean;
  visible: boolean;
}) {
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 border border-[#2a2a3c] rounded-xl px-4 py-3 text-[13px] transition-all duration-300 ${
        visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-8 pointer-events-none"
      }`}
      style={{ background: "#1e1e1e" }}
    >
      <span
        className={`w-2 h-2 rounded-full flex-shrink-0 ${
          danger ? "bg-[#ff4d6d]" : "bg-[#00d4aa]"
        }`}
      />
      <span className="text-[#f0f0f5]">{msg}</span>
    </div>
  );
}

// ── ProjectExplorer ───────────────────────────────────────────────────────────

export function ProjectExplorer({
  project,
  onBack,
}: {
  project: SelectedProject;
  onBack: () => void;
}) {
  const [tree, setTree] = useState<FileTreeNode[]>(
    filterHiddenMemoryFile(project.tree),
  );
  const [contextMenu, setContextMenu] = useState<ContextMenu>({ type: "none" });
  const [showMemoryModal, setShowMemoryModal] = useState(false);
  const [linkedMemoryIds, setLinkedMemoryIds] = useState<string[]>([]);
  const [allFragments] = useState(() => loadMemoryFragments());
  const [toast, setToast] = useState({ msg: "", danger: false, visible: false });

  const showToast = (msg: string, danger = false) => {
    setToast({ msg, danger, visible: true });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2400);
  };

  const {
    selectedPath,
    setSelectedPath,
    fileContent,
    setFileContent,
    editContent,
    setEditContent,
    isDirty,
    setIsDirty,
    saving,
    saveError,
    handleSelectFile: _handleSelectFile,
    handleSave,
  } = useFileEditor();

  const {
    inlineAction,
    setInlineAction,
    actionError,
    setActionError,
    handleContextAction,
    handleInlineConfirm,
    handleMoveNode,
  } = useExplorerActions(
    project,
    selectedPath,
    setSelectedPath,
    setFileContent,
    setEditContent,
    setIsDirty,
    setTree,
  );

  const loadLinkedMemories = useCallback(async () => {
    const ids = await getLinkedMemoryIds(project.path);
    setLinkedMemoryIds(ids);
  }, [project.path]);

  useState(() => {
    loadLinkedMemories();
  });

  const linkedFragments = allFragments.filter((f) =>
    linkedMemoryIds.includes(f.id),
  );

  const handleSelectFile = (node: FileTreeNode) => _handleSelectFile(node.path);

  const handleContextMenu = (e: React.MouseEvent, node: FileTreeNode) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ type: "node", node, x: e.clientX, y: e.clientY });
  };

  const handleRootNew = (type: "newFile" | "newFolder") => {
    setInlineAction({ type, parentPath: project.path });
  };

  const handleSaveWithToast = async () => {
    await handleSave();
    if (!saveError) showToast("File saved");
  };

  const selectedFileName = selectedPath
    ? (selectedPath.split(/[\\/]/).pop() ?? selectedPath)
    : null;

  return (
    <div
      className="flex flex-col h-full text-[#f0f0f5]"
      style={{ background: "#161616", fontFamily: "system-ui, sans-serif" }}
    >
      {/* Header */}
      <header
        className="flex-shrink-0 h-14 border-b border-[#2a2a3c] px-5 flex items-center gap-3"
        style={{ background: "#1e1e1e" }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 border border-[#2a2a3c] text-[#8888a0] hover:text-[#f0f0f5] hover:border-[#444466] rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors"
          style={{ background: "#111111" }}
        >
          ← Back
        </button>

        <div className="w-px h-5 bg-[#2a2a3c]" />

        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-base flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, #6c63ff22, #00d4aa22)",
            border: "1px solid #6c63ff30",
          }}
        >
          📁
        </div>
        <span className="font-bold text-[14px] tracking-tight">
          {project.name}
        </span>
        {isDirty && (
          <span className="text-[11px] text-[#8888a0]">● unsaved</span>
        )}

        <div className="flex-1" />

        <BtnSecondary onClick={() => handleRootNew("newFile")}>
          📄 New file
        </BtnSecondary>
        <BtnSecondary onClick={() => handleRootNew("newFolder")}>
          📁 New folder
        </BtnSecondary>
        {selectedPath && isDirty && (
          <BtnPrimary onClick={handleSaveWithToast} disabled={saving}>
            {saving ? "⏳ Saving…" : "💾 Save"}
          </BtnPrimary>
        )}
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0">

        {/* Sidebar — önállóan görgethető */}
        <aside
          className="w-56 flex-shrink-0 border-r border-[#2a2a3c] overflow-y-auto py-3"
          style={{ background: "#111111" }}
        >
          {/* Memory panel */}
          <div className="px-3 pb-3 mb-2 border-b border-[#2a2a3c]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-[#8888a0] uppercase tracking-[1.2px]">
                🧠 Memories
              </span>
              <button
                onClick={() => setShowMemoryModal(true)}
                className="text-[11px] text-[#6c63ff] hover:underline font-medium"
              >
                Manage
              </button>
            </div>

            {linkedFragments.length === 0 ? (
              <div
                className="rounded-xl px-3 py-2.5 border border-[#2a2a3c] text-[11px] text-[#8888a0]"
                style={{ background: "#1e1e1e" }}
              >
                Nothing linked yet
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {linkedFragments.map((f) => (
                  <span
                    key={f.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium border border-[#2a2a3c] text-[#8888a0] truncate"
                    style={{ background: "#1e1e1e" }}
                  >
                    🧩 {f.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Files label */}
          <div className="px-3 mb-1.5">
            <span className="text-[10px] font-bold text-[#8888a0] uppercase tracking-[1.2px]">
              Files
            </span>
          </div>

          {/* File tree */}
          {tree.length === 0 ? (
            <div
              className="mx-3 rounded-xl border border-[#2a2a3c] px-3 py-5 text-center text-[12px] text-[#8888a0]"
              style={{ background: "#1e1e1e" }}
            >
              Empty project.
              <br />
              Create some files!
            </div>
          ) : (
            tree.map((node) => (
              <FileTreeItem
                key={node.path}
                node={node}
                depth={0}
                selectedPath={selectedPath}
                onSelectFile={handleSelectFile}
                onContextMenu={handleContextMenu}
                inlineAction={inlineAction}
                onInlineConfirm={handleInlineConfirm}
                onInlineCancel={() => setInlineAction({ type: "none" })}
                onMoveNode={handleMoveNode}
              />
            ))
          )}

          {inlineAction.type === "newFile" &&
            (inlineAction as any).parentPath === project.path && (
              <div className="flex items-center gap-1.5 px-3 py-1">
                <span className="text-sm">📄</span>
                <input
                  autoFocus
                  placeholder="filename.ext"
                  className="flex-1 border border-[#6c63ff]/60 rounded-lg px-2 py-1 text-[12px] text-[#f0f0f5] outline-none placeholder-[#8888a0]"
                  style={{ background: "#111111" }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      handleInlineConfirm((e.target as HTMLInputElement).value);
                    if (e.key === "Escape") setInlineAction({ type: "none" });
                  }}
                />
              </div>
            )}
          {inlineAction.type === "newFolder" &&
            (inlineAction as any).parentPath === project.path && (
              <div className="flex items-center gap-1.5 px-3 py-1">
                <span className="text-sm">📁</span>
                <input
                  autoFocus
                  placeholder="folder-name"
                  className="flex-1 border border-[#6c63ff]/60 rounded-lg px-2 py-1 text-[12px] text-[#f0f0f5] outline-none placeholder-[#8888a0]"
                  style={{ background: "#111111" }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      handleInlineConfirm((e.target as HTMLInputElement).value);
                    if (e.key === "Escape") setInlineAction({ type: "none" });
                  }}
                />
              </div>
            )}
        </aside>

        {/* Editor */}
        <main className="flex-1 flex flex-col min-h-0">
          {/* Error banners */}
          {actionError && (
            <div
              className="flex-shrink-0 flex items-center gap-3 text-[12px] text-[#ff4d6d] border-b border-[#ff4d6d]/20 px-5 py-2.5"
              style={{ background: "#ff4d6d0d" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#ff4d6d] flex-shrink-0" />
              {actionError}
              <button
                className="ml-auto underline opacity-70 hover:opacity-100 transition-opacity"
                onClick={() => setActionError(null)}
              >
                Dismiss
              </button>
            </div>
          )}
          {saveError && (
            <div
              className="flex-shrink-0 flex items-center gap-3 text-[12px] text-[#ff4d6d] border-b border-[#ff4d6d]/20 px-5 py-2.5"
              style={{ background: "#ff4d6d0d" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#ff4d6d] flex-shrink-0" />
              Save failed: {saveError}
            </div>
          )}

          {selectedPath ? (
            <>
              {/* Tab bar */}
              <div
                className="flex-shrink-0 h-10 border-b border-[#2a2a3c] flex items-center px-5 gap-2"
                style={{ background: "#1e1e1e" }}
              >
                <span className="text-[12px] font-mono text-[#00d4aa] font-medium">
                  {selectedFileName}
                </span>
                {isDirty && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6c63ff] ml-0.5" />
                )}
                <div className="flex-1" />
                <span className="text-[11px] text-[#8888a0]">Ctrl+S to save</span>
              </div>

              {/* Monaco Editor — saját scrollt kezel */}
              <div className="flex-1 min-h-0">
                <Editor
                  height="100%"
                  language={getLanguageFromFilename(selectedFileName ?? "")}
                  value={editContent}
                  theme="vs-dark"
                  onChange={(val) => {
                    setEditContent(val ?? "");
                    setIsDirty((val ?? "") !== fileContent);
                  }}
                  onMount={(editor) => {
                    editor.addCommand(
                      // Ctrl+S / Cmd+S
                      2097 /* KeyMod.CtrlCmd */ | 49 /* KeyCode.KeyS */,
                      () => handleSaveWithToast(),
                    );
                  }}
                  options={{
                    fontSize: 13,
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    padding: { top: 20, bottom: 20 },
                    renderLineHighlight: "gutter",
                    smoothScrolling: true,
                    cursorBlinking: "smooth",
                    lineNumbers: "on",
                    wordWrap: "off",
                    tabSize: 2,
                  }}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl border border-[#2a2a3c]"
                style={{ background: "#1e1e1e" }}
              >
                📂
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[14px] font-semibold text-[#f0f0f5]">
                  No file selected
                </span>
                <span className="text-[12px] text-[#8888a0]">
                  Pick a file from the sidebar, or right-click to create one.
                </span>
              </div>
            </div>
          )}
        </main>
      </div>

      {contextMenu.type === "node" && (
        <ContextMenuPopup
          menu={contextMenu}
          onClose={() => setContextMenu({ type: "none" })}
          onAction={handleContextAction}
        />
      )}

      {showMemoryModal && (
        <MemoryLinkModal
          projectPath={project.path}
          projectName={project.name}
          onClose={() => setShowMemoryModal(false)}
          onSaved={() => {
            setShowMemoryModal(false);
            loadLinkedMemories();
          }}
        />
      )}

      <Toast msg={toast.msg} danger={toast.danger} visible={toast.visible} />
    </div>
  );
}