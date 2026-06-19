import { MemoryFragment, FileTreeNode } from "../types";

// ── Constants ─────────────────────────────────────────────────────────────────

export const MEMORIES_FILE = ".memories.json";
export const MEMORY_ENTRIES_KEY = "memwal-entries-v1";

// ── Helpers ───────────────────────────────────────────────────────────────────

const getFs = () => (window as any).fs;

export function loadMemoryFragments(): MemoryFragment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MEMORY_ENTRIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((e: any) => ({ id: e.id, label: e.label, network: e.network }));
  } catch {
    return [];
  }
}

export async function getLinkedMemoryIds(projectPath: string): Promise<string[]> {
  const fs = getFs();
  try {
    const filePath = await fs.pathJoin(projectPath, MEMORIES_FILE);
    const content: string | null = await fs.readFile(filePath);
    if (!content) return [];
    const parsed = JSON.parse(content);
    return Array.isArray(parsed?.ids) ? parsed.ids : [];
  } catch {
    return [];
  }
}

export async function saveLinkedMemoryIds(projectPath: string, ids: string[]): Promise<void> {
  const fs = getFs();
  const filePath = await fs.pathJoin(projectPath, MEMORIES_FILE);
  await fs.writeFile(filePath, JSON.stringify({ ids }, null, 2));
}

export function filterHiddenMemoryFile(nodes: FileTreeNode[]): FileTreeNode[] {
  return nodes
    .filter((n) => n.name !== MEMORIES_FILE)
    .map((n) =>
      n.type === "folder" && n.children
        ? { ...n, children: filterHiddenMemoryFile(n.children) }
        : n
    );
}
