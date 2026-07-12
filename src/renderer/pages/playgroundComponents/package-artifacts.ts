import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { PlaygroundDeployment, PlaygroundFile } from "./types";
import type { MoveEntryFunction } from "./project-loader";
import { parsePackageName } from "./project-loader";

type PublishObjectChange = {
  type?: string;
  objectType?: string;
  objectId?: string;
  packageId?: string;
};

export function listBuiltModuleNames(files: PlaygroundFile[]): string[] {
  const names = new Set<string>();
  for (const file of files) {
    if (!file.path.endsWith(".move")) continue;
    const match = file.content.match(/module\s+[\w_]+::(\w+)/);
    if (match?.[1]) names.add(match[1]);
  }
  return [...names];
}

export function getPackageNameFromFiles(files: PlaygroundFile[]): string | null {
  const moveToml = files.find((f) => f.path === "Move.toml")?.content ?? "";
  return parsePackageName(moveToml);
}

function readUpgradeCapId(changes: PublishObjectChange[] | undefined): string | null {
  for (const change of changes ?? []) {
    if (change.type !== "created" || !change.objectId) continue;
    if (change.objectType?.includes("UpgradeCap")) {
      return change.objectId;
    }
  }
  return null;
}

export async function enrichDeploymentArtifacts(params: {
  client: SuiJsonRpcClient;
  packageId: string;
  packageName: string | null;
  moveEntries: MoveEntryFunction[];
  builtModuleNames: string[];
  publishObjectChanges?: PublishObjectChange[];
}): Promise<Pick<
  PlaygroundDeployment,
  "packageName" | "modules" | "moduleTargets" | "entryTargets" | "upgradeCapId"
>> {
  const { packageId, packageName, moveEntries, builtModuleNames, publishObjectChanges } =
    params;

  let moduleNames = builtModuleNames;

  try {
    const onChain = await params.client.getNormalizedMoveModulesByPackage({
      package: packageId,
    });
    const chainModules = Object.keys(onChain);
    if (chainModules.length > 0) {
      moduleNames = chainModules;
    }
  } catch {
    // fall back to parsed source module names
  }

  const moduleTargets = moduleNames.map((name) => `${packageId}::${name}`);
  const entryTargets = moveEntries.map(
    (entry) => `${packageId}::${entry.module}::${entry.name}`,
  );

  return {
    packageName: packageName ?? undefined,
    modules: moduleNames,
    moduleTargets,
    entryTargets,
    upgradeCapId: readUpgradeCapId(publishObjectChanges),
  };
}

export function formatArtifactsClipboard(deployment: PlaygroundDeployment): string {
  const lines = [
    `Package ID: ${deployment.packageId}`,
    deployment.packageName ? `Package name: ${deployment.packageName}` : null,
    `Network: ${deployment.network}`,
    `Transaction: ${deployment.digest}`,
    deployment.upgradeCapId
      ? `UpgradeCap: ${deployment.upgradeCapId}`
      : null,
    "",
    "Modules:",
    ...(deployment.moduleTargets ?? []).map((t) => `  ${t}`),
    "",
    "Entry functions:",
    ...(deployment.entryTargets ?? []).map((t) => `  ${t}`),
  ].filter((line) => line !== null);

  return lines.join("\n");
}