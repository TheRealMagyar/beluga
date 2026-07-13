import { app } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import {
  isJobCancelled,
  JobCancelledError,
  registerJob,
  unregisterJob,
} from "./packages-job-manager";
import {
  createCustomPackage,
  deleteCustomPackage,
  listCustomPackages,
  listMergedCatalog,
  resolveCatalogEntry,
  updateCustomPackage,
  type CreateCustomPackageInput,
  type CustomPackageRecord,
  type UpdateCustomPackageInput,
} from "./custom-package-manager";
import type { PackageCatalogEntry } from "./package-catalog";
import { resolveNpmBinary, runNpmCommand } from "./command-binary";

export type {
  CreateCustomPackageInput,
  CustomPackageRecord,
  UpdateCustomPackageInput,
};
export {
  createCustomPackage,
  deleteCustomPackage,
  listCustomPackages,
  updateCustomPackage,
};

export interface InstalledPackageInfo {
  id: string;
  installedAt: number;
  updatedAt: number;
  versions: Record<string, string>;
  path: string;
}

interface PackageRegistry {
  packages: Record<string, InstalledPackageInfo>;
}

export interface NpmCliStatus {
  installed: boolean;
  version: string | null;
}

export async function getPackagesDir(): Promise<string> {
  const dir = path.join(app.getPath("userData"), "sui-packages");
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function getRegistryPath(): Promise<string> {
  const dir = await getPackagesDir();
  return path.join(dir, "registry.json");
}

async function readRegistry(): Promise<PackageRegistry> {
  try {
    const raw = await fs.readFile(await getRegistryPath(), "utf-8");
    return JSON.parse(raw) as PackageRegistry;
  } catch {
    return { packages: {} };
  }
}

async function writeRegistry(registry: PackageRegistry) {
  await fs.writeFile(
    await getRegistryPath(),
    JSON.stringify(registry, null, 2),
    "utf-8",
  );
}

export async function checkNpmCli(): Promise<NpmCliStatus> {
  try {
    const { stdout } = await runNpmCommand(["--version"], { timeout: 10_000 });
    return { installed: true, version: stdout.trim() };
  } catch {
    return { installed: false, version: null };
  }
}

export async function listCatalog(): Promise<PackageCatalogEntry[]> {
  return listMergedCatalog();
}

export async function listInstalled(): Promise<InstalledPackageInfo[]> {
  const registry = await readRegistry();
  return Object.values(registry.packages).sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );
}

async function readInstalledVersions(
  installDir: string,
  entry: PackageCatalogEntry,
): Promise<Record<string, string>> {
  const versions: Record<string, string> = {};
  const allDeps = {
    ...entry.dependencies,
    ...(entry.devDependencies ?? {}),
  };

  for (const dep of Object.keys(allDeps)) {
    try {
      const pkgJsonPath = path.join(installDir, "node_modules", dep, "package.json");
      const raw = await fs.readFile(pkgJsonPath, "utf-8");
      const parsed = JSON.parse(raw) as { version?: string };
      if (parsed.version) versions[dep] = parsed.version;
    } catch {
      // dependency may be nested or missing
    }
  }

  return versions;
}

function buildPackageJson(entry: PackageCatalogEntry) {
  return {
    name: `beluga-package-${entry.id}`,
    version: "1.0.0",
    private: true,
    description: entry.description,
    dependencies: entry.dependencies,
    devDependencies: entry.devDependencies ?? {},
  };
}

function catalogJobId(id: string) {
  return `catalog:${id}`;
}

async function runNpmInstall(cwd: string, jobId: string, update = false) {
  const npm = resolveNpmBinary();
  const args = update ? ["update"] : ["install"];
  const useDetached = process.platform !== "win32";

  await new Promise<void>((resolve, reject) => {
    const child = spawn(npm, args, {
      cwd,
      detached: useDetached,
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        npm_config_fund: "false",
        npm_config_audit: "false",
      },
    });

    registerJob(jobId, child);

    let stderr = "";
    let stdout = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.on("error", (err) => {
      unregisterJob(jobId);
      reject(err);
    });

    child.on("close", (code) => {
      unregisterJob(jobId);
      if (isJobCancelled(jobId)) {
        reject(new JobCancelledError(jobId));
        return;
      }
      if (code !== 0) {
        reject(
          new Error(
            [stderr, stdout].filter(Boolean).join("\n").trim() ||
              `npm exited with code ${code ?? "unknown"}`,
          ),
        );
        return;
      }
      resolve();
    });
  });
}

export async function installCatalogPackage(
  id: string,
): Promise<InstalledPackageInfo> {
  const entry = await resolveCatalogEntry(id);
  if (!entry) throw new Error(`Unknown package: ${id}`);

  const npm = await checkNpmCli();
  if (!npm.installed) {
    throw new Error(
      "npm is not installed. Install Node.js from https://nodejs.org",
    );
  }

  const baseDir = await getPackagesDir();
  const installDir = path.join(baseDir, id);
  await fs.mkdir(installDir, { recursive: true });
  await fs.writeFile(
    path.join(installDir, "package.json"),
    JSON.stringify(buildPackageJson(entry), null, 2),
    "utf-8",
  );

  try {
    await runNpmInstall(installDir, catalogJobId(id));
  } catch (err: any) {
    if (err instanceof JobCancelledError) {
      throw new Error("Package install cancelled.");
    }
    throw new Error(err?.message || "npm install failed.");
  }

  const now = Date.now();
  const versions = await readInstalledVersions(installDir, entry);
  const info: InstalledPackageInfo = {
    id,
    installedAt: now,
    updatedAt: now,
    versions,
    path: installDir,
  };

  const registry = await readRegistry();
  registry.packages[id] = info;
  await writeRegistry(registry);
  return info;
}

export async function updateCatalogPackage(
  id: string,
): Promise<InstalledPackageInfo> {
  const entry = await resolveCatalogEntry(id);
  if (!entry) throw new Error(`Unknown package: ${id}`);

  const registry = await readRegistry();
  const existing = registry.packages[id];
  if (!existing) {
    return installCatalogPackage(id);
  }

  const installDir = existing.path;
  await fs.writeFile(
    path.join(installDir, "package.json"),
    JSON.stringify(buildPackageJson(entry), null, 2),
    "utf-8",
  );

  try {
    await runNpmInstall(installDir, catalogJobId(id), true);
  } catch (err: any) {
    if (err instanceof JobCancelledError) {
      throw new Error("Package update cancelled.");
    }
    throw new Error(err?.message || "npm update failed.");
  }

  const versions = await readInstalledVersions(installDir, entry);
  const info: InstalledPackageInfo = {
    ...existing,
    updatedAt: Date.now(),
    versions,
  };
  registry.packages[id] = info;
  await writeRegistry(registry);
  return info;
}

export async function uninstallCatalogPackage(id: string): Promise<void> {
  const registry = await readRegistry();
  const existing = registry.packages[id];
  if (existing?.path) {
    await fs.rm(existing.path, { recursive: true, force: true });
  }
  delete registry.packages[id];
  await writeRegistry(registry);
}

export async function installPackagesToProject(
  projectPath: string,
  packageIds: string[],
): Promise<void> {
  const npm = await checkNpmCli();
  if (!npm.installed) {
    throw new Error("npm is not installed.");
  }

  const pkgPath = path.join(projectPath, "package.json");
  let pkg: {
    name: string;
    version: string;
    private: boolean;
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };

  try {
    pkg = JSON.parse(await fs.readFile(pkgPath, "utf-8"));
    pkg.dependencies ??= {};
    pkg.devDependencies ??= {};
  } catch {
    pkg = {
      name: path.basename(projectPath),
      version: "1.0.0",
      private: true,
      dependencies: {},
      devDependencies: {},
    };
  }

  const missing: string[] = [];
  for (const id of packageIds) {
    const entry = await resolveCatalogEntry(id);
    if (!entry) {
      missing.push(id);
      continue;
    }
    Object.assign(pkg.dependencies, entry.dependencies);
    if (entry.devDependencies) {
      Object.assign(pkg.devDependencies, entry.devDependencies);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Unknown package id(s): ${missing.join(", ")}`);
  }

  await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2), "utf-8");

  try {
    await runNpmInstall(projectPath);
  } catch (err: any) {
    const stderr = err?.stderr?.toString?.() ?? "";
    throw new Error(
      [err?.message, stderr].filter(Boolean).join("\n").trim() ||
        "Failed to install packages into project.",
    );
  }
}