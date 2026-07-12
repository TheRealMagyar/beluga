import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { getGitHubAccessToken } from "./github-oauth";

const execFileAsync = promisify(execFile);

export interface GitFileChange {
  path: string;
  status: string;
}

export interface GitStatusResult {
  isRepo: boolean;
  branch: string | null;
  upstream: string | null;
  ahead: number;
  behind: number;
  staged: GitFileChange[];
  unstaged: GitFileChange[];
  untracked: GitFileChange[];
  clean: boolean;
  remoteUrl: string | null;
}

export interface GitLogEntry {
  hash: string;
  subject: string;
  author: string;
  date: string;
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export async function isGitInstalled(): Promise<boolean> {
  try {
    const { toolchainEnv } = await import("./sui-toolchain");
    await execFileAsync("git", ["--version"], {
      timeout: 5000,
      env: toolchainEnv(),
    });
    return true;
  } catch {
    return false;
  }
}

function gitAuthConfigArgs(token: string): string[] {
  const basic = Buffer.from(`x-access-token:${token}`, "utf8").toString("base64");
  return [
    "-c",
    "credential.helper=",
    "-c",
    `http.extraHeader=Authorization: Basic ${basic}`,
  ];
}

function formatGitError(stderr: string, authed: boolean): string {
  const msg = stderr.trim();
  if (
    /does not appear to be a git repository|no such remote|could not read from remote repository/i.test(
      msg,
    )
  ) {
    return [
      "No GitHub remote (origin) is configured for this project.",
      "Open the project's GitHub panel → Connect repo tab and create or link a repository first.",
    ].join(" ");
  }
  if (authed && /invalid credentials|authentication failed/i.test(msg)) {
    return [
      "GitHub authentication failed for git push/pull.",
      "Check Settings → GitHub: use a classic PAT with repo scope, or a fine-grained token with Contents read/write on this repository.",
      "Then disconnect and reconnect your token.",
    ].join(" ");
  }
  return msg;
}

async function runGit(
  cwd: string,
  args: string[],
  options?: { authToken?: string | null; allowFailure?: boolean },
): Promise<{ stdout: string; stderr: string; code: number }> {
  const env: Record<string, string | undefined> = {
    ...process.env,
    GIT_TERMINAL_PROMPT: "0",
    GCM_INTERACTIVE: "never",
  };

  const prefix =
    options?.authToken != null ? gitAuthConfigArgs(options.authToken) : [];

  try {
    const { stdout, stderr } = await execFileAsync("git", [...prefix, ...args], {
      cwd,
      env: env as NodeJS.ProcessEnv,
      maxBuffer: 10 * 1024 * 1024,
      timeout: 120_000,
    });
    return { stdout: stdout.toString(), stderr: stderr.toString(), code: 0 };
  } catch (err: unknown) {
    const e = err as {
      stdout?: Buffer | string;
      stderr?: Buffer | string;
      code?: number;
      message?: string;
    };
    const stdout = e.stdout?.toString?.() ?? "";
    const stderr = e.stderr?.toString?.() ?? e.message ?? "git command failed";
    const code = typeof e.code === "number" ? e.code : 1;
    if (options?.allowFailure) {
      return { stdout, stderr, code };
    }
    const message = stderr.trim() || `git ${args.join(" ")} failed (${code})`;
    throw new Error(formatGitError(message, options?.authToken != null));
  }
}

function parseBranchFromStatusHeader(header: string): string | null {
  const noCommits = header.match(/^No commits yet on (.+?)(?:\s+\[|$)/);
  if (noCommits) {
    return noCommits[1].trim();
  }

  if (header.startsWith("HEAD (no branch)")) {
    return null;
  }

  const branchPart = header.split("...")[0]?.trim();
  if (!branchPart) return null;

  return branchPart.replace(/^HEAD detached at /, "");
}

function isValidBranchName(branch: string): boolean {
  return branch.length > 0 && !/\s/.test(branch) && !branch.startsWith("No commits yet");
}

function parseStatusPorcelain(output: string): Omit<
  GitStatusResult,
  "isRepo" | "remoteUrl"
> {
  const lines = output.split("\n").filter(Boolean);
  let branch: string | null = null;
  let upstream: string | null = null;
  let ahead = 0;
  let behind = 0;
  const staged: GitFileChange[] = [];
  const unstaged: GitFileChange[] = [];
  const untracked: GitFileChange[] = [];

  for (const line of lines) {
    if (line.startsWith("##")) {
      const header = line.slice(3).trim();
      branch = parseBranchFromStatusHeader(header);
      const tracking = header.match(/\.\.\.([^ \]]+)/);
      upstream = tracking?.[1] ?? null;
      const aheadMatch = header.match(/ahead (\d+)/);
      const behindMatch = header.match(/behind (\d+)/);
      ahead = aheadMatch ? Number(aheadMatch[1]) : 0;
      behind = behindMatch ? Number(behindMatch[1]) : 0;
      continue;
    }

    const xy = line.slice(0, 2);
    const filePath = line.slice(3).trim();
    const index = xy[0];
    const worktree = xy[1];

    if (index === "?" && worktree === "?") {
      untracked.push({ path: filePath, status: "untracked" });
      continue;
    }
    if (index !== " " && index !== "?") {
      staged.push({ path: filePath, status: index });
    }
    if (worktree !== " " && worktree !== "?") {
      unstaged.push({ path: filePath, status: worktree });
    }
  }

  const clean =
    staged.length === 0 && unstaged.length === 0 && untracked.length === 0;

  return { branch, upstream, ahead, behind, staged, unstaged, untracked, clean };
}

async function resolveCurrentBranch(projectPath: string): Promise<string | null> {
  const { stdout, code } = await runGit(
    projectPath,
    ["branch", "--show-current"],
    { allowFailure: true },
  );
  if (code === 0) {
    const name = stdout.trim();
    if (name && isValidBranchName(name)) return name;
  }
  return null;
}

export async function gitStatus(projectPath: string): Promise<GitStatusResult> {
  const gitDir = path.join(projectPath, ".git");
  if (!(await pathExists(gitDir))) {
    return {
      isRepo: false,
      branch: null,
      upstream: null,
      ahead: 0,
      behind: 0,
      staged: [],
      unstaged: [],
      untracked: [],
      clean: true,
      remoteUrl: null,
    };
  }

  const { stdout } = await runGit(projectPath, [
    "status",
    "--porcelain=v1",
    "-b",
  ]);

  let remoteUrl: string | null = null;
  const remote = await runGit(
    projectPath,
    ["remote", "get-url", "origin"],
    { allowFailure: true },
  );
  if (remote.code === 0) {
    remoteUrl = remote.stdout.trim() || null;
  }

  const parsed = parseStatusPorcelain(stdout);
  if (parsed.branch && !isValidBranchName(parsed.branch)) {
    parsed.branch = await resolveCurrentBranch(projectPath);
  }

  return {
    isRepo: true,
    remoteUrl,
    ...parsed,
  };
}

export async function gitInit(projectPath: string, branch = "main") {
  await runGit(projectPath, ["init", "-b", branch]);
  return { branch };
}

export async function gitAdd(projectPath: string, paths?: string[]) {
  if (paths?.length) {
    await runGit(projectPath, ["add", "--", ...paths]);
  } else {
    await runGit(projectPath, ["add", "-A"]);
  }
}

export async function gitCommit(projectPath: string, message: string) {
  const msg = message.trim();
  if (!msg) throw new Error("Commit message is required.");
  await runGit(projectPath, ["commit", "-m", msg]);
}

export async function gitRemoteAdd(
  projectPath: string,
  url: string,
  remote = "origin",
) {
  const existing = await runGit(
    projectPath,
    ["remote", "get-url", remote],
    { allowFailure: true },
  );
  if (existing.code === 0) {
    await runGit(projectPath, ["remote", "set-url", remote, url]);
  } else {
    await runGit(projectPath, ["remote", "add", remote, url]);
  }
}

async function authTokenForRemote(): Promise<string | null> {
  return getGitHubAccessToken();
}

export async function gitPush(
  projectPath: string,
  options?: { remote?: string; branch?: string; setUpstream?: boolean },
) {
  const remote = options?.remote ?? "origin";
  const status = await gitStatus(projectPath);
  const branch = options?.branch ?? status.branch;
  if (!branch) throw new Error("No current branch to push.");
  if (!isValidBranchName(branch)) {
    throw new Error(`Invalid branch name "${branch}". Create a commit first, then push again.`);
  }

  const hasCommits = (await gitLog(projectPath, 1)).length > 0;
  if (!hasCommits) {
    throw new Error("Nothing to push yet. Stage files and create a commit first.");
  }

  const token = await authTokenForRemote();
  const args = options?.setUpstream
    ? ["push", "-u", remote, branch]
    : ["push", remote, branch];
  await runGit(projectPath, args, { authToken: token });
}

export async function gitPull(
  projectPath: string,
  options?: { remote?: string; branch?: string },
) {
  const remote = options?.remote ?? "origin";
  const status = await gitStatus(projectPath);
  const branch = options?.branch ?? status.branch;
  if (!branch) throw new Error("No current branch to pull.");

  const token = await authTokenForRemote();
  await runGit(projectPath, ["pull", remote, branch], { authToken: token });
}

export async function gitFetch(projectPath: string, remote = "origin") {
  const token = await authTokenForRemote();
  await runGit(projectPath, ["fetch", remote], { authToken: token });
}

export async function gitBranchList(projectPath: string) {
  const { stdout } = await runGit(projectPath, ["branch", "-a", "--format=%(refname:short)"]);
  return stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export async function gitCheckout(projectPath: string, branch: string) {
  await runGit(projectPath, ["checkout", branch]);
}

export async function gitBranchCreate(
  projectPath: string,
  branch: string,
  checkout = true,
) {
  if (checkout) {
    await runGit(projectPath, ["checkout", "-b", branch]);
  } else {
    await runGit(projectPath, ["branch", branch]);
  }
}

export async function gitMerge(
  projectPath: string,
  branch: string,
  message?: string,
) {
  if (message?.trim()) {
    await runGit(projectPath, ["merge", branch, "-m", message.trim()]);
  } else {
    await runGit(projectPath, ["merge", branch]);
  }
}

export async function gitLog(
  projectPath: string,
  limit = 15,
): Promise<GitLogEntry[]> {
  const { stdout } = await runGit(
    projectPath,
    [
      "log",
      `-n`,
      String(limit),
      `--pretty=format:%H%x1f%an%x1f%ad%x1f%s`,
      `--date=iso`,
    ],
    { allowFailure: true },
  );
  if (!stdout.trim()) return [];
  return stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [hash, author, date, subject] = line.split("\x1f");
      return { hash, author, date, subject };
    });
}