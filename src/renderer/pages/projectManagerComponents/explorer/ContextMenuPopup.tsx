import { useRef, useEffect } from "react";
import { FileTreeNode, ContextMenu } from "../types";

// ── ContextMenuPopup ──────────────────────────────────────────────────────────

export function ContextMenuPopup({
  menu,
  onClose,
  onAction,
}: {
  menu: ContextMenu & { type: "node" };
  onClose: () => void;
  onAction: (action: string, node: FileTreeNode) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", escHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", escHandler);
    };
  }, [onClose]);

  const items =
    menu.node.type === "folder"
      ? [
          { label: "📄 New file here", action: "newFile" },
          { label: "📁 New folder here", action: "newFolder" },
          { label: "✏️ Rename", action: "renameFolder" },
          { label: "🗑️ Delete", action: "deleteFolder", danger: true },
        ]
      : [
          { label: "✏️ Rename", action: "renameFile" },
          { label: "🗑️ Delete", action: "deleteFile", danger: true },
        ];

  return (
    <div
      ref={ref}
      className="fixed z-[100] bg-[#1c1c2a] border border-[#2a2a3c] rounded-xl shadow-2xl py-1 min-w-[160px]"
      style={{ top: menu.y, left: menu.x }}
    >
      {items.map((item) => (
        <button
          key={item.action}
          className={`w-full text-left px-4 py-2 text-[12px] transition-colors
            ${item.danger ? "text-[#ff4d6d] hover:bg-[#ff4d6d]/10" : "text-[#f0f0f5] hover:bg-[#2a2a3c]"}`}
          onClick={() => {
            onAction(item.action, menu.node);
            onClose();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}