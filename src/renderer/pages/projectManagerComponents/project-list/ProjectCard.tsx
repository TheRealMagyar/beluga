import { Project } from "../types";
import { timeAgo } from "../utils/format";
import { handleOpenFolder } from "../utils/fs";
import { Badge, IconButton } from "../ui";
import { CONFIG } from "../../../../config";
import { FileIcon, defaultStyles } from "react-file-icon";

// ── Rekurzív fájlszámolás ─────────────────────────────────────────────────────

function countAllFiles(files: Project["files"]): number {
  return files.reduce((acc, f) => {
    if ((f as any).type === "folder" && (f as any).children) {
      return acc + countAllFiles((f as any).children);
    }
    return acc + 1;
  }, 0);
}

function flattenFiles(files: Project["files"]): Project["files"] {
  return files.reduce<Project["files"]>((acc, f) => {
    if ((f as any).type === "folder" && (f as any).children) {
      return [...acc, ...flattenFiles((f as any).children)];
    }
    return [...acc, f];
  }, []);
}

// ── File badge icon ───────────────────────────────────────────────────────────

function FileBadgeIcon({ name }: { name: string }) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const style = (defaultStyles as any)[ext] ?? {};
  return (
    <span className="flex-shrink-0 w-3.5 h-3.5 flex items-center justify-center">
      <FileIcon extension={ext} {...style} />
    </span>
  );
}

// ── ProjectCard ───────────────────────────────────────────────────────────────

export function ProjectCard({
  project,
  onRename,
  onDelete,
  onSelect,
  onManageMemories,
}: {
  project: Project;
  onRename: () => void;
  onDelete: () => void;
  onSelect: () => void;
  onManageMemories: () => void;
}) {
  const allFiles = flattenFiles(project.files);
  const totalCount = allFiles.length;
  const visibleFiles = allFiles.slice(0, 5);

  return (
    <div
      className="group relative bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl p-5 cursor-pointer
        hover:border-[#4ca3ff]/40 hover:shadow-[0_0_24px_rgba(76,163,255,0.08)] transition-all duration-200"
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, #4ca3ff22, #00d4aa22)",
              border: "1px solid #4ca3ff30",
            }}
          >
            <img
              className="h-5 w-5"
              src={CONFIG.projectManager.projectCard.folderIcon}
            />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-[15px] text-[#f0f0f5] truncate">
              {project.name}
            </div>
            <div className="text-[11px] text-[#8888a0] mt-0.5">
              {timeAgo(project.createdAt)}
            </div>
          </div>
        </div>
        <div
          className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <IconButton
            onClick={() => handleOpenFolder(project.path)}
            title="Open folder"
          >
            <img
              className="h-4 w-4"
              src={CONFIG.projectManager.projectCard.folderIcon}
            />
          </IconButton>
          <IconButton onClick={onManageMemories} title="Manage memories">
            <img
              className="h-4 w-4"
              src={CONFIG.projectManager.projectCard.memoryIcon}
            />
          </IconButton>
          <IconButton onClick={onRename} title="Rename">
            <img
              className="h-4 w-4"
              src={CONFIG.projectManager.projectCard.editIcon}
            />
          </IconButton>
          <IconButton onClick={onDelete} title="Delete" danger>
            <img
              className="h-4 w-4"
              src={CONFIG.projectManager.projectCard.deleteIcon}
            />
          </IconButton>
        </div>
      </div>

      {/* File badges — max 5, rekurzívan összegyűjtve */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {visibleFiles.map((f) => (
          <span
            key={f.name}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium
              bg-[#262626] border border-[#2a2a2a] text-[#8888a0]"
          >
            <FileBadgeIcon name={f.name} />
            <span>{f.name}</span>
          </span>
        ))}
        {totalCount > 5 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#262626] border border-[#2a2a2a] text-[#8888a0]">
            +{totalCount - 5}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge color="muted">{totalCount} files</Badge>
          {project.linkedMemoryIds.length > 0 && (
            <Badge color="accent">
              <img
                className="h-3 w-3 mr-1"
                src={CONFIG.projectManager.projectCard.memoryIcon}
              />
              {project.linkedMemoryIds.length}
            </Badge>
          )}
        </div>
        <span className="text-[11px] text-[#8888a0] group-hover:text-[#4ca3ff] transition-colors">
          Open →
        </span>
      </div>
    </div>
  );
}