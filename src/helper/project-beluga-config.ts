import fs from "node:fs/promises";
import path from "node:path";
import {
  BELUGA_JSON,
  createBelugaConfig,
  type BelugaProjectConfig,
} from "./beluga-project";

async function readConfig(projectPath: string): Promise<BelugaProjectConfig> {
  try {
    const raw = await fs.readFile(
      path.join(projectPath, BELUGA_JSON),
      "utf-8",
    );
    const parsed = JSON.parse(raw) as BelugaProjectConfig;
    return {
      ...createBelugaConfig(parsed.name ?? path.basename(projectPath), parsed.template ?? "empty"),
      ...parsed,
      memories: Array.isArray(parsed.memories) ? parsed.memories : [],
      packages: Array.isArray(parsed.packages) ? parsed.packages : [],
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
    };
  } catch {
    const name = path.basename(projectPath);
    return createBelugaConfig(name, "empty");
  }
}

async function writeConfig(
  projectPath: string,
  config: BelugaProjectConfig,
): Promise<void> {
  await fs.writeFile(
    path.join(projectPath, BELUGA_JSON),
    JSON.stringify(config, null, 2),
    "utf-8",
  );
}

export async function getProjectPackageIds(
  projectPath: string,
): Promise<string[]> {
  const config = await readConfig(projectPath);
  return config.packages;
}

export async function linkPackagesToProject(
  projectPath: string,
  packageIds: string[],
): Promise<BelugaProjectConfig> {
  const config = await readConfig(projectPath);
  const merged = [...new Set([...config.packages, ...packageIds])];
  const next = { ...config, packages: merged };
  await writeConfig(projectPath, next);
  return next;
}

export async function unlinkPackagesFromProject(
  projectPath: string,
  packageIds: string[],
): Promise<BelugaProjectConfig> {
  const config = await readConfig(projectPath);
  const remove = new Set(packageIds);
  const next = {
    ...config,
    packages: config.packages.filter((id) => !remove.has(id)),
  };
  await writeConfig(projectPath, next);
  return next;
}

export async function linkGithubToProject(
  projectPath: string,
  github: NonNullable<BelugaProjectConfig["github"]>,
): Promise<BelugaProjectConfig> {
  const config = await readConfig(projectPath);
  const next = { ...config, github };
  await writeConfig(projectPath, next);
  return next;
}

export async function getProjectGithubLink(
  projectPath: string,
): Promise<BelugaProjectConfig["github"] | null> {
  const config = await readConfig(projectPath);
  return config.github ?? null;
}