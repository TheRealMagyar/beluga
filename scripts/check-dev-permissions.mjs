import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const projectDir = process.cwd();
const home = os.homedir();

const blockingTargets = [
  path.join(projectDir, ".vite"),
  path.join(projectDir, "node_modules"),
  path.join(projectDir, "out"),
  path.join(home, ".beluga"),
  path.join(home, ".beluga-toolchain"),
  path.join(home, ".ika"),
];

const warningTargets = [
  path.join(home, ".rustup"),
  path.join(home, ".cargo"),
  path.join(home, ".cache"),
];

function isWritable(target) {
  try {
    fs.mkdirSync(target, { recursive: true });
    const probe = path.join(target, `.write-probe-${process.pid}`);
    fs.writeFileSync(probe, "ok");
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

function ownerHint(target) {
  try {
    const stat = fs.statSync(target);
    return `uid=${stat.uid} gid=${stat.gid}`;
  } catch {
    return "missing";
  }
}

const blocked = blockingTargets.filter(
  (target) => fs.existsSync(target) && !isWritable(target),
);
const rustBlocked = warningTargets.filter(
  (target) => fs.existsSync(target) && !isWritable(target),
);

if (blocked.length === 0) {
  if (rustBlocked.length > 0) {
    console.warn("");
    console.warn("Some toolchain folders are not writable (usually from running with sudo).");
    console.warn("Beluga will use writable homes under ~/.beluga/toolchain/ instead.");
    console.warn("To restore the default Rust location, run: npm run fix-permissions");
    console.warn("");
  }
  process.exit(0);
}

console.error("");
console.error("Beluga dev folders are not writable (usually from running with sudo).");
console.error("");
for (const target of blocked) {
  console.error(`  ✗ ${target} (${ownerHint(target)})`);
}
if (rustBlocked.length > 0) {
  console.error("");
  console.error("Rust folders are also not writable:");
  for (const target of rustBlocked) {
    console.error(`  ✗ ${target} (${ownerHint(target)})`);
  }
}
console.error("");
console.error("Fix once in Terminal (enter your Mac password):");
console.error("");
console.error("  npm run fix-permissions");
console.error("");
console.error("Then start Beluga WITHOUT sudo:");
console.error("");
console.error("  npm start");
console.error("");
process.exit(1);