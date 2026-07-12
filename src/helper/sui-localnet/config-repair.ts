import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  getBelugaSuiLocalnetDir,
  getBelugaToolchainRoot,
} from "../beluga-toolchain-path";

const LEGACY_TOOLCHAIN_ROOT = path.join(os.homedir(), ".beluga", "toolchain");
const FALLBACK_TOOLCHAIN_ROOT = path.join(os.homedir(), ".beluga-toolchain");
const LOCALNET_CLIENT_ASSETS = ["sui.keystore", "sui.aliases"] as const;

async function fileExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function profileDirName(forIka: boolean) {
  return forIka ? "sui-localnet-ika" : "sui-localnet";
}

function candidateNetworkRoots(forIka: boolean): string[] {
  const profile = profileDirName(forIka);
  const roots = new Set<string>([
    getBelugaSuiLocalnetDir(forIka),
    path.join(getBelugaToolchainRoot(), profile),
    path.join(LEGACY_TOOLCHAIN_ROOT, profile),
    path.join(FALLBACK_TOOLCHAIN_ROOT, profile),
    // Cross-profile paths from mixed Move/Ika runs.
    path.join(getBelugaToolchainRoot(), profileDirName(!forIka)),
    path.join(LEGACY_TOOLCHAIN_ROOT, profileDirName(!forIka)),
    path.join(FALLBACK_TOOLCHAIN_ROOT, profileDirName(!forIka)),
  ]);
  return [...roots];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Replace a toolchain root only as a full path segment (never inside sui-localnet-ika). */
function replacePathRoot(content: string, from: string, to: string) {
  if (!from || from === to) return content;
  const pattern = new RegExp(`${escapeRegExp(from)}(?=[/\\\\]|$)`, "g");
  return content.replace(pattern, to);
}

function repairDoubleProfileSuffix(
  content: string,
  networkDir: string,
  forIka: boolean,
) {
  if (!forIka) return content;
  const corrupted = `${networkDir}-ika`;
  return content.includes(corrupted)
    ? content.split(corrupted).join(networkDir)
    : content;
}

function rewriteNetworkPaths(content: string, networkDir: string, forIka: boolean) {
  let next = repairDoubleProfileSuffix(content, networkDir, forIka);

  const roots = candidateNetworkRoots(forIka)
    .filter((root) => root !== networkDir)
    .sort((a, b) => b.length - a.length);

  for (const root of roots) {
    next = replacePathRoot(next, root, networkDir);
    next = repairDoubleProfileSuffix(next, networkDir, forIka);
  }

  return next;
}

export async function repairSuiLocalnetConfigPaths(
  networkDir: string,
  forIka: boolean,
): Promise<boolean> {
  let changed = false;

  let entries: string[] = [];
  try {
    entries = await fs.readdir(networkDir);
  } catch {
    return false;
  }

  for (const name of entries) {
    if (!name.endsWith(".yaml")) continue;
    const filePath = path.join(networkDir, name);
    const original = await fs.readFile(filePath, "utf-8");
    const repaired = rewriteNetworkPaths(original, networkDir, forIka);
    if (repaired === original) continue;
    await fs.writeFile(filePath, repaired, "utf-8");
    changed = true;
  }

  return changed;
}

/** Restore faucet signing keys omitted during partial toolchain migration. */
export async function ensureSuiLocalnetClientAssets(
  networkDir: string,
  forIka: boolean,
): Promise<boolean> {
  let restored = false;

  for (const name of LOCALNET_CLIENT_ASSETS) {
    const target = path.join(networkDir, name);
    if (await fileExists(target)) continue;

    for (const root of candidateNetworkRoots(forIka)) {
      if (root === networkDir) continue;
      const source = path.join(root, name);
      if (!(await fileExists(source))) continue;
      await fs.copyFile(source, target);
      if (name === "sui.keystore") {
        await fs.chmod(target, 0o600);
      }
      restored = true;
      break;
    }
  }

  return restored;
}

export async function repairSuiLocalnetNetwork(
  networkDir: string,
  forIka: boolean,
): Promise<{ pathsRepaired: boolean; assetsRestored: boolean }> {
  const [pathsRepaired, assetsRestored] = await Promise.all([
    repairSuiLocalnetConfigPaths(networkDir, forIka),
    ensureSuiLocalnetClientAssets(networkDir, forIka),
  ]);
  return { pathsRepaired, assetsRestored };
}

const STARTUP_FAILURE_PATTERNS: Array<{
  match: RegExp;
  message: string;
}> = [
  {
    match: /Own authority should be among the consensus authorities/i,
    message:
      "Persisted Sui localnet config no longer matches its database (often after a toolchain path migration). " +
      "Press Reset in the CLI panel, then Start — or run Reset only if you can accept losing on-chain localnet state.",
  },
  {
    match: /maximum supported version by the binary/i,
    message:
      "This persisted chain was created with a different Sui CLI version than the one Beluga is using now. " +
      "Press Reset for a fresh genesis, or align Sui versions via Packages → Toolchain (prefer the suiup install).",
  },
  {
    match: /\(de\)serialization error|Storage error/i,
    message:
      "Persisted Sui localnet storage is incompatible with the current Sui binary. " +
      "Press Reset in the CLI panel to regenerate genesis.",
  },
  {
    match: /invalid value: integer `\d+`, expected variant index/i,
    message:
      "Persisted Sui localnet storage format is incompatible with the current Sui binary. " +
      "Press Reset in the CLI panel to regenerate genesis.",
  },
  {
    match: /No managed addresses/i,
    message:
      "Persisted localnet is missing its faucet keystore (sui.keystore). " +
      "Press Reset in the CLI panel to regenerate genesis, or restart Beluga after updating — " +
      "Beluga will try to restore the keystore from a previous toolchain location automatically.",
  },
  {
    match: /Unable to load Genesis from|sui-localnet-ika-ika/i,
    message:
      "Localnet config paths were corrupted (double ika profile suffix). " +
      "Press Start again — Beluga repairs paths automatically. If it persists, use Reset in the Ika CLI panel.",
  },
];

export function describeLocalnetStartupFailure(logs: string[]): string | null {
  const blob = logs.join("\n");
  for (const pattern of STARTUP_FAILURE_PATTERNS) {
    if (pattern.match.test(blob)) {
      return pattern.message;
    }
  }
  return null;
}