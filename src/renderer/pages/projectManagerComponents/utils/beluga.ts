import {
  BELUGA_JSON,
  LEGACY_MEMORIES_FILE,
  LEGACY_PACKAGES_FILE,
  LEGACY_PROJECT_FILE,
  createBelugaConfig,
  type BelugaProjectConfig,
} from "../../../../helper/beluga-project";
import type { ProjectTemplateId } from "../../../../helper/project-templates";

const getFs = () => (window as any).fs;

async function readJsonFile<T>(
  projectPath: string,
  fileName: string,
): Promise<T | null> {
  const fs = getFs();
  try {
    const filePath = await fs.pathJoin(projectPath, fileName);
    const content: string | null = await fs.readFile(filePath);
    if (!content) return null;
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

async function migrateLegacyConfig(
  projectPath: string,
  projectName: string,
): Promise<BelugaProjectConfig | null> {
  const legacyProject = await readJsonFile<{
    name?: string;
    template?: ProjectTemplateId;
    createdAt?: string;
    version?: number;
  }>(projectPath, LEGACY_PROJECT_FILE);

  const legacyMemories = await readJsonFile<{ ids?: string[] }>(
    projectPath,
    LEGACY_MEMORIES_FILE,
  );
  const legacyPackages = await readJsonFile<{ ids?: string[] }>(
    projectPath,
    LEGACY_PACKAGES_FILE,
  );

  if (!legacyProject && !legacyMemories && !legacyPackages) {
    return null;
  }

  return {
    version: 1,
    name: legacyProject?.name ?? projectName,
    template: legacyProject?.template ?? "empty",
    createdAt: legacyProject?.createdAt ?? new Date().toISOString(),
    memories: Array.isArray(legacyMemories?.ids) ? legacyMemories.ids : [],
    packages: Array.isArray(legacyPackages?.ids) ? legacyPackages.ids : [],
    skills: [],
  };
}

export async function readBelugaConfig(
  projectPath: string,
  projectName = "",
): Promise<BelugaProjectConfig | null> {
  const existing = await readJsonFile<BelugaProjectConfig>(
    projectPath,
    BELUGA_JSON,
  );

  if (existing?.version === 1 && existing.name) {
    return {
      ...createBelugaConfig(existing.name, existing.template ?? "empty"),
      ...existing,
      memories: Array.isArray(existing.memories) ? existing.memories : [],
      packages: Array.isArray(existing.packages) ? existing.packages : [],
      skills: Array.isArray(existing.skills) ? existing.skills : [],
    };
  }

  const migrated = await migrateLegacyConfig(projectPath, projectName);
  if (migrated) {
    await writeBelugaConfig(projectPath, migrated);
  }

  return migrated;
}

export async function writeBelugaConfig(
  projectPath: string,
  config: BelugaProjectConfig,
): Promise<void> {
  const fs = getFs();
  const filePath = await fs.pathJoin(projectPath, BELUGA_JSON);
  await fs.writeFile(filePath, JSON.stringify(config, null, 2));
}

export async function updateBelugaConfig(
  projectPath: string,
  projectName: string,
  patch: Partial<Pick<BelugaProjectConfig, "memories" | "packages" | "skills" | "template">>,
): Promise<BelugaProjectConfig> {
  const current =
    (await readBelugaConfig(projectPath, projectName)) ??
    createBelugaConfig(projectName, "empty");

  const next: BelugaProjectConfig = {
    ...current,
    ...patch,
    memories: patch.memories ?? current.memories,
    packages: patch.packages ?? current.packages,
    skills: patch.skills ?? current.skills,
  };

  await writeBelugaConfig(projectPath, next);
  return next;
}

export async function getLinkedMemoryIds(projectPath: string): Promise<string[]> {
  const config = await readBelugaConfig(projectPath);
  return config?.memories ?? [];
}

export async function saveLinkedMemoryIds(
  projectPath: string,
  ids: string[],
  projectName = "",
): Promise<void> {
  await updateBelugaConfig(projectPath, projectName, { memories: ids });
}

export async function getLinkedPackageIds(projectPath: string): Promise<string[]> {
  const config = await readBelugaConfig(projectPath);
  return config?.packages ?? [];
}

export async function saveLinkedPackageIds(
  projectPath: string,
  ids: string[],
  projectName = "",
): Promise<void> {
  await updateBelugaConfig(projectPath, projectName, { packages: ids });
}

export async function getLinkedSkillIds(projectPath: string): Promise<string[]> {
  const config = await readBelugaConfig(projectPath);
  return config?.skills ?? [];
}

export async function saveLinkedSkillIds(
  projectPath: string,
  ids: string[],
  projectName = "",
): Promise<void> {
  await updateBelugaConfig(projectPath, projectName, { skills: ids });
}

export { BELUGA_JSON };