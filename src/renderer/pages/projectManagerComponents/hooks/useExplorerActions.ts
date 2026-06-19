import { useState, useCallback } from "react";
import { FileTreeNode, InlineAction, SelectedProject } from "../types";
import { filterHiddenMemoryFile } from "../utils/memory";

const getFs = () => (window as any).fs;

// ── useExplorerActions ────────────────────────────────────────────────────────

export function useExplorerActions(
  project: SelectedProject,
  selectedPath: string | null,
  setSelectedPath: (p: string | null) => void,
  setFileContent: (c: string) => void,
  setEditContent: (c: string) => void,
  setIsDirty: (d: boolean) => void,
  setTree: (t: FileTreeNode[]) => void
) {
  const [inlineAction, setInlineAction] = useState<InlineAction>({ type: "none" });
  const [actionError, setActionError] = useState<string | null>(null);
  const fs = getFs();

  const refreshTree = useCallback(async () => {
    try {
      const updated: SelectedProject = await fs.selectProject(project.path);
      setTree(filterHiddenMemoryFile(updated.tree));
    } catch (e: any) {
      setActionError(e.message);
    }
  }, [fs, project.path, setTree]);

  const handleContextAction = async (action: string, node: FileTreeNode) => {
    setActionError(null);

    if (action === "newFile") {
      setInlineAction({ type: "newFile", parentPath: node.path });
    } else if (action === "newFolder") {
      setInlineAction({ type: "newFolder", parentPath: node.path });
    } else if (action === "renameFile") {
      setInlineAction({ type: "renameFile", node });
    } else if (action === "renameFolder") {
      setInlineAction({ type: "renameFolder", node });
    } else if (action === "deleteFile") {
      if (!window.confirm(`Delete: ${node.name}?`)) return;
      try {
        await fs.deleteFile(node.path);
        if (selectedPath === node.path) {
          setSelectedPath(null);
          setFileContent("");
          setEditContent("");
          setIsDirty(false);
        }
        await refreshTree();
      } catch (e: any) {
        setActionError(e.message || "Delete error.");
      }
    } else if (action === "deleteFolder") {
      if (!window.confirm(`Delete the folder and its contents: ${node.name}?`)) return;
      try {
        await fs.deleteFolder(node.path);
        await refreshTree();
      } catch (e: any) {
        setActionError(e.message || "Delete error.");
      }
    }
  };

  const handleInlineConfirm = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) { setInlineAction({ type: "none" }); return; }
    setActionError(null);

    try {
      if (inlineAction.type === "renameFile") {
        const dir =
          inlineAction.node.path.substring(0, inlineAction.node.path.lastIndexOf("/") + 1) ||
          inlineAction.node.path.substring(0, inlineAction.node.path.lastIndexOf("\\") + 1);
        const newPath = dir + trimmed;
        await fs.renameFile(inlineAction.node.path, newPath);
        if (selectedPath === inlineAction.node.path) setSelectedPath(newPath);
      } else if (inlineAction.type === "renameFolder") {
        const parent = inlineAction.node.path.substring(
          0,
          Math.max(
            inlineAction.node.path.lastIndexOf("/"),
            inlineAction.node.path.lastIndexOf("\\")
          )
        );
        const newPath = parent + (parent.includes("/") ? "/" : "\\") + trimmed;
        await fs.renameFolder(inlineAction.node.path, newPath);
      } else if (inlineAction.type === "newFile") {
        const sep = inlineAction.parentPath.includes("/") ? "/" : "\\";
        const newPath = inlineAction.parentPath + sep + trimmed;
        await fs.createFile(newPath, "");
        setSelectedPath(newPath);
        setFileContent("");
        setEditContent("");
        setIsDirty(false);
      } else if (inlineAction.type === "newFolder") {
        const sep = inlineAction.parentPath.includes("/") ? "/" : "\\";
        const newPath = inlineAction.parentPath + sep + trimmed;
        await fs.createFolder(newPath);
      }
      await refreshTree();
    } catch (e: any) {
      setActionError(e.message || "An error occurred.");
    }

    setInlineAction({ type: "none" });
  };

  // ── Drag & drop move ────────────────────────────────────────────────────────

  const handleMoveNode = useCallback(async (sourcePath: string, targetFolderPath: string) => {
    if (sourcePath === targetFolderPath) return;
    // Ne engedjük hogy mappát saját almappájába ejtsen
    if (targetFolderPath.startsWith(sourcePath + "/") || targetFolderPath.startsWith(sourcePath + "\\")) return;

    const sep = sourcePath.includes("/") ? "/" : "\\";
    const name = sourcePath.split(/[\\/]/).pop()!;
    const newPath = targetFolderPath + sep + name;

    if (newPath === sourcePath) return;

    try {
      await fs.renameFile(sourcePath, newPath);
      if (selectedPath === sourcePath) setSelectedPath(newPath);
      await refreshTree();
    } catch {
      // renameFile nem működött (mappa), próbáljuk renameFolder-rel
      try {
        await fs.renameFolder(sourcePath, newPath);
        await refreshTree();
      } catch (e: any) {
        setActionError(e.message || "Move failed.");
      }
    }
  }, [fs, selectedPath, setSelectedPath, refreshTree]);

  return {
    inlineAction,
    setInlineAction,
    actionError,
    setActionError,
    refreshTree,
    handleContextAction,
    handleInlineConfirm,
    handleMoveNode,
  };
}