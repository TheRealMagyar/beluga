import os from "node:os";
import path from "node:path";
import {
  formatElevatedKillHint,
  getProcessOwner,
  killProcessTree,
  killProcessTreeSync,
  pathRegexFragment,
  pgrepByPatterns,
  pgrepByPatternsSync,
} from "../platform-process";
import { getIkaRepoPath, getLegacyIkaRepoPath } from "./paths";

export interface KillIkaProcessesResult {
  killed: number[];
  unkillable: Array<{ pid: number; owner: string | null }>;
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getKnownIkaRepoPaths(repoPath: string): string[] {
  const paths = new Set<string>([
    repoPath,
    getIkaRepoPath(),
    path.join(os.homedir(), ".beluga", "toolchain", "ika"),
    getLegacyIkaRepoPath(),
  ]);
  return [...paths];
}

function buildIkaPgrepPatterns(repoPath: string): string[] {
  const patterns = new Set<string>([
    "target[/\\\\]release[/\\\\]ika(\\.exe)? start",
    "target[/\\\\]debug[/\\\\]ika(\\.exe)? start",
    "cargo run.*--bin.*ika",
    "ika(\\.exe)? start",
  ]);

  for (const root of getKnownIkaRepoPaths(repoPath)) {
    const escaped = pathRegexFragment(root);
    patterns.add(`${escaped}[/\\\\]target[/\\\\]release[/\\\\]ika(\\.exe)? start`);
    patterns.add(`${escaped}[/\\\\]target[/\\\\]debug[/\\\\]ika(\\.exe)? start`);
    patterns.add(`cargo run.*${escaped}.*--bin.*ika`);
  }

  return [...patterns];
}

async function killIkaPid(
  pid: number,
): Promise<"killed" | "eperm" | "missing"> {
  const result = await killProcessTree(pid, true);
  if (result === "killed") {
    return "killed";
  }
  if (result === "eperm") {
    return "eperm";
  }
  return "missing";
}

export function formatUnkillableIkaHint(
  unkillable: KillIkaProcessesResult["unkillable"],
): string {
  if (!unkillable.length) {
    return "Ika is still running. Stop other Ika localnet processes and try again.";
  }
  const pids = unkillable.map((entry) => entry.pid);
  const isRoot = unkillable.some((entry) => entry.owner === "root");
  const elevatedNote = isRoot
    ? " (left over from running Beluga/Ika with elevated permissions)"
    : "";
  return (
    formatElevatedKillHint(pids, `Ika localnet${elevatedNote}`) +
    "\n\nOr run: npm run kill-ika"
  );
}

export async function findOrphanedIkaStartPids(
  repoPath: string,
  excludePid?: number,
): Promise<number[]> {
  const found = new Set<number>();

  for (const pid of await pgrepByPatterns(buildIkaPgrepPatterns(repoPath))) {
    if (excludePid != null && pid === excludePid) continue;
    found.add(pid);
  }

  return [...found];
}

export function findOrphanedIkaStartPidsSync(
  repoPath: string,
  excludePid?: number,
): number[] {
  const found = new Set<number>();

  for (const pid of pgrepByPatternsSync(buildIkaPgrepPatterns(repoPath))) {
    if (excludePid != null && pid === excludePid) continue;
    found.add(pid);
  }

  return [...found];
}

export function killIkaProcessTreeSync(pid: number) {
  killProcessTreeSync(pid, true);
}

export async function killIkaProcessTree(pid: number) {
  await killProcessTree(pid, true);
}

export async function killOrphanedIkaStartProcesses(
  repoPath: string,
  excludePid?: number,
): Promise<KillIkaProcessesResult> {
  const pids = await findOrphanedIkaStartPids(repoPath, excludePid);
  const killed: number[] = [];
  const unkillable: KillIkaProcessesResult["unkillable"] = [];

  for (const pid of pids) {
    const result = await killIkaPid(pid);
    if (result === "killed") {
      killed.push(pid);
    } else if (result === "eperm") {
      unkillable.push({ pid, owner: await getProcessOwner(pid) });
    }
  }

  if (killed.length > 0) {
    await sleep(1_500);
  }

  return { killed, unkillable };
}