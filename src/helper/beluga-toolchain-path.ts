import { app } from "electron";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

const DEFAULT_TOOLCHAIN_ROOT = path.join(os.homedir(), ".beluga", "toolchain");
const FALLBACK_TOOLCHAIN_ROOT = path.join(os.homedir(), ".beluga-toolchain");

let resolvedToolchainRoot: string | null = bootstrapToolchainRoot();
let resolvePromise: Promise<string> | null = null;

function getToolchainConfigPath() {
  try {
    if (app.isReady()) {
      return path.join(app.getPath("userData"), "toolchain-config.json");
    }
  } catch {
    // fall through to homedir path
  }

  if (process.platform === "darwin") {
    return path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "beluga",
      "toolchain-config.json",
    );
  }

  if (process.platform === "win32") {
    return path.join(
      process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming"),
      "beluga",
      "toolchain-config.json",
    );
  }

  return path.join(os.homedir(), ".config", "beluga", "toolchain-config.json");
}

function probeWritableSync(root: string): boolean {
  try {
    fsSync.mkdirSync(root, { recursive: true });
    const probe = path.join(root, `.write-probe-${process.pid}`);
    fsSync.writeFileSync(probe, "ok", "utf-8");
    fsSync.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

function readPersistedToolchainRootSync(): string | null {
  try {
    const raw = fsSync.readFileSync(getToolchainConfigPath(), "utf-8");
    const parsed = JSON.parse(raw) as { root?: string };
    if (parsed.root && probeWritableSync(parsed.root)) {
      return parsed.root;
    }
  } catch {
    // no config yet
  }
  return null;
}

function bootstrapToolchainRoot(): string {
  const persisted = readPersistedToolchainRootSync();
  if (persisted) return persisted;

  if (probeWritableSync(DEFAULT_TOOLCHAIN_ROOT)) {
    return DEFAULT_TOOLCHAIN_ROOT;
  }

  if (probeWritableSync(FALLBACK_TOOLCHAIN_ROOT)) {
    return FALLBACK_TOOLCHAIN_ROOT;
  }

  return FALLBACK_TOOLCHAIN_ROOT;
}

async function pathExists(target: string) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function probeWritable(root: string): Promise<boolean> {
  return probeWritableSync(root);
}

async function persistToolchainRoot(root: string) {
  await fs.mkdir(path.dirname(getToolchainConfigPath()), { recursive: true });
  await fs.writeFile(
    getToolchainConfigPath(),
    JSON.stringify({ root, updatedAt: Date.now() }, null, 2),
    "utf-8",
  );
}

async function repoIsReady(repoPath: string) {
  return pathExists(path.join(repoPath, "Cargo.toml"));
}

async function copyTreeResilient(src: string, dst: string) {
  await fs.mkdir(dst, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    try {
      if (entry.isDirectory()) {
        await copyTreeResilient(srcPath, dstPath);
      } else {
        await fs.copyFile(srcPath, dstPath);
      }
    } catch {
      // Skip unreadable files (e.g. root-only sui.keystore).
    }
  }
}

async function migrateReadableEntry(
  legacyRoot: string,
  newRoot: string,
  name: string,
  readyCheck?: (target: string) => Promise<boolean>,
) {
  const src = path.join(legacyRoot, name);
  const dst = path.join(newRoot, name);
  if (!(await pathExists(src))) return;

  if (readyCheck && (await readyCheck(dst))) return;
  if (!readyCheck && (await pathExists(dst))) return;

  const srcStat = await fs.stat(src).catch(() => null);
  if (!srcStat) return;

  if (srcStat.isDirectory()) {
    await copyTreeResilient(src, dst);
  } else {
    try {
      await fs.copyFile(src, dst);
    } catch {
      // unreadable file
    }
  }
}

async function migrateFromLegacyRoot(legacyRoot: string, newRoot: string) {
  if (legacyRoot === newRoot) return;
  if (!(await pathExists(legacyRoot))) return;

  const marker = path.join(newRoot, ".migrated-from");
  if (await pathExists(marker)) return;

  await fs.mkdir(newRoot, { recursive: true });

  await migrateReadableEntry(legacyRoot, newRoot, "sui-localnet", async (dst) =>
    pathExists(path.join(dst, "network.yaml")),
  );
  for (const profile of ["sui-localnet", "sui-localnet-ika"] as const) {
    const srcDir = path.join(legacyRoot, profile);
    const dstDir = path.join(newRoot, profile);
    if (!(await pathExists(dstDir))) continue;
    for (const name of ["sui.keystore", "sui.aliases"] as const) {
      const src = path.join(srcDir, name);
      const dst = path.join(dstDir, name);
      if ((await pathExists(dst)) || !(await pathExists(src))) continue;
      try {
        await fs.copyFile(src, dst);
        if (name === "sui.keystore") {
          await fs.chmod(dst, 0o600);
        }
      } catch {
        // unreadable file
      }
    }
  }
  const moveNetDir = path.join(newRoot, "sui-localnet");
  if (await pathExists(path.join(moveNetDir, "network.yaml"))) {
    const { repairSuiLocalnetNetwork } = await import(
      "./sui-localnet/config-repair"
    );
    await repairSuiLocalnetNetwork(moveNetDir, false);
  }
  const ikaNetDir = path.join(newRoot, "sui-localnet-ika");
  if (await pathExists(path.join(ikaNetDir, "network.yaml"))) {
    const { repairSuiLocalnetNetwork } = await import(
      "./sui-localnet/config-repair"
    );
    await repairSuiLocalnetNetwork(ikaNetDir, true);
  }
  await migrateReadableEntry(legacyRoot, newRoot, "localnet-session.json");
  await migrateReadableEntry(legacyRoot, newRoot, "ika", repoIsReady);

  await fs.writeFile(
    marker,
    JSON.stringify({ from: legacyRoot, at: Date.now() }, null, 2),
    "utf-8",
  );
}

const LEGACY_IKA_HOME = path.join(os.homedir(), ".ika");

async function migrateLegacyIkaHome(toolchainRoot: string) {
  const dst = path.join(toolchainRoot, "ika-network");
  if (await pathExists(path.join(dst, "ika_config", "network.yaml"))) return;
  if (!(await pathExists(LEGACY_IKA_HOME))) return;

  await fs.mkdir(toolchainRoot, { recursive: true });
  await copyTreeResilient(LEGACY_IKA_HOME, dst);
}

/** Space-free toolchain root — required for cargo/jemalloc builds on macOS. */
export function getBelugaToolchainRoot() {
  return resolvedToolchainRoot ?? FALLBACK_TOOLCHAIN_ROOT;
}

export async function resolveBelugaToolchainRoot(): Promise<string> {
  if (resolvedToolchainRoot && (await probeWritable(resolvedToolchainRoot))) {
    return resolvedToolchainRoot;
  }

  if (resolvePromise) return resolvePromise;

  resolvePromise = (async () => {
    const envRoot = process.env.BELUGA_TOOLCHAIN_ROOT?.trim();
    if (envRoot && (await probeWritable(envRoot))) {
      resolvedToolchainRoot = envRoot;
      await migrateLegacyIkaHome(envRoot);
      await persistToolchainRoot(envRoot);
      return envRoot;
    }

    const persisted = readPersistedToolchainRootSync();
    if (persisted) {
      resolvedToolchainRoot = persisted;
      await migrateLegacyIkaHome(persisted);
      return persisted;
    }

    if (await probeWritable(DEFAULT_TOOLCHAIN_ROOT)) {
      resolvedToolchainRoot = DEFAULT_TOOLCHAIN_ROOT;
      await migrateLegacyIkaHome(DEFAULT_TOOLCHAIN_ROOT);
      await persistToolchainRoot(DEFAULT_TOOLCHAIN_ROOT);
      return DEFAULT_TOOLCHAIN_ROOT;
    }

    if (await probeWritable(FALLBACK_TOOLCHAIN_ROOT)) {
      await migrateFromLegacyRoot(DEFAULT_TOOLCHAIN_ROOT, FALLBACK_TOOLCHAIN_ROOT);
      resolvedToolchainRoot = FALLBACK_TOOLCHAIN_ROOT;
      await migrateLegacyIkaHome(FALLBACK_TOOLCHAIN_ROOT);
      await persistToolchainRoot(FALLBACK_TOOLCHAIN_ROOT);
      return FALLBACK_TOOLCHAIN_ROOT;
    }

    throw new BelugaToolchainPermissionError(
      `${DEFAULT_TOOLCHAIN_ROOT} and ${FALLBACK_TOOLCHAIN_ROOT}`,
    );
  })();

  try {
    return await resolvePromise;
  } finally {
    resolvePromise = null;
  }
}

/** Move playground uses default epochs; Ika uses long epochs in a separate persisted genesis. */
export function getBelugaSuiLocalnetDir(forIka = false) {
  return path.join(
    getBelugaToolchainRoot(),
    forIka ? "sui-localnet-ika" : "sui-localnet",
  );
}

export function getBelugaIkaRepoPath() {
  return path.join(getBelugaToolchainRoot(), "ika");
}

export function getLocalnetSessionPath() {
  return path.join(getBelugaToolchainRoot(), "localnet-session.json");
}

export function getIkaNetworkRoot() {
  return path.join(getBelugaToolchainRoot(), "ika-network");
}

export function getIkaPersistedConfigDir() {
  return path.join(getIkaNetworkRoot(), "ika_config");
}

export function getIkaNetworkConfigPath() {
  return path.join(getIkaPersistedConfigDir(), "network.yaml");
}

/** Writable temp dir for Sui/Ika child processes (avoids root-owned system TMPDIR from sudo runs). */
export function getBelugaToolchainTmpDir() {
  return path.join(getBelugaToolchainRoot(), "tmp");
}

export async function ensureBelugaToolchainTmpDir(): Promise<string> {
  const root = await ensureBelugaToolchainWritable();
  const tmpDir = path.join(root, "tmp");
  await fs.mkdir(tmpDir, { recursive: true });
  return tmpDir;
}

/** Writable Move dependency cache (avoids root-owned ~/.move from sudo runs). */
export function getBelugaMoveHomeDir() {
  const dir = path.join(getBelugaToolchainRoot(), ".move");
  try {
    fsSync.mkdirSync(dir, { recursive: true });
  } catch {
    // mkdir may fail before toolchain root is writable
  }
  return dir;
}

export async function ensureBelugaMoveHomeDir(): Promise<string> {
  const root = await ensureBelugaToolchainWritable();
  const moveHome = path.join(root, ".move");
  await fs.mkdir(moveHome, { recursive: true });
  return moveHome;
}

export function withBelugaTmpEnv(
  baseEnv: NodeJS.ProcessEnv = process.env,
  tmpDir: string = getBelugaToolchainTmpDir(),
): NodeJS.ProcessEnv {
  return {
    ...baseEnv,
    TMPDIR: tmpDir,
    TEMP: tmpDir,
    TMP: tmpDir,
  };
}

export class BelugaToolchainPermissionError extends Error {
  readonly toolchainRoot: string;

  constructor(toolchainRoot: string) {
    super(
      `Cannot write to Beluga toolchain folders (permission denied). ` +
        `Run in Terminal:\n\n` +
        `npm run fix-permissions\n\n` +
        `Then restart Beluga without sudo.`,
    );
    this.name = "BelugaToolchainPermissionError";
    this.toolchainRoot = toolchainRoot;
  }
}

export async function isBelugaToolchainWritable(
  root?: string,
): Promise<boolean> {
  const target = root ?? getBelugaToolchainRoot();
  return probeWritable(target);
}

export async function ensureBelugaToolchainWritable(): Promise<string> {
  const root = await resolveBelugaToolchainRoot();
  if (!(await probeWritable(root))) {
    throw new BelugaToolchainPermissionError(root);
  }
  return root;
}