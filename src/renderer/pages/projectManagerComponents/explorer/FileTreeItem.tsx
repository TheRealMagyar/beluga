import { useState, useRef, useEffect } from "react";
import { FileIcon, defaultStyles } from "react-file-icon";
import { FileTreeNode, InlineAction } from "../types";
import { formatSize } from "../utils/format";

// ── File icon helper ──────────────────────────────────────────────────────────

function FileTreeIcon({ name }: { name: string }) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const style = (defaultStyles as any)[ext] ?? {};
  return (
    <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
      <FileIcon extension={ext} {...style} />
    </span>
  );
}

// ── Folder icon ───────────────────────────────────────────────────────────────

function FolderIcon({ open, highlight }: { open: boolean; highlight?: boolean }) {
  return (
    <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
      {open ? (
        <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width="16" height="16">
          <path d="M1 3.5C1 2.67 1.67 2 2.5 2H6l1.5 1.5H13.5C14.33 3.5 15 4.17 15 5v7.5C15 13.33 14.33 14 13.5 14h-11C1.67 14 1 13.33 1 12.5V3.5z"
            fill={highlight ? "#a78bfa" : "#e8b84b"} opacity="0.9"/>
          <path d="M1 6h14v6.5C15 13.33 14.33 14 13.5 14h-11C1.67 14 1 13.33 1 12.5V6z"
            fill={highlight ? "#a78bfa" : "#e8b84b"}/>
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width="16" height="16">
          <path d="M1 3.5C1 2.67 1.67 2 2.5 2H6l1.5 1.5H13.5C14.33 3.5 15 4.17 15 5V12.5C15 13.33 14.33 14 13.5 14h-11C1.67 14 1 13.33 1 12.5V3.5z"
            fill={highlight ? "#a78bfa" : "#c9a227"} opacity="0.85"/>
        </svg>
      )}
    </span>
  );
}

// ── Chevron ───────────────────────────────────────────────────────────────────

function Chevron({ open }: { open: boolean }) {
  return (
    <span className="flex-shrink-0 w-3 h-3 flex items-center justify-center text-[#555570]">
      <svg
        viewBox="0 0 12 12"
        width="10"
        height="10"
        fill="currentColor"
        style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s ease" }}
      >
        <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </span>
  );
}

// ── Inline input ──────────────────────────────────────────────────────────────

function InlineInput({
  inputRef,
  placeholder,
  defaultValue,
  onConfirm,
  onCancel,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  placeholder?: string;
  defaultValue?: string;
  onConfirm: (v: string) => void;
  onCancel: () => void;
}) {
  return (
    <input
      ref={inputRef}
      defaultValue={defaultValue}
      placeholder={placeholder}
      className="flex-1 border border-[#6c63ff]/60 rounded px-1.5 py-0.5 text-[12px] text-[#f0f0f5] outline-none placeholder-[#8888a0]"
      style={{ background: "#0d0d18" }}
      onKeyDown={(e) => {
        if (e.key === "Enter") onConfirm((e.target as HTMLInputElement).value);
        if (e.key === "Escape") onCancel();
      }}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

// ── FileTreeItem ──────────────────────────────────────────────────────────────

export function FileTreeItem({
  node,
  depth,
  selectedPath,
  onSelectFile,
  onContextMenu,
  inlineAction,
  onInlineConfirm,
  onInlineCancel,
  onMoveNode,
}: {
  node: FileTreeNode;
  depth: number;
  selectedPath: string | null;
  onSelectFile: (node: FileTreeNode) => void;
  onContextMenu: (e: React.MouseEvent, node: FileTreeNode) => void;
  inlineAction: InlineAction;
  onInlineConfirm: (value: string) => void;
  onInlineCancel: () => void;
  onMoveNode: (sourcePath: string, targetFolderPath: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isRenaming =
    (inlineAction.type === "renameFile" || inlineAction.type === "renameFolder") &&
    (inlineAction as any).node.path === node.path;

  const isNewFileHere =
    inlineAction.type === "newFile" &&
    (inlineAction as any).parentPath === node.path;

  const isNewFolderHere =
    inlineAction.type === "newFolder" &&
    (inlineAction as any).parentPath === node.path;

  useEffect(() => {
    if ((isRenaming || isNewFileHere || isNewFolderHere) && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming, isNewFileHere, isNewFolderHere]);

  const indent = depth * 14;

  // ── Drag handlers ─────────────────────────────────────────────────────────

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", node.path);
    e.dataTransfer.effectAllowed = "move";
    e.stopPropagation();
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (node.type !== "folder") return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (node.type !== "folder") return;
    const sourcePath = e.dataTransfer.getData("text/plain");
    if (sourcePath && sourcePath !== node.path) {
      onMoveNode(sourcePath, node.path);
      setOpen(true);
    }
  };

  // ── Folder ────────────────────────────────────────────────────────────────

  if (node.type === "folder") {
    return (
      <div>
        <div
          draggable
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex items-center gap-1.5 py-[3px] pr-2 rounded-md cursor-pointer transition-colors text-[#c0c0d0] hover:text-[#f0f0f5] ${
            dragOver
              ? "bg-[#6c63ff]/20 outline outline-1 outline-[#6c63ff]/50"
              : "hover:bg-[#ffffff08]"
          }`}
          style={{ paddingLeft: `${indent + 6}px` }}
          onClick={() => setOpen((o) => !o)}
          onContextMenu={(e) => onContextMenu(e, node)}
        >
          <Chevron open={open} />
          <FolderIcon open={open} highlight={dragOver} />
          {isRenaming ? (
            <InlineInput
              inputRef={inputRef}
              defaultValue={node.name}
              onConfirm={onInlineConfirm}
              onCancel={onInlineCancel}
            />
          ) : (
            <span className="text-[12px] font-medium flex-1 truncate leading-none select-none">
              {node.name}
            </span>
          )}
        </div>

        {open && (
          <div>
            {node.children?.map((child) => (
              <FileTreeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                onSelectFile={onSelectFile}
                onContextMenu={onContextMenu}
                inlineAction={inlineAction}
                onInlineConfirm={onInlineConfirm}
                onInlineCancel={onInlineCancel}
                onMoveNode={onMoveNode}
              />
            ))}

            {isNewFileHere && (
              <div
                className="flex items-center gap-1.5 py-[3px] pr-2"
                style={{ paddingLeft: `${indent + 22}px` }}
              >
                <FileTreeIcon name="file.txt" />
                <InlineInput
                  inputRef={inputRef}
                  placeholder="filename.ext"
                  onConfirm={onInlineConfirm}
                  onCancel={onInlineCancel}
                />
              </div>
            )}
            {isNewFolderHere && (
              <div
                className="flex items-center gap-1.5 py-[3px] pr-2"
                style={{ paddingLeft: `${indent + 22}px` }}
              >
                <FolderIcon open={false} />
                <InlineInput
                  inputRef={inputRef}
                  placeholder="folder-name"
                  onConfirm={onInlineConfirm}
                  onCancel={onInlineCancel}
                />
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── File ──────────────────────────────────────────────────────────────────

  const isSelected = selectedPath === node.path;

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className={`flex items-center gap-1.5 py-[3px] pr-2 rounded-md cursor-pointer transition-colors ${
        isSelected
          ? "bg-[#6c63ff]/15 text-[#f0f0f5]"
          : "hover:bg-[#ffffff08] text-[#a0a0b8] hover:text-[#f0f0f5]"
      }`}
      style={{
        paddingLeft: `${indent + 20}px`,
        borderLeft: isSelected ? "2px solid #6c63ff" : "2px solid transparent",
      }}
      onClick={() => onSelectFile(node)}
      onContextMenu={(e) => onContextMenu(e, node)}
    >
      <FileTreeIcon name={node.name} />
      {isRenaming ? (
        <InlineInput
          inputRef={inputRef}
          defaultValue={node.name}
          onConfirm={onInlineConfirm}
          onCancel={onInlineCancel}
        />
      ) : (
        <>
          <span className="text-[12px] font-medium flex-1 truncate leading-none select-none">
            {node.name}
          </span>
          {node.size !== undefined && (
            <span className="text-[10px] text-[#555570] flex-shrink-0">
              {formatSize(node.size)}
            </span>
          )}
        </>
      )}
    </div>
  );
}