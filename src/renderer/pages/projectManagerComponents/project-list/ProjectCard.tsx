import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  FolderOpen,
  GitBranch,
  MoreVertical,
  Package,
  Pencil,
  Puzzle,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Project } from "../types";
import { timeAgo } from "../utils/format";
import { handleOpenFolder } from "../utils/fs";
import { ResourceBadge } from "../projects-ui";
import { CONFIG } from "../../../../config";
import { FileIcon, defaultStyles } from "react-file-icon";

function flattenFiles(files: Project["files"]): Project["files"] {
  return files.reduce<Project["files"]>((acc, f) => {
    if ((f as { type?: string; children?: Project["files"] }).type === "folder") {
      const children = (f as { children?: Project["files"] }).children;
      if (children) return [...acc, ...flattenFiles(children)];
    }
    return [...acc, f];
  }, []);
}

function FileBadgeIcon({ name }: { name: string }) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const style = (defaultStyles as Record<string, unknown>)[ext] ?? {};
  return (
    <span className="flex-shrink-0 w-3.5 h-3.5 flex items-center justify-center">
      <FileIcon extension={ext} {...style} />
    </span>
  );
}

type MenuAction = {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
};

export function ProjectCard({
  project,
  variant = "grid",
  index = 0,
  onRename,
  onDelete,
  onSelect,
  onManageMemories,
  onManagePackages,
  onManageSkills,
  onManageGitHub,
}: {
  project: Project;
  variant?: "grid" | "list";
  index?: number;
  onRename: () => void;
  onDelete: () => void;
  onSelect: () => void;
  onManageMemories: () => void;
  onManagePackages: () => void;
  onManageSkills: () => void;
  onManageGitHub: () => void;
}) {
  const allFiles = flattenFiles(project.files);
  const totalCount = allFiles.length;
  const visibleFiles = allFiles.slice(0, variant === "list" ? 3 : 4);
  const menuActions: MenuAction[] = [
    {
      id: "folder",
      label: "Open folder",
      icon: <FolderOpen size={14} />,
      onClick: () => handleOpenFolder(project.path),
    },
    {
      id: "memory",
      label: "Memories",
      icon: <Puzzle size={14} />,
      onClick: onManageMemories,
    },
    {
      id: "packages",
      label: "Packages",
      icon: <Package size={14} />,
      onClick: onManagePackages,
    },
    {
      id: "skills",
      label: "Skills",
      icon: <Sparkles size={14} />,
      onClick: onManageSkills,
    },
    {
      id: "github",
      label: "GitHub & Git",
      icon: <GitBranch size={14} />,
      onClick: onManageGitHub,
    },
    {
      id: "rename",
      label: "Rename",
      icon: <Pencil size={14} />,
      onClick: onRename,
    },
    {
      id: "delete",
      label: "Delete",
      icon: <Trash2 size={14} />,
      onClick: onDelete,
      danger: true,
    },
  ];

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null,
  );
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);

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

  const quickActions = [
    {
      title: "Memories",
      icon: <Puzzle size={13} />,
      onClick: onManageMemories,
      active: project.linkedMemoryIds.length > 0,
    },
    {
      title: "Packages",
      icon: <Package size={13} />,
      onClick: onManagePackages,
      active: project.linkedPackageIds.length > 0,
    },
    {
      title: "Skills",
      icon: <Sparkles size={13} />,
      onClick: onManageSkills,
      active: project.linkedSkillIds.length > 0,
    },
    {
      title: "GitHub",
      icon: <GitBranch size={13} />,
      onClick: onManageGitHub,
      active: false,
    },
  ];

  const cardClass =
    variant === "list"
      ? "packages-card-in group flex items-center gap-4 rounded-2xl border border-[#2a2a2a] bg-[#1e1e1e] px-4 py-3.5 cursor-pointer hover:border-[#4ca3ff]/35 hover:bg-[#202020]"
      : "packages-card-in group relative flex flex-col min-h-[220px] min-w-0 overflow-visible rounded-2xl border border-[#2a2a2a] bg-[#1e1e1e] p-5 cursor-pointer hover:border-[#4ca3ff]/35 hover:bg-[#202020]";

  return (
    <div
      className={cardClass}
      style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
      onClick={onSelect}
    >
      {variant === "list" ? (
        <>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, #4ca3ff18, #00d4aa12)",
              border: "1px solid #4ca3ff28",
            }}
          >
            <img
              className="h-5 w-5"
              src={CONFIG.projectManager.projectCard.folderIcon}
              alt=""
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="text-[14px] font-semibold text-[#f0f0f5] truncate">
                {project.name}
              </h3>
              <span className="text-[10px] text-[#666688] flex-shrink-0">
                {timeAgo(project.createdAt)}
              </span>
            </div>
            <p className="text-[11px] font-mono text-[#55556a] truncate">
              {project.path}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <ResourceBadge tone="muted">{totalCount} files</ResourceBadge>
              {project.linkedMemoryIds.length > 0 ? (
                <ResourceBadge tone="memory" icon={<Puzzle size={10} />}>
                  {project.linkedMemoryIds.length}
                </ResourceBadge>
              ) : null}
              {project.linkedPackageIds.length > 0 ? (
                <ResourceBadge tone="package" icon={<Package size={10} />}>
                  {project.linkedPackageIds.length}
                </ResourceBadge>
              ) : null}
              {project.linkedSkillIds.length > 0 ? (
                <ResourceBadge tone="skill" icon={<Sparkles size={10} />}>
                  {project.linkedSkillIds.length}
                </ResourceBadge>
              ) : null}
            </div>
          </div>

          <div
            className="flex items-center gap-1 flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {quickActions.map((action) => (
              <button
                key={action.title}
                type="button"
                title={action.title}
                onClick={action.onClick}
                className={`h-8 w-8 flex items-center justify-center rounded-lg border cursor-pointer ${
                  action.active
                    ? "border-[#4ca3ff]/30 bg-[#4ca3ff]/10 text-[#9ed0ff]"
                    : "border-[#2a2a2a] bg-[#161616] text-[#8888a0] hover:text-[#e8e8f0] hover:border-[#3a3a48]"
                }`}
              >
                {action.icon}
              </button>
            ))}
            <button
              ref={menuButtonRef}
              type="button"
              title="More actions"
              onClick={toggleMenu}
              className={`h-8 w-8 flex items-center justify-center rounded-lg border cursor-pointer ${
                menuOpen
                  ? "border-[#4ca3ff]/35 bg-[#4ca3ff]/12 text-[#4ca3ff]"
                  : "border-[#2a2a2a] bg-[#161616] text-[#8888a0] hover:text-[#f0f0f5]"
              }`}
            >
              <MoreVertical size={15} />
            </button>
            <span className="text-[#4ca3ff] ml-1">
              <ArrowRight size={16} />
            </span>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-start gap-3 mb-3 min-w-0">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, #4ca3ff18, #00d4aa12)",
                border: "1px solid #4ca3ff28",
              }}
            >
              <img
                className="h-5 w-5"
                src={CONFIG.projectManager.projectCard.folderIcon}
                alt=""
              />
            </div>

            <div className="flex-1 min-w-0 pr-1">
              <div className="font-semibold text-[16px] text-[#f0f0f5] truncate leading-tight">
                {project.name}
              </div>
              <div className="text-[11px] text-[#8888a0] mt-0.5">
                {timeAgo(project.createdAt)}
              </div>
              <div className="text-[10px] font-mono text-[#55556a] mt-1 truncate">
                {project.path}
              </div>
            </div>

            <button
              ref={menuButtonRef}
              type="button"
              title="Project actions"
              onClick={toggleMenu}
              className={`p-1.5 rounded-lg border cursor-pointer flex-shrink-0 ${
                menuOpen
                  ? "border-[#4ca3ff]/35 bg-[#4ca3ff]/12 text-[#4ca3ff]"
                  : "border-transparent text-[#8888a0] opacity-70 group-hover:opacity-100 hover:border-[#2a2a2c] hover:text-[#f0f0f5] hover:bg-[#1c1c2a]"
              }`}
            >
              <MoreVertical size={16} />
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-3 min-h-[48px] content-start">
            {visibleFiles.length > 0 ? (
              visibleFiles.map((f, i) => (
                <span
                  key={`${f.name}-${i}`}
                  className="inline-flex items-center gap-1 max-w-full px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#262626] border border-[#2a2a2a] text-[#8888a0]"
                >
                  <FileBadgeIcon name={f.name} />
                  <span className="truncate max-w-[110px]">{f.name}</span>
                </span>
              ))
            ) : (
              <span className="text-[11px] text-[#666688] italic">
                No files yet
              </span>
            )}
            {totalCount > visibleFiles.length ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#262626] border border-[#2a2a2a] text-[#8888a0]">
                +{totalCount - visibleFiles.length} more
              </span>
            ) : null}
          </div>

          <div
            className="mt-auto flex items-end justify-between gap-2 min-w-0 pt-2 border-t border-[#2a2a2a]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center gap-1.5 min-w-0 pt-2">
              <ResourceBadge tone="muted">{totalCount} files</ResourceBadge>
              {project.linkedMemoryIds.length > 0 ? (
                <ResourceBadge tone="memory" icon={<Puzzle size={10} />}>
                  {project.linkedMemoryIds.length} mem
                </ResourceBadge>
              ) : null}
              {project.linkedPackageIds.length > 0 ? (
                <ResourceBadge tone="package" icon={<Package size={10} />}>
                  {project.linkedPackageIds.length} pkg
                </ResourceBadge>
              ) : null}
              {project.linkedSkillIds.length > 0 ? (
                <ResourceBadge tone="skill" icon={<Sparkles size={10} />}>
                  {project.linkedSkillIds.length} skill
                </ResourceBadge>
              ) : null}
            </div>
            <div className="flex items-center gap-1 pt-2 opacity-0 group-hover:opacity-100">
              {quickActions.slice(0, 3).map((action) => (
                <button
                  key={action.title}
                  type="button"
                  title={action.title}
                  onClick={action.onClick}
                  className="h-7 w-7 flex items-center justify-center rounded-lg border border-[#2a2a2a] bg-[#161616] text-[#8888a0] hover:text-[#9ed0ff] hover:border-[#4ca3ff]/30 cursor-pointer"
                >
                  {action.icon}
                </button>
              ))}
              <span className="text-[11px] text-[#4ca3ff] ml-1 flex items-center gap-0.5">
                Open <ArrowRight size={12} />
              </span>
            </div>
          </div>
        </>
      )}

      {menuPortal}
    </div>
  );
}