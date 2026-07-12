import fs from "node:fs/promises";
import {
  getBelugaToolchainRoot,
  getLocalnetSessionPath,
  resolveBelugaToolchainRoot,
} from "../beluga-toolchain-path";
import type { LocalnetSessionSnapshot } from "./types";

export async function loadLocalnetSession(): Promise<LocalnetSessionSnapshot | null> {
  try {
    const raw = await fs.readFile(getLocalnetSessionPath(), "utf-8");
    const parsed = JSON.parse(raw) as LocalnetSessionSnapshot;
    if (!parsed?.coordinatorObjectId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveLocalnetSession(snapshot: LocalnetSessionSnapshot) {
  await resolveBelugaToolchainRoot();
  await fs.mkdir(getBelugaToolchainRoot(), { recursive: true });
  await fs.writeFile(
    getLocalnetSessionPath(),
    JSON.stringify(snapshot, null, 2),
    "utf-8",
  );
}

export async function clearLocalnetSession(): Promise<void> {
  try {
    await fs.unlink(getLocalnetSessionPath());
  } catch {
    // no session yet
  }
}