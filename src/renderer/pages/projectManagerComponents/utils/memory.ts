import { MemoryFragment, FileTreeNode } from "../types";
import { BELUGA_JSON } from "./beluga";

export {
  getLinkedMemoryIds,
  saveLinkedMemoryIds,
} from "./beluga";

export const MEMORY_ENTRIES_KEY = "memwal-entries-v1";

const HIDDEN_PROJECT_FILES = new Set([
  BELUGA_JSON,
  ".memories.json",
  ".packages.json",
  ".beluga-project.json",
]);

export function loadMemoryFragments(): MemoryFragment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MEMORY_ENTRIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((e: any) => ({
      id: e.id,
      label: e.label,
      network: e.network,
    }));
  } catch {
    return [];
  }
}

export function filterHiddenProjectFiles(nodes: FileTreeNode[]): FileTreeNode[] {
  return nodes
    .filter((n) => !HIDDEN_PROJECT_FILES.has(n.name))
    .map((n) =>
      n.type === "folder" && n.children
        ? { ...n, children: filterHiddenProjectFiles(n.children) }
        : n,
    );
}

/** @deprecated Use filterHiddenProjectFiles */
export const filterHiddenMemoryFile = filterHiddenProjectFiles;