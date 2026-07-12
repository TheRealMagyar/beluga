import { app } from "electron";
import path from "node:path";
import fsPromises from "node:fs/promises";
import type { FileTreeNode } from "./types";

export async function getProjectsDir(): Promise<string> {
  const base = app.getPath("userData");
  const dir = path.join(base, "projects");
  await fsPromises.mkdir(dir, { recursive: true });
  return dir;
}

export async function resolveProjectPath(projectName: string): Promise<string> {
  const dir = await getProjectsDir();
  const p = path.join(dir, projectName);
  if (!p.startsWith(dir)) throw new Error("Érvénytelen projekt név.");
  return p;
}

export async function resolveFilePath(
  projectName: string,
  filePath: string,
): Promise<string> {
  const projectPath = await resolveProjectPath(projectName);
  const resolved = path.isAbsolute(filePath)
    ? filePath
    : path.join(projectPath, filePath);
  if (!resolved.startsWith(projectPath)) {
    throw new Error("A fájlútvonal kimutat a projekt mappájából.");
  }
  return resolved;
}

export async function treeText(dirPath: string, prefix = ""): Promise<string> {
  const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });
  entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const lines: string[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const isLast = i === entries.length - 1;
    const connector = isLast ? "└── " : "├── ";
    const icon = entry.isDirectory() ? "📁 " : "";
    lines.push(`${prefix}${connector}${icon}${entry.name}`);
    if (entry.isDirectory()) {
      const childPrefix = prefix + (isLast ? "    " : "│   ");
      lines.push(await treeText(path.join(dirPath, entry.name), childPrefix));
    }
  }
  return lines.filter(Boolean).join("\n");
}

export async function buildTree(dirPath: string): Promise<FileTreeNode[]> {
  const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });
  const nodes: FileTreeNode[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      nodes.push({
        name: entry.name,
        path: fullPath,
        type: "folder",
        children: await buildTree(fullPath),
      });
    } else {
      const s = await fsPromises.stat(fullPath);
      nodes.push({
        name: entry.name,
        path: fullPath,
        type: "file",
        size: s.size,
        mtime: s.mtime.toISOString(),
      });
    }
  }

  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return nodes;
}