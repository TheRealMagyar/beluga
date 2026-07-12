import { app } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import {
  getBuiltinCatalogEntry,
  listBuiltinCatalog,
  type PackageCatalogEntry,
  type PackageCategory,
} from "./package-catalog";

export interface CustomPackageRecord extends PackageCatalogEntry {
  source: "custom";
  createdAt: number;
  updatedAt: number;
}

export interface CreateCustomPackageInput {
  name: string;
  description: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  category?: PackageCategory;
  docsUrl?: string;
  accent?: string;
  id?: string;
}

export interface UpdateCustomPackageInput {
  name?: string;
  description?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  category?: PackageCategory;
  docsUrl?: string;
  accent?: string;
}

interface CustomPackageRegistry {
  packages: Record<string, CustomPackageRecord>;
}

const CUSTOM_PACKAGE_ID_RE = /^[a-z][a-z0-9-]{1,62}[a-z0-9]$/;

export function isValidCustomPackageId(id: string): boolean {
  return CUSTOM_PACKAGE_ID_RE.test(id);
}

export function slugifyPackageName(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  if (!slug || !CUSTOM_PACKAGE_ID_RE.test(slug)) {
    return `custom-${Date.now().toString(36)}`;
  }
  return slug;
}

function buildInstallCommand(
  dependencies: Record<string, string>,
  devDependencies: Record<string, string>,
): string {
  const prod = Object.keys(dependencies);
  const dev = Object.keys(devDependencies);
  if (prod.length && dev.length) {
    return `npm i ${prod.join(" ")} && npm i -D ${dev.join(" ")}`;
  }
  if (prod.length) return `npm i ${prod.join(" ")}`;
  if (dev.length) return `npm i -D ${dev.join(" ")}`;
  return "npm install";
}

function normalizeDeps(input?: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, version] of Object.entries(input ?? {})) {
    const pkg = name.trim();
    const ver = (version ?? "latest").trim() || "latest";
    if (pkg) out[pkg] = ver;
  }
  return out;
}

function validateDeps(deps: Record<string, string>, label: string) {
  for (const name of Object.keys(deps)) {
    if (!/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i.test(name)) {
      throw new Error(`Invalid ${label} package name: ${name}`);
    }
  }
}

async function getCustomRegistryPath(): Promise<string> {
  const dir = path.join(app.getPath("userData"), "sui-packages");
  await fs.mkdir(dir, { recursive: true });
  return path.join(dir, "custom-registry.json");
}

async function readCustomRegistry(): Promise<CustomPackageRegistry> {
  try {
    const raw = await fs.readFile(await getCustomRegistryPath(), "utf-8");
    return JSON.parse(raw) as CustomPackageRegistry;
  } catch {
    return { packages: {} };
  }
}

async function writeCustomRegistry(registry: CustomPackageRegistry): Promise<void> {
  await fs.writeFile(
    await getCustomRegistryPath(),
    JSON.stringify(registry, null, 2),
    "utf-8",
  );
}

export async function listCustomPackages(): Promise<CustomPackageRecord[]> {
  const registry = await readCustomRegistry();
  return Object.values(registry.packages).sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );
}

export async function getCustomPackage(
  id: string,
): Promise<CustomPackageRecord | null> {
  const registry = await readCustomRegistry();
  return registry.packages[id] ?? null;
}

export async function listMergedCatalog(): Promise<PackageCatalogEntry[]> {
  const custom = await listCustomPackages();
  const builtin = listBuiltinCatalog();
  const seen = new Set<string>();
  const merged: PackageCatalogEntry[] = [];

  for (const entry of [...builtin, ...custom]) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    merged.push(entry);
  }

  return merged;
}

export async function resolveCatalogEntry(
  id: string,
): Promise<PackageCatalogEntry | undefined> {
  return getBuiltinCatalogEntry(id) ?? (await getCustomPackage(id)) ?? undefined;
}

function assertHasDependencies(
  dependencies: Record<string, string>,
  devDependencies: Record<string, string>,
) {
  if (
    Object.keys(dependencies).length === 0 &&
    Object.keys(devDependencies).length === 0
  ) {
    throw new Error("Add at least one npm dependency or devDependency.");
  }
}

export async function createCustomPackage(
  input: CreateCustomPackageInput,
): Promise<CustomPackageRecord> {
  const name = input.name?.trim();
  if (!name) throw new Error("Package name is required.");

  const description = input.description?.trim();
  if (!description) throw new Error("Description is required.");

  const dependencies = normalizeDeps(input.dependencies);
  const devDependencies = normalizeDeps(input.devDependencies);
  validateDeps(dependencies, "dependency");
  validateDeps(devDependencies, "devDependency");
  assertHasDependencies(dependencies, devDependencies);

  const registry = await readCustomRegistry();
  let id = input.id?.trim() || slugifyPackageName(name);
  if (!isValidCustomPackageId(id)) {
    throw new Error(
      "Package id must be lowercase letters, numbers, and hyphens (2–64 chars).",
    );
  }
  if (getBuiltinCatalogEntry(id)) {
    throw new Error(`Id "${id}" is reserved by a built-in catalog package.`);
  }
  if (registry.packages[id]) {
    id = `${id}-${Date.now().toString(36).slice(-4)}`;
  }

  const now = Date.now();
  const record: CustomPackageRecord = {
    id,
    name,
    description,
    category: input.category ?? "tooling",
    dependencies,
    devDependencies:
      Object.keys(devDependencies).length > 0 ? devDependencies : undefined,
    docsUrl: input.docsUrl?.trim() || "",
    installCommand: buildInstallCommand(dependencies, devDependencies),
    accent: input.accent?.trim() || "#ff9f43",
    source: "custom",
    createdAt: now,
    updatedAt: now,
  };

  registry.packages[id] = record;
  await writeCustomRegistry(registry);
  return record;
}

export async function updateCustomPackage(
  id: string,
  patch: UpdateCustomPackageInput,
): Promise<CustomPackageRecord> {
  const registry = await readCustomRegistry();
  const existing = registry.packages[id];
  if (!existing) throw new Error(`Custom package not found: ${id}`);

  const name = patch.name !== undefined ? patch.name.trim() : existing.name;
  const description =
    patch.description !== undefined
      ? patch.description.trim()
      : existing.description;
  if (!name) throw new Error("Package name is required.");
  if (!description) throw new Error("Description is required.");

  const dependencies =
    patch.dependencies !== undefined
      ? normalizeDeps(patch.dependencies)
      : existing.dependencies;
  const devDependencies =
    patch.devDependencies !== undefined
      ? normalizeDeps(patch.devDependencies)
      : (existing.devDependencies ?? {});
  validateDeps(dependencies, "dependency");
  validateDeps(devDependencies, "devDependency");
  assertHasDependencies(dependencies, devDependencies);

  const updated: CustomPackageRecord = {
    ...existing,
    name,
    description,
    category: patch.category ?? existing.category,
    dependencies,
    devDependencies:
      Object.keys(devDependencies).length > 0 ? devDependencies : undefined,
    docsUrl:
      patch.docsUrl !== undefined ? patch.docsUrl.trim() : existing.docsUrl,
    accent: patch.accent?.trim() || existing.accent,
    installCommand: buildInstallCommand(dependencies, devDependencies),
    updatedAt: Date.now(),
  };

  registry.packages[id] = updated;
  await writeCustomRegistry(registry);
  return updated;
}

export async function deleteCustomPackage(id: string): Promise<void> {
  const registry = await readCustomRegistry();
  if (!registry.packages[id]) {
    throw new Error(`Custom package not found: ${id}`);
  }
  delete registry.packages[id];
  await writeCustomRegistry(registry);
}