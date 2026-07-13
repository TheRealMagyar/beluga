import { app } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { killStaleIkaCargoProcesses } from "./cargo-process";
import { isJobActive, JobCancelledError } from "./packages-job-manager";
import {
  emitDone,
  parseCargoProgressLine,
  parseGitProgressLine,
  runProcessWithProgress,
  type ToolchainProgressEmitter,
} from "./toolchain-progress";
import {
  type InstallResult,
  type ToolchainComponentStatus,
  toolchainEnv,
} from "./sui-toolchain";
import {
  getIkaRepoPath,
  getIkaLocalnetConfig,
  migrateIkaToolchainIfNeeded,
} from "./ika-localnet";
import {
  npmInstalledPackageDir,
  runNpmCommand,
} from "./command-binary";
import {
  getIkaVendorRoot,
  getIkaWasmWebDir,
} from "./ika-vendor-path";
import {
  buildWindowsCargoCommand,
  resolveWindowsMsvcForCargo,
} from "./windows-msvc";

const execFileAsync = promisify(execFile);

export interface IkaToolchainStatus {
  git: ToolchainComponentStatus;
  repo: {
    installed: boolean;
    path: string;
    version: string | null;
  };
  binary: ToolchainComponentStatus;
  sdk: ToolchainComponentStatus;
  configReady: boolean;
  configPath: string | null;
  ready: boolean;
}

function getIkaBinaryPath() {
  const base = path.join(getIkaRepoPath(), "target", "release", "ika");
  return process.platform === "win32" ? `${base}.exe` : base;
}

async function pathExists(target: string) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function probeGit(): Promise<ToolchainComponentStatus> {
  try {
    const { stdout } = await execFileAsync("git", ["--version"], {
      timeout: 10_000,
      env: toolchainEnv(),
    });
    return {
      installed: true,
      version: stdout.trim().split("\n")[0],
      path: "git",
    };
  } catch {
    return { installed: false, version: null, path: null };
  }
}

async function getRepoVersion(repoPath: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["-C", repoPath, "rev-parse", "--short", "HEAD"],
      { timeout: 15_000, env: toolchainEnv() },
    );
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

async function probeIkaBinary(): Promise<ToolchainComponentStatus> {
  const binaryPath = getIkaBinaryPath();
  if (!(await pathExists(binaryPath))) {
    return { installed: false, version: null, path: null };
  }

  try {
    const { stdout } = await execFileAsync(binaryPath, ["--version"], {
      timeout: 15_000,
      env: toolchainEnv(),
    });
    return {
      installed: true,
      version: stdout.trim().split("\n")[0],
      path: binaryPath,
    };
  } catch {
    return {
      installed: true,
      version: "built",
      path: binaryPath,
    };
  }
}

async function probeIkaSdk(): Promise<ToolchainComponentStatus> {
  const appRoot = app.getAppPath();
  const candidates = [
    path.join(getIkaVendorRoot(), "sdk", "package.json"),
    path.join(process.cwd(), "vendor", "@ika.xyz", "sdk", "package.json"),
    path.join(app.getAppPath(), "vendor", "@ika.xyz", "sdk", "package.json"),
    path.join(appRoot, "node_modules", "@ika.xyz", "sdk", "package.json"),
    path.join(process.cwd(), "node_modules", "@ika.xyz", "sdk", "package.json"),
  ];

  for (const candidate of candidates) {
    try {
      const raw = await fs.readFile(candidate, "utf-8");
      const pkg = JSON.parse(raw) as { version?: string };
      return {
        installed: true,
        version: pkg.version ? `@ika.xyz/sdk@${pkg.version}` : "@ika.xyz/sdk",
        path: path.dirname(candidate),
      };
    } catch {
      continue;
    }
  }

  return { installed: false, version: null, path: null };
}

export async function getIkaToolchainStatus(): Promise<IkaToolchainStatus> {
  await migrateIkaToolchainIfNeeded();

  const [git, binary, sdk] = await Promise.all([
    probeGit(),
    probeIkaBinary(),
    probeIkaSdk(),
  ]);

  const repoPath = getIkaRepoPath();
  const repoReady = await pathExists(path.join(repoPath, "Cargo.toml"));
  const repoVersion = repoReady ? await getRepoVersion(repoPath) : null;
  const ikaConfig = await getIkaLocalnetConfig();

  const ready =
    git.installed &&
    repoReady &&
    binary.installed &&
    sdk.installed;

  return {
    git,
    repo: {
      installed: repoReady,
      path: repoPath,
      version: repoVersion,
    },
    binary,
    sdk,
    configReady: ikaConfig.ready,
    configPath: ikaConfig.path,
    ready,
  };
}

const IKA_REPO_URL = "https://github.com/dwallet-labs/ika.git";
let ikaBinaryBuildInFlight = false;

function assertSpaceFreeToolchainPath(repoPath: string) {
  if (repoPath.includes(" ")) {
    throw new Error(
      `Ika toolchain path must not contain spaces (jemalloc/cargo will fail): ${repoPath}`,
    );
  }
}

function ikaCargoBuildEnv(): NodeJS.ProcessEnv {
  return {
    ...toolchainEnv(),
    CARGO_TERM_PROGRESS_WHEN: "always",
    CARGO_TERM_PROGRESS_WIDTH: "80",
    GIT_TERMINAL_PROMPT: "0",
    CARGO_NET_GIT_FETCH_WITH_CLI: "true",
  };
}

function ikaBinaryStartMessage(): string {
  if (process.platform === "win32") {
    return (
      "Building Ika CLI (cargo build --release). " +
      "First run downloads MystenLabs/sui and other git deps — often 30–60 minutes on Windows. " +
      "Fetch/Checkout lines in the log are normal; keep Beluga open until Finished release."
    );
  }
  return (
    "Building Ika CLI (cargo build --release). First run may take 10–30 minutes..."
  );
}

async function prepareIkaRepoForCargoBuild(repoPath: string): Promise<void> {
  const commands: Array<[string, ...string[]]> = [
    ["-C", repoPath, "config", "core.longpaths", "true"],
  ];

  for (const args of commands) {
    try {
      await execFileAsync("git", args, {
        timeout: 30_000,
        env: toolchainEnv(),
      });
    } catch {
      // non-fatal — build may still succeed
    }
  }
}

async function assertRustForCargoBuild(): Promise<void> {
  try {
    await execFileAsync("rustc", ["-vV"], {
      timeout: 15_000,
      env: toolchainEnv(),
    });
  } catch {
    throw new Error(
      "Rust is required before building Ika. Install Rust under Packages → Toolchain, then retry.",
    );
  }
}

export async function cloneIkaRepository(
  emit?: ToolchainProgressEmitter,
): Promise<InstallResult> {
  const migrated = await migrateIkaToolchainIfNeeded();
  if (migrated) {
    emit?.({
      job: "ika-repo",
      phase: "running",
      percent: null,
      message: migrated,
      recentLogs: [migrated],
    });
  }

  const repoPath = getIkaRepoPath();
  assertSpaceFreeToolchainPath(repoPath);
  if (await pathExists(path.join(repoPath, "Cargo.toml"))) {
    const message = "Ika repository is ready.";
    emit?.({
      job: "ika-repo",
      phase: "done",
      percent: 100,
      message,
      recentLogs: [],
    });
    return { success: true, message, stdout: repoPath, stderr: "" };
  }

  await fs.mkdir(path.dirname(repoPath), { recursive: true });

  try {
    const { code, stdout, stderr, logs } = await runProcessWithProgress(
      {
        job: "ika-repo",
        command: "git",
        args: ["clone", "--progress", IKA_REPO_URL, repoPath],
        env: toolchainEnv(),
        parseLine: parseGitProgressLine,
        startMessage: `Cloning Ika repository into ${repoPath}...`,
      },
      emit ?? (() => undefined),
    );

    if (code !== 0) {
      const message =
        [stderr, stdout].filter(Boolean).join("\n").trim() ||
        `git clone failed with exit code ${code ?? "unknown"}.`;
      emitDone(emit ?? (() => undefined), "ika-repo", false, message, logs);
      return { success: false, message, stdout, stderr };
    }

    const message = "Cloned Ika repository.";
    emitDone(emit ?? (() => undefined), "ika-repo", true, message, logs);
    return { success: true, message, stdout: repoPath, stderr: "" };
  } catch (err: any) {
    if (err instanceof JobCancelledError) {
      const message = "Clone cancelled.";
      emitDone(emit ?? (() => undefined), "ika-repo", false, message, []);
      return { success: false, message, stdout: "", stderr: "" };
    }
    const message = err?.message || "Failed to clone Ika repository.";
    emitDone(emit ?? (() => undefined), "ika-repo", false, message, []);
    return { success: false, message, stdout: "", stderr: "" };
  }
}

export async function cleanupIkaBuildLock(): Promise<number> {
  return killStaleIkaCargoProcesses(getIkaRepoPath());
}

export async function buildIkaBinary(
  emit?: ToolchainProgressEmitter,
): Promise<InstallResult> {
  if (ikaBinaryBuildInFlight || isJobActive("ika-binary")) {
    const message = "An Ika CLI build is already running.";
    emitDone(emit ?? (() => undefined), "ika-binary", false, message, []);
    return { success: false, message, stdout: "", stderr: "" };
  }

  ikaBinaryBuildInFlight = true;
  try {
  const migrated = await migrateIkaToolchainIfNeeded();
  if (migrated) {
    emit?.({
      job: "ika-binary",
      phase: "running",
      percent: null,
      message: migrated,
      recentLogs: [migrated],
    });
  }

  const repoPath = getIkaRepoPath();
  assertSpaceFreeToolchainPath(repoPath);

  if (!(await pathExists(path.join(repoPath, "Cargo.toml")))) {
    const message = "Clone the Ika repository first.";
    emitDone(emit ?? (() => undefined), "ika-binary", false, message, []);
    return {
      success: false,
      message,
      stdout: "",
      stderr: "",
    };
  }

  const stalePids = await killStaleIkaCargoProcesses(repoPath);
  if (stalePids.length > 0) {
    const cleanupMessage = `Stopped ${stalePids.length} stale cargo process(es) holding the build lock.`;
    emit?.({
      job: "ika-binary",
      phase: "running",
      percent: null,
      message: cleanupMessage,
      recentLogs: [cleanupMessage],
    });
  }

    await assertRustForCargoBuild();
    await prepareIkaRepoForCargoBuild(repoPath);

    const buildEnv = ikaCargoBuildEnv();
    const cargoArgs = ["build", "--release", "--bin", "ika", "--no-default-features"];
    const msvcLaunch = await resolveWindowsMsvcForCargo(buildEnv);
    const cargoCommand = msvcLaunch
      ? buildWindowsCargoCommand(msvcLaunch.vcvars64, cargoArgs)
      : { command: "cargo", args: cargoArgs };

    const { code, stdout, stderr, logs } = await runProcessWithProgress(
      {
        job: "ika-binary",
        command: cargoCommand.command,
        args: cargoCommand.args,
        cwd: repoPath,
        env: buildEnv,
        parseLine: parseCargoProgressLine,
        startMessage: msvcLaunch
          ? `${ikaBinaryStartMessage()} Using MSVC from ${msvcLaunch.installationPath}.`
          : ikaBinaryStartMessage(),
      },
      emit ?? (() => undefined),
    );

    if (code !== 0) {
      const message =
        [stderr, stdout].filter(Boolean).join("\n").trim() ||
        `cargo build failed with exit code ${code ?? "unknown"}.`;
      emitDone(emit ?? (() => undefined), "ika-binary", false, message, logs);
      return { success: false, message, stdout, stderr };
    }

    const message = "Ika binary built successfully.";
    emitDone(emit ?? (() => undefined), "ika-binary", true, message, logs);
    return {
      success: true,
      message,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    };
  } catch (err: any) {
    if (err instanceof JobCancelledError) {
      await killStaleIkaCargoProcesses(getIkaRepoPath());
      const message = "Build cancelled.";
      emitDone(emit ?? (() => undefined), "ika-binary", false, message, []);
      return { success: false, message, stdout: "", stderr: "" };
    }
    const message = err?.message || "Ika build failed.";
    emitDone(emit ?? (() => undefined), "ika-binary", false, message, []);
    return { success: false, message, stdout: "", stderr: "" };
  } finally {
    ikaBinaryBuildInFlight = false;
  }
}

export async function updateIkaRepository(): Promise<InstallResult> {
  const repoPath = getIkaRepoPath();
  if (!(await pathExists(path.join(repoPath, "Cargo.toml")))) {
    return {
      success: false,
      message: "Clone the Ika repository first.",
      stdout: "",
      stderr: "",
    };
  }

  try {
    const { stdout, stderr } = await execFileAsync(
      "git",
      ["-C", repoPath, "pull", "--ff-only"],
      {
        timeout: 900_000,
        maxBuffer: 10 * 1024 * 1024,
        env: toolchainEnv(),
      },
    );
    return {
      success: true,
      message: "Ika repository updated.",
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    };
  } catch (err: any) {
    const stdout = err?.stdout?.toString?.() ?? "";
    const stderr = err?.stderr?.toString?.() ?? "";
    return {
      success: false,
      message:
        [err?.message, stderr, stdout].filter(Boolean).join("\n").trim() ||
        "Ika repository update failed.",
      stdout,
      stderr,
    };
  }
}

export async function uninstallIkaRepository(): Promise<InstallResult> {
  const repoPath = getIkaRepoPath();
  try {
    await fs.rm(repoPath, { recursive: true, force: true });
    return {
      success: true,
      message: "Removed Ika repository.",
      stdout: "",
      stderr: "",
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "Failed to remove Ika repository.",
      stdout: "",
      stderr: "",
    };
  }
}

export async function rebuildIkaBinary(
  emit?: ToolchainProgressEmitter,
): Promise<InstallResult> {
  return buildIkaBinary(emit);
}

export async function uninstallIkaBinary(): Promise<InstallResult> {
  const targetDir = path.join(getIkaRepoPath(), "target");
  try {
    await fs.rm(targetDir, { recursive: true, force: true });
    return {
      success: true,
      message: "Removed Ika build artifacts.",
      stdout: "",
      stderr: "",
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "Failed to remove Ika build artifacts.",
      stdout: "",
      stderr: "",
    };
  }
}

function getBelugaToolchainCargoHome() {
  return path.join(app.getPath("userData"), "toolchain", "cargo");
}

function getBelugaToolchainRustupHome() {
  return path.join(app.getPath("userData"), "toolchain", "rustup");
}

function getIkaWasmCargoTargetDir() {
  return path.join(app.getPath("userData"), "toolchain", "ika-wasm-target");
}

function vendorIkaWasmWebDir() {
  return getIkaWasmWebDir();
}

async function ensureWritableToolchainDirs() {
  await fs.mkdir(getBelugaToolchainCargoHome(), { recursive: true });
  await fs.mkdir(getBelugaToolchainRustupHome(), { recursive: true });
  await fs.mkdir(getIkaWasmCargoTargetDir(), { recursive: true });
}

/**
 * Build ika-wasm from the cloned Ika repo (supports V3 network DKG output).
 * npm @ika.xyz/ika-wasm@0.2.1 only understands V1/V2 and fails on fresh localnets.
 */
export async function buildIkaWasmFromToolchain(
  emit?: ToolchainProgressEmitter,
): Promise<InstallResult> {
  const repoPath = getIkaRepoPath();
  const wasmSourceDir = path.join(repoPath, "sdk", "ika-wasm");
  const wasmOutDir = vendorIkaWasmWebDir();

  if (!(await pathExists(wasmSourceDir))) {
    return {
      success: false,
      message:
        "Ika repository is missing sdk/ika-wasm. Install the Ika repo from Packages → Toolchain first.",
      stdout: "",
      stderr: "",
    };
  }

  emit?.({
    job: "ika-sdk",
    phase: "compiling",
    percent: 10,
    message: "Building ika-wasm from Ika toolchain (first run may take several minutes)...",
    recentLogs: [wasmSourceDir],
  });

  try {
    await ensureWritableToolchainDirs();
    await fs.mkdir(path.dirname(wasmOutDir), { recursive: true });

    const env = {
      ...toolchainEnv(),
      CARGO_HOME: getBelugaToolchainCargoHome(),
      RUSTUP_HOME: getBelugaToolchainRustupHome(),
      CARGO_TARGET_DIR: getIkaWasmCargoTargetDir(),
      RUSTFLAGS: '--cfg getrandom_backend="wasm_js"',
    };

    await execFileAsync(
      "npx",
      [
        "cross-env",
        'RUSTFLAGS=--cfg getrandom_backend="wasm_js"',
        "wasm-pack",
        "build",
        "--target",
        "web",
        "--out-dir",
        wasmOutDir,
        "--release",
      ],
      {
        cwd: wasmSourceDir,
        timeout: 1_800_000,
        maxBuffer: 20 * 1024 * 1024,
        env,
      },
    );

    const message =
      "Built ika-wasm from Ika toolchain into vendor/ (V3 network DKG support).";
    emitDone(emit ?? (() => undefined), "ika-sdk", true, message, [message]);
    return {
      success: true,
      message,
      stdout: wasmOutDir,
      stderr: "",
    };
  } catch (err: any) {
    const stdout = err?.stdout?.toString?.() ?? "";
    const stderr = err?.stderr?.toString?.() ?? "";
    const message =
      [err?.message, stderr, stdout].filter(Boolean).join("\n").trim() ||
      "Failed to build ika-wasm from Ika toolchain.";
    emitDone(emit ?? (() => undefined), "ika-sdk", false, message, [message]);
    return {
      success: false,
      message,
      stdout,
      stderr,
    };
  }
}

async function extractVendorPackage(
  packageName: string,
  version: string,
  targetDir: string,
  emit?: ToolchainProgressEmitter,
): Promise<void> {
  const safeName = packageName.replace(/[@/]/g, "-");
  const tmpDir = path.join(
    app.getPath("temp"),
    "beluga-ika-vendor",
    `${safeName}-${version}`,
  );
  await fs.rm(tmpDir, { recursive: true, force: true });
  await fs.mkdir(tmpDir, { recursive: true });

  emit?.({
    job: "ika-sdk",
    phase: "packaging",
    percent: null,
    message: `Downloading ${packageName}@${version}...`,
    recentLogs: [],
  });

  await runNpmCommand(
    [
      "install",
      `${packageName}@${version}`,
      "--prefix",
      tmpDir,
      "--no-save",
      "--no-fund",
      "--no-audit",
    ],
    {
      cwd: tmpDir,
      timeout: 300_000,
      env: toolchainEnv(),
    },
  );

  const installedDir = npmInstalledPackageDir(tmpDir, packageName);
  try {
    await fs.access(installedDir);
  } catch {
    throw new Error(
      `npm install did not produce ${packageName} under ${installedDir}. ` +
        "Ensure Node.js and npm are installed and available on PATH.",
    );
  }

  emit?.({
    job: "ika-sdk",
    phase: "extracting",
    percent: null,
    message: `Extracting ${packageName}...`,
    recentLogs: [installedDir],
  });

  await fs.rm(targetDir, { recursive: true, force: true });
  await fs.mkdir(path.dirname(targetDir), { recursive: true });
  await fs.cp(installedDir, targetDir, { recursive: true });
}

export async function installIkaSdk(
  emit?: ToolchainProgressEmitter,
): Promise<InstallResult> {
  const vendorRoot = getIkaVendorRoot();
  const sdkDir = path.join(vendorRoot, "sdk");
  const wasmDir = path.join(vendorRoot, "ika-wasm");

  emit?.({
    job: "ika-sdk",
    phase: "starting",
    percent: 0,
    message: `Installing Ika SDK into ${vendorRoot}...`,
    recentLogs: [],
  });

  try {
    await fs.mkdir(vendorRoot, { recursive: true });
    await extractVendorPackage("@ika.xyz/sdk", "0.4.1", sdkDir, emit);

    const wasmBuild = await buildIkaWasmFromToolchain(emit);
    if (!wasmBuild.success) {
      emit?.({
        job: "ika-sdk",
        phase: "extracting",
        percent: null,
        message:
          "Toolchain ika-wasm build failed — falling back to npm @ika.xyz/ika-wasm@0.2.1.",
        recentLogs: [wasmBuild.message],
      });
      await extractVendorPackage("@ika.xyz/ika-wasm", "0.2.1", wasmDir, emit);
    }

    const message = wasmBuild.success
      ? "Installed @ika.xyz/sdk and built ika-wasm from Ika toolchain into vendor/."
      : "Installed @ika.xyz/sdk and npm ika-wasm into vendor/. Rebuild Ika SDK after the Ika repo is installed for V3 DKG support.";
    emitDone(emit ?? (() => undefined), "ika-sdk", true, message, [message]);
    return {
      success: true,
      message,
      stdout: sdkDir,
      stderr: wasmBuild.success ? "" : wasmBuild.stderr,
    };
  } catch (err: any) {
    const stdout = err?.stdout?.toString?.() ?? "";
    const stderr = err?.stderr?.toString?.() ?? "";
    const message =
      [err?.message, stderr, stdout].filter(Boolean).join("\n").trim() ||
      "Failed to install Ika SDK into vendor/.";
    emitDone(emit ?? (() => undefined), "ika-sdk", false, message, [message]);
    return {
      success: false,
      message,
      stdout,
      stderr,
    };
  }
}

export async function updateIkaSdk(
  emit?: ToolchainProgressEmitter,
): Promise<InstallResult> {
  return installIkaSdk(emit);
}

export async function uninstallIkaSdk(): Promise<InstallResult> {
  const vendorRoot = getIkaVendorRoot();
  try {
    await fs.rm(vendorRoot, { recursive: true, force: true });
    return {
      success: true,
      message: "Removed vendored Ika SDK packages.",
      stdout: "",
      stderr: "",
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "Failed to remove vendored Ika SDK.",
      stdout: "",
      stderr: "",
    };
  }
}