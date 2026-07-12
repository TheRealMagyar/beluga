import fs from "node:fs/promises";
import path from "node:path";

const RUNTIME_DEPS = [
  "node-pty",
  "@mysten/walrus",
  "@mysten/walrus-wasm",
];

export async function copyRuntimeDeps(
  buildPath,
  projectRoot = process.cwd(),
) {
  for (const dep of RUNTIME_DEPS) {
    const src = path.join(projectRoot, "node_modules", ...dep.split("/"));
    const dest = path.join(buildPath, "node_modules", ...dep.split("/"));

    try {
      await fs.access(src);
    } catch {
      console.warn(`[package-runtime-deps] Skipping missing dependency: ${dep}`);
      continue;
    }

    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.cp(src, dest, { recursive: true, dereference: true });
    console.log(`[package-runtime-deps] Copied ${dep}`);
  }

  const spawnHelper = path.join(
    buildPath,
    "node_modules",
    "node-pty",
    "build",
    "Release",
    "spawn-helper",
  );
  try {
    await fs.chmod(spawnHelper, 0o755);
  } catch {
    // optional on non-unix platforms
  }
}

const isDirectRun = process.argv[1]?.endsWith("package-runtime-deps.mjs");
if (isDirectRun) {
  const buildPath = process.argv[2];
  if (!buildPath) {
    console.error("Usage: node scripts/package-runtime-deps.mjs <buildPath>");
    process.exit(1);
  }
  await copyRuntimeDeps(buildPath);
}