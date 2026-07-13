import fs from "node:fs/promises";
import path from "node:path";
import { getIkaRepoPath } from "./ika-localnet/paths";
import type { InstallResult } from "./sui-toolchain";

/** Matches the Sui tag in Ika's root Cargo.toml workspace.dependencies. */
export const IKA_FALLBACK_SUI_TAG = "mainnet-v1.73.2";

export function parseSuiTagVersion(tag: string): string | null {
  const match = tag.match(/v?(\d+\.\d+\.\d+)/);
  return match?.[1] ?? null;
}

export function parseSuiCliVersionLine(line: string): string | null {
  const match = line.match(/\b(\d+\.\d+\.\d+)\b/);
  return match?.[1] ?? null;
}

export function suiVersionMatchesPin(
  installedVersionLine: string,
  pinnedTag: string,
): boolean {
  const required = parseSuiTagVersion(pinnedTag);
  const current = parseSuiCliVersionLine(installedVersionLine);
  if (!required || !current) return false;
  return required === current;
}

export function suiupInstallSpecForTag(tag: string): string {
  const version = parseSuiTagVersion(tag);
  const network = tag.startsWith("testnet")
    ? "testnet"
    : tag.startsWith("devnet")
      ? "devnet"
      : "mainnet";
  return version ? `sui@${network}-${version}` : `sui@${network}`;
}

export async function readIkaPinnedSuiTag(repoPath?: string): Promise<string> {
  const repo = repoPath ?? getIkaRepoPath();
  try {
    const cargo = await fs.readFile(path.join(repo, "Cargo.toml"), "utf-8");
    const match = cargo.match(
      /github\.com\/MystenLabs\/sui",\s*tag\s*=\s*"([^"]+)"/,
    );
    if (match?.[1]) return match[1];
  } catch {
    // repo not cloned yet — use fallback pin
  }
  return IKA_FALLBACK_SUI_TAG;
}

export function formatIkaSuiVersionMismatchHint(params: {
  installed: string | null;
  requiredTag: string;
  requiredVersion: string;
  suiBinaryPath?: string | null;
  installError?: string | null;
}): string {
  const installSpec = suiupInstallSpecForTag(params.requiredTag);
  const installedLabel = params.installed?.trim() || "not installed";
  const binaryLine = params.suiBinaryPath
    ? `Binary used: ${params.suiBinaryPath}\n`
    : "";
  const installLine = params.installError
    ? `\nAuto-install attempt:\n${params.installError}\n`
    : "";
  return (
    `Sui CLI version mismatch for Ika localnet.\n\n` +
    `Installed: ${installedLabel}\n` +
    binaryLine +
    `Required: ${params.requiredVersion} (Ika pin ${params.requiredTag})\n\n` +
    `Packages → Toolchain "Update Sui" installs the latest testnet release — that is not the same as Ika's pinned mainnet version.\n\n` +
    `Ika talks to Sui over gRPC during bootstrap; older Sui builds only expose JSON-RPC and fail with HTTP 404.` +
    installLine +
    `\nRun in Terminal:\n\n` +
    `suiup install ${installSpec} -y\n` +
    `suiup default set ${installSpec}\n\n` +
    `Then press Reset in the Ika CLI panel and Start again.`
  );
}

export interface EnsureSuiForIkaResult {
  ok: boolean;
  message?: string;
  upgraded: boolean;
  installedVersion: string | null;
  requiredTag: string;
  requiredVersion: string;
}

async function installPinnedSui(
  pinnedTag: string,
): Promise<InstallResult & { upgraded: boolean }> {
  const { getToolchainStatus, installSuiForIkaPin, installSuiup } =
    await import("./sui-toolchain");
  let status = await getToolchainStatus();
  if (!status.suiup.installed) {
    const suiupResult = await installSuiup();
    if (!suiupResult.success) {
      return { ...suiupResult, upgraded: false };
    }
    status = await getToolchainStatus();
    if (!status.suiup.installed) {
      return {
        success: false,
        message: `suiup install failed: ${suiupResult.message}`,
        stdout: suiupResult.stdout,
        stderr: suiupResult.stderr,
        upgraded: false,
      };
    }
  }

  const installResult = await installSuiForIkaPin(pinnedTag);
  const { invalidateManagedSuiBinaryCache } = await import("./sui-toolchain");
  invalidateManagedSuiBinaryCache();
  return { ...installResult, upgraded: installResult.success };
}

export async function ensureSuiMatchesIkaPin(options: {
  autoInstall?: boolean;
  repoPath?: string;
} = {}): Promise<EnsureSuiForIkaResult> {
  const { getManagedSuiBinary, getToolchainStatus } = await import(
    "./sui-toolchain"
  );
  const requiredTag = await readIkaPinnedSuiTag(options.repoPath);
  const requiredVersion =
    parseSuiTagVersion(requiredTag) ??
    parseSuiTagVersion(IKA_FALLBACK_SUI_TAG) ??
    "1.73.2";

  const status = await getToolchainStatus();
  const installedLine = status.sui.version;
  const installedVersion = installedLine
    ? parseSuiCliVersionLine(installedLine)
    : null;

  if (
    status.sui.installed &&
    installedLine &&
    suiVersionMatchesPin(installedLine, requiredTag)
  ) {
    return {
      ok: true,
      upgraded: false,
      installedVersion,
      requiredTag,
      requiredVersion,
    };
  }

  const suiBinaryPath = await getManagedSuiBinary();

  if (options.autoInstall) {
    const install = await installPinnedSui(requiredTag);
    if (!install.success) {
      return {
        ok: false,
        message: formatIkaSuiVersionMismatchHint({
          installed: installedLine,
          requiredTag,
          requiredVersion,
          suiBinaryPath,
          installError: install.message,
        }),
        upgraded: false,
        installedVersion,
        requiredTag,
        requiredVersion,
      };
    }

    const afterBinaryPath = await getManagedSuiBinary();
    const after = await getToolchainStatus();
    const afterLine = after.sui.version;
    const afterVersion = afterLine ? parseSuiCliVersionLine(afterLine) : null;
    if (after.sui.installed && afterLine && suiVersionMatchesPin(afterLine, requiredTag)) {
      return {
        ok: true,
        upgraded: true,
        installedVersion: afterVersion,
        requiredTag,
        requiredVersion,
      };
    }

    return {
      ok: false,
      message: formatIkaSuiVersionMismatchHint({
        installed: afterLine ?? installedLine,
        requiredTag,
        requiredVersion,
        suiBinaryPath: afterBinaryPath,
        installError:
          "suiup reported success, but Beluga still sees the old Sui binary. " +
          "Another sui.exe may be earlier on PATH — run suiup default set and restart Beluga.",
      }),
      upgraded: install.upgraded,
      installedVersion: afterVersion ?? installedVersion,
      requiredTag,
      requiredVersion,
    };
  }

  return {
    ok: false,
    message: formatIkaSuiVersionMismatchHint({
      installed: installedLine,
      requiredTag,
      requiredVersion,
      suiBinaryPath,
    }),
    upgraded: false,
    installedVersion,
    requiredTag,
    requiredVersion,
  };
}