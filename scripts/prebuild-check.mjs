import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const checks = [
  {
    file: "src/preload.ts",
    mustInclude: ["installGit", "updateGit", "packages:update-git"],
  },
  {
    file: "src/renderer/pages/packagesComponents/ToolchainTab.tsx",
    mustInclude: ["window.packages.updateGit()"],
    mustNotInclude: ["Update Git using your system package manager"],
  },
  {
    file: "src/helper/git-toolchain.ts",
    mustInclude: ["export async function updateGit"],
  },
];

const failures = [];

for (const check of checks) {
  const target = path.join(root, check.file);
  const source = fs.readFileSync(target, "utf8");

  for (const needle of check.mustInclude ?? []) {
    if (!source.includes(needle)) {
      failures.push(`${check.file} is missing "${needle}"`);
    }
  }

  for (const needle of check.mustNotInclude ?? []) {
    if (source.includes(needle)) {
      failures.push(`${check.file} still contains stale text "${needle}"`);
    }
  }
}

if (failures.length > 0) {
  console.error("Prebuild check failed:");
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log("Prebuild check passed (Git toolchain wiring is present).");