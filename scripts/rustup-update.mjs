import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const home = os.homedir();

function probeWritableDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, `.write-probe-${process.pid}`);
    fs.writeFileSync(probe, "ok");
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

function resolveRustupHome() {
  const defaultHome = path.join(home, ".rustup");
  const candidates = [process.env.RUSTUP_HOME, defaultHome].filter(Boolean);
  for (const candidate of candidates) {
    if (probeWritableDir(candidate)) return candidate;
  }
  return path.join(home, ".beluga", "toolchain", "rustup");
}

function resolveCargoHome() {
  const defaultHome = path.join(home, ".cargo");
  const candidates = [process.env.CARGO_HOME, defaultHome].filter(Boolean);
  for (const candidate of candidates) {
    if (probeWritableDir(candidate)) return candidate;
  }
  return path.join(home, ".beluga", "toolchain", "cargo");
}

const rustupHome = resolveRustupHome();
const cargoHome = resolveCargoHome();
const tmpDir = path.join(path.dirname(rustupHome), "tmp");

fs.mkdirSync(rustupHome, { recursive: true });
fs.mkdirSync(cargoHome, { recursive: true });
fs.mkdirSync(tmpDir, { recursive: true });

const defaultRustup = path.join(home, ".rustup");
const usingFallback = rustupHome !== defaultRustup;

if (usingFallback) {
  console.log(`Using writable Rust home: ${rustupHome}`);
  console.log("Run npm run fix-permissions to restore ~/.rustup.");
  console.log("");
}

const env = {
  ...process.env,
  RUSTUP_HOME: rustupHome,
  CARGO_HOME: cargoHome,
  TMPDIR: tmpDir,
  TEMP: tmpDir,
  TMP: tmpDir,
  PATH: [
    path.join(cargoHome, "bin"),
    path.join(home, ".cargo", "bin"),
    path.join(home, ".local", "bin"),
    "/opt/homebrew/bin",
    "/usr/local/bin",
    process.env.PATH ?? "",
  ]
    .filter(Boolean)
    .join(path.delimiter),
};

execSync("rustup update", { stdio: "inherit", env });