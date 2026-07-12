import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { isGitInstalled } from "./git-operations";
import { type InstallResult, toolchainEnv } from "./sui-toolchain";

const execFileAsync = promisify(execFile);

type GitInstallSource = "homebrew" | "winget" | "xcode-clt" | "system" | "unknown";

async function runCommand(
  binary: string,
  args: string[],
  label: string,
  timeoutMs = 1_800_000,
): Promise<InstallResult> {
  try {
    const { stdout, stderr } = await execFileAsync(binary, args, {
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
      env: toolchainEnv(),
    });
    return {
      success: true,
      message: `${label} finished successfully.`,
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
        `${label} failed.`,
      stdout,
      stderr,
    };
  }
}

async function commandExists(binary: string): Promise<boolean> {
  try {
    await execFileAsync(binary, ["--version"], {
      timeout: 10_000,
      env: toolchainEnv(),
    });
    return true;
  } catch {
    try {
      await execFileAsync("which", [binary], {
        timeout: 5_000,
        env: toolchainEnv(),
      });
      return true;
    } catch {
      return false;
    }
  }
}

async function resolveBrewCommand(): Promise<string | null> {
  const candidates = [
    process.env.BREW_PATH,
    "/opt/homebrew/bin/brew",
    "/usr/local/bin/brew",
    "brew",
  ].filter((value): value is string => Boolean(value?.trim()));

  for (const candidate of candidates) {
    if (await commandExists(candidate)) return candidate;
  }

  return null;
}

async function brewAvailable(): Promise<boolean> {
  return (await resolveBrewCommand()) != null;
}

async function runBrew(
  args: string[],
  label: string,
  timeoutMs = 1_800_000,
): Promise<InstallResult> {
  const brew = await resolveBrewCommand();
  if (!brew) {
    return {
      success: false,
      message:
        "Homebrew was not found. Install it from https://brew.sh or use Xcode Command Line Tools.",
      stdout: "",
      stderr: "",
    };
  }

  return runCommand(brew, args, label, timeoutMs);
}

async function brewManagesGit(): Promise<boolean> {
  const brew = await resolveBrewCommand();
  if (!brew) return false;
  try {
    await execFileAsync(brew, ["list", "git"], {
      timeout: 30_000,
      env: toolchainEnv(),
    });
    return true;
  } catch {
    return false;
  }
}

async function detectGitSource(): Promise<GitInstallSource> {
  if (!(await isGitInstalled())) return "unknown";

  if (await brewManagesGit()) return "homebrew";

  if (process.platform === "win32" && (await commandExists("winget"))) {
    return "winget";
  }

  if (process.platform === "darwin") {
    try {
      const { stdout } = await execFileAsync("git", ["--version"], {
        timeout: 10_000,
        env: toolchainEnv(),
      });
      if (/Apple Git/i.test(stdout)) return "xcode-clt";
    } catch {
      // fall through
    }
  }

  return "system";
}

async function installGitDarwin(): Promise<InstallResult> {
  if (await brewAvailable()) {
    return runBrew(["install", "git"], "Git (Homebrew)");
  }

  const result = await runCommand(
    "xcode-select",
    ["--install"],
    "Git (Xcode Command Line Tools)",
    60_000,
  );

  if (
    !result.success &&
    /already installed|can't install/i.test(
      `${result.message}\n${result.stderr}\n${result.stdout}`,
    )
  ) {
    return {
      success: true,
      message:
        "Xcode Command Line Tools are already installed. Git should be available.",
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  if (result.success) {
    return {
      ...result,
      message:
        "Opened the Xcode Command Line Tools installer. Complete the dialog, then refresh toolchain status.",
    };
  }

  return result;
}

async function updateGitDarwin(): Promise<InstallResult> {
  if (await brewManagesGit()) {
    return runBrew(["upgrade", "git"], "Git update (Homebrew)");
  }

  if (await brewAvailable()) {
    const install = await runBrew(["install", "git"], "Git (Homebrew)");
    if (install.success) {
      return {
        ...install,
        message:
          "Installed Git via Homebrew. Beluga will prefer /opt/homebrew/bin/git on the next status refresh.",
      };
    }
  }

  try {
    const { stdout, stderr } = await execFileAsync(
      "softwareupdate",
      ["--list"],
      {
        timeout: 120_000,
        maxBuffer: 5 * 1024 * 1024,
        env: toolchainEnv(),
      },
    );
    const combined = `${stdout}\n${stderr}`;
    const labelMatch = combined.match(
      /^\s*\*?\s*Label:\s*(Command Line Tools[^\n]*)/im,
    );

    if (labelMatch) {
      const label = labelMatch[1].trim();
      const update = await runCommand(
        "softwareupdate",
        ["--install", label],
        "Git / Xcode Command Line Tools update",
        1_800_000,
      );
      if (update.success) return update;
      return {
        ...update,
        message:
          `${update.message}\n\n` +
          `Could not install "${label}" automatically (may require admin rights). ` +
          "Update via System Settings → General → Software Update.",
      };
    }
  } catch {
    // fall through to guidance message
  }

  return {
    success: true,
    message:
      "Git is provided by Xcode Command Line Tools and appears up to date. " +
      "For newer releases, install Homebrew Git:\n\nbrew install git",
    stdout: "",
    stderr: "",
  };
}

async function installGitWindows(): Promise<InstallResult> {
  if (await commandExists("winget")) {
    return runCommand(
      "winget",
      [
        "install",
        "--id",
        "Git.Git",
        "-e",
        "--accept-package-agreements",
        "--accept-source-agreements",
      ],
      "Git (winget)",
    );
  }

  if (await commandExists("choco")) {
    return runCommand(
      "choco",
      ["install", "git", "-y"],
      "Git (Chocolatey)",
    );
  }

  return {
    success: false,
    message:
      "Install Git from https://git-scm.com/download/win or install winget/Chocolatey first.",
    stdout: "",
    stderr: "",
  };
}

async function updateGitWindows(): Promise<InstallResult> {
  if (await commandExists("winget")) {
    return runCommand(
      "winget",
      [
        "upgrade",
        "--id",
        "Git.Git",
        "-e",
        "--accept-package-agreements",
        "--accept-source-agreements",
      ],
      "Git update (winget)",
    );
  }

  if (await commandExists("choco")) {
    return runCommand("choco", ["upgrade", "git", "-y"], "Git update (Chocolatey)");
  }

  return {
    success: false,
    message: "Update Git from https://git-scm.com/download/win or via winget/Chocolatey.",
    stdout: "",
    stderr: "",
  };
}

async function installGitLinux(): Promise<InstallResult> {
  if (await brewAvailable()) {
    return runBrew(["install", "git"], "Git (Homebrew)");
  }

  if (await commandExists("apt-get")) {
    return runCommand(
      "apt-get",
      ["install", "-y", "git"],
      "Git (apt)",
    );
  }

  if (await commandExists("dnf")) {
    return runCommand("dnf", ["install", "-y", "git"], "Git (dnf)");
  }

  if (await commandExists("yum")) {
    return runCommand("yum", ["install", "-y", "git"], "Git (yum)");
  }

  if (await commandExists("pacman")) {
    return runCommand(
      "pacman",
      ["-S", "--noconfirm", "git"],
      "Git (pacman)",
    );
  }

  return {
    success: false,
    message:
      "Install Git with your distro package manager (apt, dnf, pacman) or Homebrew Linux.",
    stdout: "",
    stderr: "",
  };
}

async function updateGitLinux(): Promise<InstallResult> {
  if (await brewManagesGit()) {
    return runBrew(["upgrade", "git"], "Git update (Homebrew)");
  }

  if (await commandExists("apt-get")) {
    return runCommand(
      "apt-get",
      ["install", "--only-upgrade", "-y", "git"],
      "Git update (apt)",
    );
  }

  if (await commandExists("dnf")) {
    return runCommand("dnf", ["upgrade", "-y", "git"], "Git update (dnf)");
  }

  if (await commandExists("yum")) {
    return runCommand("yum", ["update", "-y", "git"], "Git update (yum)");
  }

  if (await commandExists("pacman")) {
    return runCommand(
      "pacman",
      ["-Syu", "--noconfirm", "git"],
      "Git update (pacman)",
    );
  }

  return {
    success: false,
    message: "Update Git with your distro package manager (may require sudo).",
    stdout: "",
    stderr: "",
  };
}

export async function installGit(): Promise<InstallResult> {
  if (await isGitInstalled()) {
    const source = await detectGitSource();
    return {
      success: true,
      message: `Git is already installed (${source}).`,
      stdout: "",
      stderr: "",
    };
  }

  switch (process.platform) {
    case "darwin":
      return installGitDarwin();
    case "win32":
      return installGitWindows();
    default:
      return installGitLinux();
  }
}

export async function updateGit(): Promise<InstallResult> {
  if (!(await isGitInstalled())) {
    return installGit();
  }

  switch (process.platform) {
    case "darwin":
      return updateGitDarwin();
    case "win32":
      return updateGitWindows();
    default:
      return updateGitLinux();
  }
}

