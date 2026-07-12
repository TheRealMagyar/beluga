import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  Brain,
  Check,
  Copy,
  Eye,
  EyeOff,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import type { MemoryEntry } from "./types";
import { shortHex } from "./utils";
import {
  MemoryCardSkeleton,
  MemoryEmpty,
  MemoryPanel,
  NetworkBadge,
} from "./memory-ui";

interface ManagerViewProps {
  entries: MemoryEntry[];
  view: "grid" | "list";
  search: string;
  walletConnected: boolean;
  onOpen: (id: string) => void;
  onRename: (id: string, current: string) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
  onImport: () => void;
  revealedKeyId: string | null;
  setRevealedKeyId: (id: string | null) => void;
  copiedField: string | null;
  copyToClipboard: (text: string, field: string) => void;
  loading?: boolean;
}

type MenuAction = {
  id: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  danger?: boolean;
};

function CopyBtn({
  copied,
  onClick,
  label,
}: {
  copied: boolean;
  onClick: (e: React.MouseEvent) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className="h-7 w-7 flex items-center justify-center rounded-lg text-[#666688] hover:text-[#c7c7d8] hover:bg-white/[0.05] cursor-pointer"
      aria-label={label}
      onClick={onClick}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

function MemoryFragmentCard({
  entry,
  variant,
  index,
  onOpen,
  onRename,
  onDelete,
  revealedKeyId,
  setRevealedKeyId,
  copiedField,
  copyToClipboard,
}: {
  entry: MemoryEntry;
  variant: "grid" | "list";
  index: number;
  onOpen: (id: string) => void;
  onRename: (id: string, current: string) => void;
  onDelete: (id: string) => void;
  revealedKeyId: string | null;
  setRevealedKeyId: (id: string | null) => void;
  copiedField: string | null;
  copyToClipboard: (text: string, field: string) => void;
}) {
  const keyRevealed = revealedKeyId === entry.id;
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null,
  );
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);

  const menuActions: MenuAction[] = [
    {
      id: "open",
      label: "Open workspace",
      icon: <ArrowRight size={14} />,
      onClick: () => onOpen(entry.id),
    },
    {
      id: "rename",
      label: "Rename",
      icon: <Pencil size={14} />,
      onClick: () => onRename(entry.id, entry.label),
    },
    {
      id: "delete",
      label: "Delete",
      icon: <Trash2 size={14} />,
      onClick: () => onDelete(entry.id),
      danger: true,
    },
  ];

  const MENU_WIDTH = 176;
  const MENU_ITEM_HEIGHT = 36;
  const MENU_PADDING = 8;
  const menuHeight = menuActions.length * MENU_ITEM_HEIGHT + MENU_PADDING;

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setMenuPos(null);
  }, []);

  const updateMenuPosition = useCallback(() => {
    const btn = menuButtonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const margin = 8;
    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const openUp = spaceBelow < menuHeight && rect.top > menuHeight + margin;
    const top = openUp
      ? rect.top - menuHeight - margin
      : rect.bottom + margin;
    const left = Math.min(
      Math.max(margin, rect.right - MENU_WIDTH),
      window.innerWidth - MENU_WIDTH - margin,
    );
    setMenuPos({ top, left });
  }, [menuHeight]);

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (menuOpen) {
      closeMenu();
      return;
    }
    updateMenuPosition();
    setMenuOpen(true);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuButtonRef.current?.contains(target) ||
        menuPanelRef.current?.contains(target)
      ) {
        return;
      }
      closeMenu();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    const onReposition = () => updateMenuPosition();
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", closeMenu, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [menuOpen, closeMenu, updateMenuPosition]);

  const runAction = (action: MenuAction) => {
    closeMenu();
    action.onClick();
  };

  const menuPortal =
    menuOpen &&
    menuPos &&
    createPortal(
      <div
        ref={menuPanelRef}
        className="fixed z-[10050] w-44 py-1 rounded-xl border border-[#2a2a3c] bg-[#14141f] shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
        style={{ top: menuPos.top, left: menuPos.left }}
        onClick={(e) => e.stopPropagation()}
      >
        {menuActions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              runAction(action);
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-[12px] border-none cursor-pointer ${
              action.danger
                ? "text-[#ff6b8a] hover:bg-[#ff4d6d]/10"
                : "text-[#c7c7d8] hover:bg-white/[0.05] hover:text-[#f0f0f5]"
            }`}
          >
            <span className="flex-shrink-0 opacity-80">{action.icon}</span>
            <span className="truncate">{action.label}</span>
          </button>
        ))}
      </div>,
      document.body,
    );

  const metaRows = (
    <>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[10px] text-[#55556a] w-16 shrink-0">Account</span>
        <span className="flex-1 text-right text-[11px] font-mono text-[#a8a8c0] truncate">
          {shortHex(entry.accountId, 10, 6)}
        </span>
        <CopyBtn
          copied={copiedField === `${entry.id}-acc`}
          label="Copy account ID"
          onClick={(e) => {
            e.stopPropagation();
            copyToClipboard(entry.accountId, `${entry.id}-acc`);
          }}
        />
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[10px] text-[#55556a] w-16 shrink-0">Key</span>
        <span className="flex-1 text-right text-[11px] font-mono text-[#a8a8c0] truncate">
          {keyRevealed ? shortHex(entry.delegateKey, 10, 6) : "••••••••••••••"}
        </span>
        <button
          type="button"
          className="h-7 w-7 flex items-center justify-center rounded-lg text-[#666688] hover:text-[#c7c7d8] hover:bg-white/[0.05] cursor-pointer"
          aria-label={keyRevealed ? "Hide key" : "Show key"}
          onClick={(e) => {
            e.stopPropagation();
            setRevealedKeyId(keyRevealed ? null : entry.id);
          }}
        >
          {keyRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
        <CopyBtn
          copied={copiedField === `${entry.id}-key`}
          label="Copy delegate key"
          onClick={(e) => {
            e.stopPropagation();
            copyToClipboard(entry.delegateKey, `${entry.id}-key`);
          }}
        />
      </div>
    </>
  );

  if (variant === "list") {
    return (
      <>
        <div
          className="group flex items-center gap-4 rounded-2xl border border-[#2a2a2a] bg-[#1e1e1e] px-4 py-3.5 cursor-pointer hover:border-[#3a3a48] hover:bg-[#222228] packages-card-in"
          style={{ animationDelay: `${index * 40}ms` }}
          onClick={() => onOpen(entry.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter") onOpen(entry.id);
          }}
        >
          <div className="h-10 w-10 rounded-xl border border-[#6c63ff]/25 bg-[#6c63ff]/10 flex items-center justify-center shrink-0">
            <Brain size={18} className="text-[#9d97ff]" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[14px] font-semibold text-[#f0f0f5] truncate">
                {entry.label}
              </span>
              <NetworkBadge network={entry.network} />
            </div>
            <p className="text-[11px] font-mono text-[#55556a] truncate">
              ns: {entry.namespace || "default"}
            </p>
          </div>

          <div className="hidden md:flex flex-col gap-1.5 w-[280px] shrink-0">
            {metaRows}
          </div>

          <button
            type="button"
            ref={menuButtonRef}
            onClick={toggleMenu}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-[#666688] hover:text-[#c7c7d8] hover:bg-white/[0.05] cursor-pointer shrink-0"
            aria-label="More actions"
          >
            <MoreVertical size={16} />
          </button>
        </div>
        {menuPortal}
      </>
    );
  }

  return (
    <>
      <div
        className="group rounded-2xl border border-[#2a2a2a] bg-[#1e1e1e] p-5 cursor-pointer hover:border-[#3a3a48] hover:bg-[#222228] packages-card-in"
        style={{ animationDelay: `${index * 40}ms` }}
        onClick={() => onOpen(entry.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter") onOpen(entry.id);
        }}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl border border-[#6c63ff]/25 bg-[#6c63ff]/10 flex items-center justify-center shrink-0">
            <Brain size={18} className="text-[#9d97ff]" />
          </div>
          <div className="flex items-center gap-1.5">
            <NetworkBadge network={entry.network} />
            <button
              type="button"
              ref={menuButtonRef}
              onClick={toggleMenu}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-[#666688] hover:text-[#c7c7d8] hover:bg-white/[0.05] cursor-pointer"
              aria-label="More actions"
            >
              <MoreVertical size={16} />
            </button>
          </div>
        </div>

        <h3 className="text-[15px] font-semibold text-[#f0f0f5] mb-1 truncate">
          {entry.label}
        </h3>
        <p className="text-[11px] font-mono text-[#55556a] mb-4">
          ns: {entry.namespace || "default"}
        </p>

        <div className="space-y-2 mb-4 rounded-xl border border-[#2a2a2a] bg-[#161616]/80 px-3 py-2.5">
          {metaRows}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-[#2a2a2a]">
          <button
            type="button"
            className="flex items-center gap-1.5 text-[12px] font-medium text-[#8888a0] hover:text-[#b8b0ff] cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onOpen(entry.id);
            }}
          >
            Open workspace
            <ArrowRight size={13} />
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="h-8 px-2.5 flex items-center gap-1 rounded-lg text-[11px] text-[#8888a0] hover:text-[#f0f0f5] hover:bg-white/[0.05] cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onRename(entry.id, entry.label);
              }}
            >
              <Pencil size={12} />
              Rename
            </button>
          </div>
        </div>
      </div>
      {menuPortal}
    </>
  );
}

export function ManagerView({
  entries,
  view,
  search,
  walletConnected,
  onOpen,
  onRename,
  onDelete,
  onCreate,
  onImport,
  revealedKeyId,
  setRevealedKeyId,
  copiedField,
  copyToClipboard,
  loading = false,
}: ManagerViewProps) {
  if (loading) {
    return (
      <MemoryPanel>
        <div
          className={
            view === "grid"
              ? "grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4"
              : "space-y-3"
          }
        >
          {Array.from({ length: view === "grid" ? 6 : 4 }).map((_, i) => (
            <MemoryCardSkeleton key={i} />
          ))}
        </div>
      </MemoryPanel>
    );
  }

  if (entries.length === 0) {
    return (
      <MemoryEmpty
        search={search}
        onCreate={onCreate}
        onImport={onImport}
        walletConnected={walletConnected}
      />
    );
  }

  return (
    <MemoryPanel>
      <div
        className={
          view === "grid"
            ? "grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4"
            : "space-y-3"
        }
      >
        {entries.map((entry, index) => (
          <MemoryFragmentCard
            key={entry.id}
            entry={entry}
            variant={view}
            index={index}
            onOpen={onOpen}
            onRename={onRename}
            onDelete={onDelete}
            revealedKeyId={revealedKeyId}
            setRevealedKeyId={setRevealedKeyId}
            copiedField={copiedField}
            copyToClipboard={copyToClipboard}
          />
        ))}
      </div>
    </MemoryPanel>
  );
}