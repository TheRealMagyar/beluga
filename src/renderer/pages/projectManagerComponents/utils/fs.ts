import { Project, ProjectFile, SelectedProject } from "../types";
import { getLinkedMemoryIds } from "./memory";
import { getLinkedPackageIds } from "./packages";
import { getLinkedSkillIds } from "./beluga";
import { BELUGA_JSON } from "./beluga";
import {
  getProjectScaffold,
  type ProjectTemplateId,
} from "../../../../helper/project-templates";

// ── FS accessor ───────────────────────────────────────────────────────────────

export const getFs = () => (window as any).fs;

// ── Rekurzív fájlgyűjtő ───────────────────────────────────────────────────────

async function collectFilesRecursively(
  fs: any,
  dirPath: string,
): Promise<ProjectFile[]> {
  const entries = await fs.readdir(dirPath);
  const files: ProjectFile[] = [];

  for (const entry of entries) {
    if (
      entry === BELUGA_JSON ||
      entry === ".memories.json" ||
      entry === ".packages.json" ||
      entry === ".beluga-project.json"
    ) {
      continue;
    }
    const entryPath = await fs.pathJoin(dirPath, entry);
    const stat = await fs.stat(entryPath);
    if (stat.isDirectory) {
      const nested = await collectFilesRecursively(fs, entryPath);
      files.push(...nested);
    } else {
      files.push({ name: entry, size: stat.size, modified: stat.mtime });
    }
  }

  return files;
}

// ── Project CRUD ──────────────────────────────────────────────────────────────

export async function loadProjects(): Promise<Project[]> {
  const fs = getFs();
  if (!fs) throw new Error("fs API is not available.");

  const base = await fs.getAppPath();
  const projectsDir = await fs.pathJoin(base, "projects");
  try {
    await fs.mkdir(projectsDir);
  } catch {}

  const dirs = await fs.readdir(projectsDir);
  const projects: Project[] = [];

  for (const dir of dirs) {
    const dirPath = await fs.pathJoin(projectsDir, dir);
    const dirStat = await fs.stat(dirPath);
    if (!dirStat.isDirectory) continue;

    const files = await collectFilesRecursively(fs, dirPath);

    projects.push({
      id: dir,
      name: dir,
      path: dirPath,
      createdAt: dirStat.mtime,
      files,
      linkedMemoryIds: await getLinkedMemoryIds(dirPath),
      linkedPackageIds: await getLinkedPackageIds(dirPath),
      linkedSkillIds: await getLinkedSkillIds(dirPath),
    });
  }

  return projects;
}

async function writeScaffoldFile(
  fs: ReturnType<typeof getFs>,
  baseDir: string,
  relativePath: string,
  content: string,
) {
  const filePath = await fs.pathJoin(baseDir, relativePath);
  const parts = relativePath.split("/");
  if (parts.length > 1) {
    const parent = await fs.pathJoin(baseDir, ...parts.slice(0, -1));
    await fs.mkdir(parent);
  }
  await fs.writeFile(filePath, content);
}

export async function createProject(
  name: string,
  template: ProjectTemplateId = "empty",
): Promise<string> {
  const fs = getFs();
  const base = await fs.getAppPath();
  const dir = await fs.pathJoin(base, "projects", name);
  await fs.mkdir(dir);

  const scaffold = getProjectScaffold(template, name);
  for (const file of scaffold) {
    const content =
      typeof file.content === "function" ? file.content(name) : file.content;
    await writeScaffoldFile(fs, dir, file.path, content);
  }

  return dir;
}

export async function renameProject(
  oldName: string,
  newName: string,
): Promise<void> {
  const fs = getFs();
  const base = await fs.getAppPath();
  const oldPath = await fs.pathJoin(base, "projects", oldName);
  const newPath = await fs.pathJoin(base, "projects", newName);
  await fs.rename(oldPath, newPath);
}

export async function deleteProject(name: string): Promise<void> {
  const fs = getFs();
  const base = await fs.getAppPath();
  const dir = await fs.pathJoin(base, "projects", name);
  await fs.rmdir(dir);
}

export async function openProjectFolder(folderPath: string): Promise<void> {
  const fs = getFs();
  if (!fs?.openFolder) {
    throw new Error(
      "Opening folders is not supported (please update preload.ts).",
    );
  }
  await fs.openFolder(folderPath);
}

export const handleOpenFolder = async (folderPath: string) => {
  try {
    await openProjectFolder(folderPath);
  } catch (e: any) {
    console.log(e.message || "Failed to open the folder.");
  }
};