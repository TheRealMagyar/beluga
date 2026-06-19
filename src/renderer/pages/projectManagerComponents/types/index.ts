// ── Types ─────────────────────────────────────────────────────────────────────

export interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "folder";
  size?: number;
  mtime?: string;
  children?: FileTreeNode[];
}

export interface SelectedProject {
  name: string;
  path: string;
  tree: FileTreeNode[];
}

export interface ProjectFile {
  name: string;
  size: number;
  modified: string;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  createdAt: string;
  files: ProjectFile[];
  linkedMemoryIds: string[];
}

export interface MemoryFragment {
  id: string;
  label: string;
  network: "mainnet" | "testnet";
}

export type Modal =
  | { type: "none" }
  | { type: "newProject" }
  | { type: "rename"; project: Project }
  | { type: "delete"; project: Project }
  | { type: "files"; project: Project };

export type ContextMenu =
  | { type: "none" }
  | { type: "node"; node: FileTreeNode; x: number; y: number };

export type InlineAction =
  | { type: "none" }
  | { type: "renameFile"; node: FileTreeNode }
  | { type: "renameFolder"; node: FileTreeNode }
  | { type: "newFile"; parentPath: string }
  | { type: "newFolder"; parentPath: string };
