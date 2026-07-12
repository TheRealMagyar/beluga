import { app } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import {
  getBuiltinCatalogEntry,
  listBuiltinCatalog,
  type SkillCatalogEntry,
} from "./skills-catalog";
import {
  getWalrusSkillEntry,
  loadWalrusSkillsCatalog,
} from "./walrus-skills-loader";

export interface SkillRecord {
  id: string;
  name: string;
  description: string;
  content: string;
  source: "builtin" | "custom";
  catalogId: string | null;
  createdAt: number;
  updatedAt: number;
}

interface SkillsRegistry {
  skills: Record<string, SkillRecord>;
}

const SKILL_ID_RE = /^[a-z][a-z0-9-]{1,62}[a-z0-9]$/;

export function isValidSkillId(id: string): boolean {
  return SKILL_ID_RE.test(id);
}

export function slugifySkillName(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  if (!slug || !SKILL_ID_RE.test(slug)) {
    return `skill-${Date.now().toString(36)}`;
  }
  return slug;
}

async function getSkillsDir(): Promise<string> {
  const dir = path.join(app.getPath("userData"), "skills");
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function getRegistryPath(): Promise<string> {
  return path.join(await getSkillsDir(), "registry.json");
}

async function readRegistry(): Promise<SkillsRegistry> {
  try {
    const raw = await fs.readFile(await getRegistryPath(), "utf-8");
    return JSON.parse(raw) as SkillsRegistry;
  } catch {
    return { skills: {} };
  }
}

async function writeRegistry(registry: SkillsRegistry): Promise<void> {
  await fs.writeFile(
    await getRegistryPath(),
    JSON.stringify(registry, null, 2),
    "utf-8",
  );
}

export async function listSkillCatalog() {
  const walrus = await loadWalrusSkillsCatalog();
  const builtin = listBuiltinCatalog();
  const seen = new Set<string>();
  const merged = [];

  for (const entry of [...walrus, ...builtin]) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    merged.push(entry);
  }

  return merged;
}

async function resolveCatalogEntry(
  catalogId: string,
): Promise<SkillCatalogEntry | undefined> {
  return (
    (await getWalrusSkillEntry(catalogId)) ??
    getBuiltinCatalogEntry(catalogId)
  );
}

export async function listSkills(): Promise<SkillRecord[]> {
  const registry = await readRegistry();
  return Object.values(registry.skills).sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );
}

export async function getSkill(id: string): Promise<SkillRecord | null> {
  const registry = await readRegistry();
  return registry.skills[id] ?? null;
}

export async function getSkillsByIds(ids: string[]): Promise<SkillRecord[]> {
  const registry = await readRegistry();
  return ids
    .map((id) => registry.skills[id])
    .filter((skill): skill is SkillRecord => Boolean(skill));
}

function catalogToRecord(entry: SkillCatalogEntry): SkillRecord {
  const now = Date.now();
  return {
    id: entry.id,
    name: entry.name,
    description: entry.description,
    content: entry.content,
    source: "builtin",
    catalogId: entry.id,
    createdAt: now,
    updatedAt: now,
  };
}

export async function importSkillFromCatalog(
  catalogId: string,
): Promise<SkillRecord> {
  const entry = await resolveCatalogEntry(catalogId);
  if (!entry) throw new Error(`Unknown skill template: ${catalogId}`);

  const registry = await readRegistry();
  if (registry.skills[catalogId]) {
    return registry.skills[catalogId];
  }

  const record = catalogToRecord(entry);
  registry.skills[catalogId] = record;
  await writeRegistry(registry);
  return record;
}

export async function createSkill(params: {
  name: string;
  description: string;
  content: string;
  id?: string;
}): Promise<SkillRecord> {
  const name = params.name.trim();
  const description = params.description.trim();
  const content = params.content.trim();
  if (!name) throw new Error("Skill name is required.");
  if (!description) throw new Error("Skill description is required.");
  if (!content) throw new Error("Skill content is required.");

  const registry = await readRegistry();
  let id = params.id?.trim() || slugifySkillName(name);
  if (!isValidSkillId(id)) {
    throw new Error(
      "Skill id must be 3-64 chars, lowercase letters, digits, and hyphens.",
    );
  }
  if (registry.skills[id]) {
    id = `${id}-${Date.now().toString(36).slice(-4)}`;
  }

  const now = Date.now();
  const record: SkillRecord = {
    id,
    name,
    description,
    content,
    source: "custom",
    catalogId: null,
    createdAt: now,
    updatedAt: now,
  };
  registry.skills[id] = record;
  await writeRegistry(registry);
  return record;
}

export async function updateSkill(
  id: string,
  patch: Partial<Pick<SkillRecord, "name" | "description" | "content">>,
): Promise<SkillRecord> {
  const registry = await readRegistry();
  const current = registry.skills[id];
  if (!current) throw new Error(`Skill not found: ${id}`);

  const next: SkillRecord = {
    ...current,
    name: patch.name?.trim() || current.name,
    description: patch.description?.trim() || current.description,
    content: patch.content?.trim() || current.content,
    updatedAt: Date.now(),
  };
  registry.skills[id] = next;
  await writeRegistry(registry);
  return next;
}

export async function deleteSkill(id: string): Promise<void> {
  const registry = await readRegistry();
  if (!registry.skills[id]) throw new Error(`Skill not found: ${id}`);
  delete registry.skills[id];
  await writeRegistry(registry);
}

export function formatSkillMarkdown(skill: SkillRecord): string {
  return `---
name: ${skill.id}
description: ${skill.description}
---

${skill.content.trim()}
`;
}