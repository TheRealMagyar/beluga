import path from "node:path";
import {
  killProcessTree,
  pathRegexFragment,
  pgrepByPatterns,
} from "./platform-process";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function findStaleIkaCargoPids(repoPath: string): Promise<number[]> {
  const targetDir = pathRegexFragment(path.join(repoPath, "target"));
  const patterns = [
    `cargo build.*${pathRegexFragment(repoPath)}`,
    "cargo build.*--bin ika",
    `${targetDir}.*rustc`,
    `rustc.*${targetDir}`,
    "cargo(\\.exe)? build.*--bin ika",
  ];

  return pgrepByPatterns(patterns);
}

export async function killStaleIkaCargoProcesses(
  repoPath: string,
): Promise<number[]> {
  const pids = await findStaleIkaCargoPids(repoPath);
  for (const pid of pids) {
    await killProcessTree(pid, true);
  }
  if (pids.length > 0) {
    await sleep(750);
  }
  return pids;
}