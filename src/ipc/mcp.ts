import { ipcMain } from "electron";
import path from "node:path";
import fsPromises from "node:fs/promises";
import { DEFAULT_FILES } from "../helper/default-files";
import { BELUGA_JSON, type BelugaProjectConfig } from "../helper/beluga-project";
import type { MainIpcContext } from "./context";

async function readBelugaLinks(projectPath: string): Promise<{
  memoryIds: string[];
  skillIds: string[];
}> {
  try {
    const content = await fsPromises.readFile(
      path.join(projectPath, BELUGA_JSON),
      "utf-8",
    );
    const config = JSON.parse(content) as BelugaProjectConfig;
    return {
      memoryIds: Array.isArray(config.memories) ? config.memories : [],
      skillIds: Array.isArray(config.skills) ? config.skills : [],
    };
  } catch {
    try {
      const memoriesPath = path.join(projectPath, ".memories.json");
      const content = await fsPromises.readFile(memoriesPath, "utf-8");
      const parsed = JSON.parse(content);
      return {
        memoryIds: Array.isArray(parsed?.ids) ? parsed.ids : [],
        skillIds: [],
      };
    } catch {
      return { memoryIds: [], skillIds: [] };
    }
  }
}

export function registerMcpIpc(ctx: MainIpcContext) {
  ipcMain.handle("mcp:project-list", async () => {
    const projectsDir = await ctx.getProjectsDir();
    const dirs = await fsPromises.readdir(projectsDir);
    const projects = [];

    for (const dir of dirs) {
      const dirPath = path.join(projectsDir, dir);
      const stat = await fsPromises.stat(dirPath).catch(() => null);
      if (!stat?.isDirectory()) continue;

      const entries = await fsPromises
        .readdir(dirPath)
        .catch(() => [] as string[]);
      const fileCount = (
        await Promise.all(
          entries.map(async (e) => {
            const s = await fsPromises
              .stat(path.join(dirPath, e))
              .catch(() => null);
            return s && !s.isDirectory() ? 1 : 0;
          }),
        )
      ).reduce((a, b) => a + b, 0 as number);

      projects.push({
        name: dir,
        path: dirPath,
        fileCount,
        createdAt: stat.mtime.toISOString(),
      });
    }

    return { projects };
  });

  ipcMain.handle(
    "mcp:project-open",
    async (_event, { project_name }: { project_name: string }) => {
      const projectPath = await ctx.resolveProjectPath(project_name);
      const stat = await fsPromises.stat(projectPath);
      if (!stat.isDirectory())
        throw new Error(`Nem létező projekt: ${project_name}`);

      const tree = await ctx.treeText(projectPath);

      const { memoryIds, skillIds } = await readBelugaLinks(projectPath);

      return {
        name: project_name,
        path: projectPath,
        tree: tree || "(üres projekt)",
        linkedIds: memoryIds,
        linkedSkillIds: skillIds,
      };
    },
  );

  ipcMain.handle(
    "mcp:project-create",
    async (_event, { project_name }: { project_name: string }) => {
      if (!/^[a-zA-Z0-9_\-]+$/.test(project_name)) {
        throw new Error(
          "Érvénytelen projekt név. Csak betűk, számok, - és _ megengedett.",
        );
      }
      const projectPath = await ctx.resolveProjectPath(project_name);
      await fsPromises.mkdir(projectPath, { recursive: true });
      for (const f of DEFAULT_FILES) {
        await fsPromises.writeFile(
          path.join(projectPath, f.name),
          f.content,
          "utf-8",
        );
      }
    },
  );

  ipcMain.handle(
    "mcp:project-delete",
    async (_event, { project_name }: { project_name: string }) => {
      const projectPath = await ctx.resolveProjectPath(project_name);
      await fsPromises.rm(projectPath, { recursive: true, force: true });
    },
  );

  ipcMain.handle(
    "mcp:project-rename",
    async (
      _event,
      { old_name, new_name }: { old_name: string; new_name: string },
    ) => {
      if (!/^[a-zA-Z0-9_\-]+$/.test(new_name))
        throw new Error("Érvénytelen projekt név.");
      const oldPath = await ctx.resolveProjectPath(old_name);
      const newPath = await ctx.resolveProjectPath(new_name);
      await fsPromises.rename(oldPath, newPath);
    },
  );

  ipcMain.handle(
    "mcp:file-read",
    async (
      _event,
      { project_name, file_path }: { project_name: string; file_path: string },
    ) => {
      const resolved = await ctx.resolveFilePath(project_name, file_path);
      const content = await fsPromises.readFile(resolved, "utf-8");
      return { content, path: resolved };
    },
  );

  ipcMain.handle(
    "mcp:file-write",
    async (
      _event,
      {
        project_name,
        file_path,
        content,
      }: { project_name: string; file_path: string; content: string },
    ) => {
      const resolved = await ctx.resolveFilePath(project_name, file_path);
      const exists = await fsPromises
        .stat(resolved)
        .then(() => true)
        .catch(() => false);
      await fsPromises.mkdir(path.dirname(resolved), { recursive: true });
      await fsPromises.writeFile(resolved, content, "utf-8");
      return { path: resolved, created: !exists };
    },
  );

  ipcMain.handle(
    "mcp:file-delete",
    async (
      _event,
      { project_name, file_path }: { project_name: string; file_path: string },
    ) => {
      const resolved = await ctx.resolveFilePath(project_name, file_path);
      await fsPromises.unlink(resolved);
      return { path: resolved };
    },
  );

  ipcMain.handle(
    "mcp:file-rename",
    async (
      _event,
      {
        project_name,
        old_path,
        new_path,
      }: { project_name: string; old_path: string; new_path: string },
    ) => {
      const resolvedOld = await ctx.resolveFilePath(project_name, old_path);
      const resolvedNew = await ctx.resolveFilePath(project_name, new_path);
      await fsPromises.mkdir(path.dirname(resolvedNew), { recursive: true });
      await fsPromises.rename(resolvedOld, resolvedNew);
      return { old_path: resolvedOld, new_path: resolvedNew };
    },
  );

  ipcMain.handle(
    "mcp:folder-create",
    async (
      _event,
      {
        project_name,
        folder_path,
      }: { project_name: string; folder_path: string },
    ) => {
      const resolved = await ctx.resolveFilePath(project_name, folder_path);
      await fsPromises.mkdir(resolved, { recursive: true });
      return { path: resolved };
    },
  );

  ipcMain.handle(
    "mcp:folder-delete",
    async (
      _event,
      {
        project_name,
        folder_path,
      }: { project_name: string; folder_path: string },
    ) => {
      const resolved = await ctx.resolveFilePath(project_name, folder_path);
      await fsPromises.rm(resolved, { recursive: true, force: true });
      return { path: resolved };
    },
  );

  ipcMain.handle(
    "mcp:folder-rename",
    async (
      _event,
      {
        project_name,
        old_path,
        new_path,
      }: { project_name: string; old_path: string; new_path: string },
    ) => {
      const resolvedOld = await ctx.resolveFilePath(project_name, old_path);
      const resolvedNew = await ctx.resolveFilePath(project_name, new_path);
      await fsPromises.rename(resolvedOld, resolvedNew);
      return { old_path: resolvedOld, new_path: resolvedNew };
    },
  );
}