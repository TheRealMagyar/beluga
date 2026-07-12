import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const user = os.userInfo().username;
const projectDir = process.cwd();
const home = os.homedir();

const targets = [
  path.join(projectDir, ".vite"),
  path.join(projectDir, "node_modules"),
  path.join(projectDir, "out"),
  path.join(home, ".beluga"),
  path.join(home, ".beluga", "toolchain"),
  path.join(home, ".beluga-toolchain"),
  path.join(home, ".move"),
  path.join(home, ".ika"),
  path.join(home, ".rustup"),
  path.join(home, ".cargo"),
  path.join(home, ".cache"),
  path.join(home, "Library", "Application Support", "beluga"),
].filter((target) => {
  try {
    fs.accessSync(target);
    return true;
  } catch {
    return false;
  }
});

if (targets.length === 0) {
  console.log("Nothing to fix — no Beluga folders found.");
  process.exit(0);
}

const quoted = targets.map((target) => `"${target}"`).join(" ");
const command = `sudo chown -R "${user}" ${quoted}`;

console.log("This fixes root-owned Beluga folders from prior sudo runs.");
console.log("You will be asked for your Mac login password.");
console.log("");
console.log(command);
console.log("");

try {
  execSync(command, { stdio: "inherit" });
  console.log("");
  console.log("Done. Start Beluga with: npm start");
} catch {
  process.exit(1);
}