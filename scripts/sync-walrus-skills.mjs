#!/usr/bin/env node
/**
 * Sync mystenlabs/walrus-skills into vendor/walrus-skills.
 * Equivalent to: npx skills add mystenlabs/walrus-skills --all
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "vendor", "walrus-skills");
const repo = "https://github.com/MystenLabs/walrus-skills.git";

console.log("Syncing walrus-skills into vendor/walrus-skills...");

try {
  execSync(`git -C "${target}" pull --ff-only`, { stdio: "inherit" });
  console.log("Updated existing walrus-skills checkout.");
} catch {
  execSync(`git clone --depth 1 "${repo}" "${target}"`, { stdio: "inherit" });
  console.log("Cloned walrus-skills into vendor/walrus-skills.");
}