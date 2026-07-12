import { app } from "electron";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import type { SkillCatalogEntry, SkillCategory } from "./skills-catalog";

const WALRUS_SKILL_DIRS = [
  "walrus-overview",
  "walrus-memory",
  "walrus-troubleshooting",
  "walrus-ts-sdk",
  "walrus-http-api",
  "walrus-cli",
  "walrus-storage-costs",
  "walrus-quilts",
  "walrus-move-integration",
  "walrus-sites",
  "walrus-sites/publishing",
  "walrus-sites/portal",
  "walrus-data-security",
  "walrus-blob-lifecycle",
] as const;

const ACCENT_BY_ID: Record<string, string> = {
  "walrus-memory": "#6c63ff",
  "walrus-overview": "#9d97ff",
  "walrus-troubleshooting": "#8888a0",
  "walrus-ts-sdk": "#4ca3ff",
  "walrus-http-api": "#4ca3ff",
  "walrus-cli": "#4ca3ff",
  "walrus-storage-costs": "#00d4aa",
  "walrus-quilts": "#00d4aa",
  "walrus-blob-lifecycle": "#00d4aa",
  "walrus-move-integration": "#ffb347",
  "walrus-data-security": "#ffb347",
  "walrus-sites": "#ff6b9d",
  "walrus-sites-publishing": "#ff6b9d",
  "walrus-sites-portal": "#ff6b9d",
};

let cachedCatalog: SkillCatalogEntry[] | null = null;

function resolveWalrusSkillsRoot(): string {
  const candidates = [
    path.join(process.cwd(), "vendor", "walrus-skills"),
    path.join(app.getAppPath(), "vendor", "walrus-skills"),
    path.join(process.resourcesPath, "walrus-skills"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

function parseFrontmatter(raw: string): {
  meta: Record<string, string>;
  body: string;
} {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { meta: {}, body: raw.trim() };
  }

  const meta: Record<string, string> = {};
  let currentKey: string | null = null;
  const valueLines: string[] = [];

  const flush = () => {
    if (!currentKey) return;
    meta[currentKey] = valueLines.join(" ").trim();
    valueLines.length = 0;
  };

  for (const line of match[1].split("\n")) {
    const keyMatch = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (keyMatch && !/^\s/.test(line)) {
      flush();
      currentKey = keyMatch[1];
      const inline = keyMatch[2].trim();
      if (inline === ">" || inline === "|" || inline === "") {
        continue;
      }
      meta[currentKey] = inline;
      currentKey = null;
      continue;
    }
    if (currentKey) {
      valueLines.push(line.trim());
    }
  }
  flush();

  return { meta: meta, body: match[2].trim() };
}

async function listReferenceFiles(skillDir: string): Promise<string[]> {
  const entries = await fsPromises.readdir(skillDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "SKILL.md")
    .map((entry) => entry.name)
    .sort();
}

async function loadSkillFromDir(
  root: string,
  relDir: string,
): Promise<SkillCatalogEntry | null> {
  const skillDir = path.join(root, relDir);
  const skillPath = path.join(skillDir, "SKILL.md");

  try {
    const raw = await fsPromises.readFile(skillPath, "utf-8");
    const { meta, body } = parseFrontmatter(raw);
    const id = meta.name?.trim();
    if (!id) return null;

    const refs = await listReferenceFiles(skillDir);
    const refBlocks: string[] = [];
    for (const ref of refs) {
      const refContent = await fsPromises.readFile(
        path.join(skillDir, ref),
        "utf-8",
      );
      refBlocks.push(`\n\n---\n\n## Reference: ${ref}\n\n${refContent.trim()}`);
    }

    const description =
      meta.description?.trim() ||
      `Official Walrus agent skill (${id}).`;

    const titleMatch = body.match(/^#\s+(.+)$/m);
    const displayName =
      titleMatch?.[1]?.trim() ||
      id
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");

    return {
      id,
      name: displayName,
      description,
      category: "walrus" as SkillCategory,
      accent: ACCENT_BY_ID[id] ?? "#6c63ff",
      content: `${body}${refBlocks.join("")}`,
      source: "walrus-official",
    };
  } catch {
    return null;
  }
}

export async function loadWalrusSkillsCatalog(): Promise<SkillCatalogEntry[]> {
  if (cachedCatalog) return cachedCatalog;

  const root = resolveWalrusSkillsRoot();
  const entries: SkillCatalogEntry[] = [];

  for (const relDir of WALRUS_SKILL_DIRS) {
    const entry = await loadSkillFromDir(root, relDir);
    if (entry) entries.push(entry);
  }

  cachedCatalog = entries;
  return entries;
}

export function clearWalrusSkillsCache(): void {
  cachedCatalog = null;
}

export async function getWalrusSkillEntry(
  id: string,
): Promise<SkillCatalogEntry | undefined> {
  const catalog = await loadWalrusSkillsCatalog();
  return catalog.find((entry) => entry.id === id);
}