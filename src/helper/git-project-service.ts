import { resolveProjectPath } from "../main/project-fs";
import {
  createGitHubRepo,
  getGitHubRepo,
  getGitHubUser,
  listGitHubRepos,
  updateGitHubRepoVisibility,
} from "./github-api";
import {
  getGitHubAccessToken,
  getGitHubAuthStatus,
} from "./github-oauth";
import {
  gitAdd,
  gitBranchCreate,
  gitBranchList,
  gitCheckout,
  gitCommit,
  gitFetch,
  gitInit,
  gitLog,
  gitMerge,
  gitPull,
  gitPush,
  gitRemoteAdd,
  gitStatus,
  isGitInstalled,
} from "./git-operations";
import {
  getProjectGithubLink,
  linkGithubToProject,
} from "./project-beluga-config";

async function resolveProject(projectName: string): Promise<string> {
  return resolveProjectPath(projectName);
}

export async function ensureProjectGitRemote(projectPath: string): Promise<string> {
  const status = await gitStatus(projectPath);
  if (!status.isRepo) {
    throw new Error("Initialize git for this project before pushing to GitHub.");
  }
  if (status.remoteUrl) {
    return status.remoteUrl;
  }

  const github = await getProjectGithubLink(projectPath);
  if (github?.owner && github?.repo) {
    const remoteRepo = await getGitHubRepo(github.owner, github.repo);
    await gitRemoteAdd(projectPath, remoteRepo.clone_url);
    return remoteRepo.clone_url;
  }

  throw new Error(
    "This project isn't connected to GitHub yet. Open the GitHub panel → Connect repo tab and create or link a repository first.",
  );
}

export async function getGitHubConnectionStatus() {
  const [gitInstalled, auth] = await Promise.all([
    isGitInstalled(),
    getGitHubAuthStatus(),
  ]);
  return { gitInstalled, ...auth };
}

export async function projectGitStatus(projectName: string) {
  const projectPath = await resolveProject(projectName);
  const [status, githubLink] = await Promise.all([
    gitStatus(projectPath),
    getProjectGithubLink(projectPath),
  ]);

  let github = githubLink;
  if (githubLink?.owner && githubLink?.repo) {
    try {
      const remoteRepo = await getGitHubRepo(githubLink.owner, githubLink.repo);
      github = {
        ...githubLink,
        private: remoteRepo.private,
        htmlUrl: remoteRepo.html_url,
        defaultBranch: remoteRepo.default_branch,
      };
    } catch {
      // keep stored link when GitHub is unreachable
    }
  }

  return { projectPath, status, github };
}

export async function connectProjectToNewGithubRepo(params: {
  projectName: string;
  repoName?: string;
  description?: string;
  private?: boolean;
  push?: boolean;
}) {
  const token = await getGitHubAccessToken();
  if (!token) {
    throw new Error("Add a GitHub token in Settings → GitHub first.");
  }

  const projectPath = await resolveProject(params.projectName);
  let status = await gitStatus(projectPath);
  if (!status.isRepo) {
    await gitInit(projectPath);
    status = await gitStatus(projectPath);
  }

  const repoName = (params.repoName ?? params.projectName)
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();

  const repo = await createGitHubRepo({
    name: repoName,
    description: params.description,
    private: params.private ?? true,
  });

  await gitRemoteAdd(projectPath, repo.clone_url);
  const slashOwner = repo.full_name.split("/")[0];
  const ownerLogin =
    slashOwner && repo.full_name.includes("/")
      ? slashOwner
      : (await getGitHubUser(token)).login;

  await linkGithubToProject(projectPath, {
    owner: ownerLogin,
    repo: repo.name,
    defaultBranch: repo.default_branch,
    htmlUrl: repo.html_url,
    private: repo.private,
  });

  if (params.push !== false) {
    const hasChanges = !status.clean || status.untracked.length > 0;
    if (hasChanges || (await gitLog(projectPath, 1)).length === 0) {
      await gitAdd(projectPath);
      const afterAdd = await gitStatus(projectPath);
      if (
        !afterAdd.clean ||
        afterAdd.staged.length > 0 ||
        (await gitLog(projectPath, 1)).length === 0
      ) {
        try {
          await gitCommit(projectPath, "Initial commit from Beluga");
        } catch {
          // nothing to commit
        }
      }
    }
    const pushStatus = await gitStatus(projectPath);
    await gitPush(projectPath, {
      branch: pushStatus.branch ?? repo.default_branch,
      setUpstream: true,
    });
  }

  return {
    repo,
    projectPath,
    status: await gitStatus(projectPath),
  };
}

export async function connectProjectToExistingGithubRepo(params: {
  projectName: string;
  owner: string;
  repo: string;
  push?: boolean;
}) {
  const token = await getGitHubAccessToken();
  if (!token) {
    throw new Error("Add a GitHub token in Settings → GitHub first.");
  }

  const projectPath = await resolveProject(params.projectName);
  const remoteRepo = await getGitHubRepo(params.owner, params.repo);

  let status = await gitStatus(projectPath);
  if (!status.isRepo) {
    await gitInit(projectPath);
    status = await gitStatus(projectPath);
  }

  await gitRemoteAdd(projectPath, remoteRepo.clone_url);
  await linkGithubToProject(projectPath, {
    owner: params.owner,
    repo: params.repo,
    defaultBranch: remoteRepo.default_branch,
    htmlUrl: remoteRepo.html_url,
    private: remoteRepo.private,
  });

  if (params.push) {
    await gitAdd(projectPath);
    try {
      await gitCommit(projectPath, "Sync from Beluga");
    } catch {
      // ignore empty commit
    }
    const pushStatus = await gitStatus(projectPath);
    await gitPush(projectPath, {
      branch: pushStatus.branch ?? remoteRepo.default_branch,
      setUpstream: true,
    });
  }

  return {
    repo: remoteRepo,
    projectPath,
    status: await gitStatus(projectPath),
  };
}

export async function listGithubReposForUser(page = 1) {
  return listGitHubRepos({ page, perPage: 50 });
}

export async function setProjectGithubVisibility(
  projectName: string,
  isPrivate: boolean,
) {
  const projectPath = await resolveProject(projectName);
  const github = await getProjectGithubLink(projectPath);
  if (!github?.owner || !github?.repo) {
    throw new Error("No GitHub repository linked to this project.");
  }

  const repo = await updateGitHubRepoVisibility(
    github.owner,
    github.repo,
    isPrivate,
  );
  await linkGithubToProject(projectPath, {
    ...github,
    private: repo.private,
    htmlUrl: repo.html_url,
    defaultBranch: repo.default_branch,
  });

  return projectGitStatus(projectName);
}

export async function projectGitPush(
  projectName: string,
  options?: { branch?: string; setUpstream?: boolean; message?: string },
) {
  const projectPath = await resolveProject(projectName);
  await ensureProjectGitRemote(projectPath);

  let status = await gitStatus(projectPath);

  const hasCommits = (await gitLog(projectPath, 1)).length > 0;
  const hasChanges =
    !status.clean ||
    status.untracked.length > 0 ||
    status.staged.length > 0 ||
    status.unstaged.length > 0;

  if (!hasCommits || hasChanges) {
    await gitAdd(projectPath);
    status = await gitStatus(projectPath);
    const needsCommit =
      !hasCommits ||
      status.staged.length > 0 ||
      status.unstaged.length > 0 ||
      status.untracked.length > 0;
    if (needsCommit) {
      try {
        await gitCommit(
          projectPath,
          options?.message?.trim() || "Update from Beluga",
        );
      } catch {
        if (!hasCommits) {
          throw new Error("Nothing to push yet. Add files to the project first.");
        }
      }
    }
  }

  status = await gitStatus(projectPath);
  await gitPush(projectPath, {
    branch: options?.branch ?? status.branch ?? undefined,
    setUpstream: options?.setUpstream ?? !status.upstream,
  });

  return projectGitStatus(projectName);
}

export async function projectGitPull(
  projectName: string,
  options?: { branch?: string },
) {
  const projectPath = await resolveProject(projectName);
  await ensureProjectGitRemote(projectPath);
  const status = await gitStatus(projectPath);
  await gitPull(projectPath, {
    branch: options?.branch ?? status.branch ?? undefined,
  });
  return projectGitStatus(projectName);
}

export async function projectGitFetch(projectName: string) {
  const projectPath = await resolveProject(projectName);
  await ensureProjectGitRemote(projectPath);
  await gitFetch(projectPath);
  return projectGitStatus(projectName);
}

export {
  gitAdd,
  gitBranchCreate,
  gitBranchList,
  gitCheckout,
  gitCommit,
  gitFetch,
  gitInit,
  gitLog,
  gitMerge,
  gitPull,
  gitPush,
  gitStatus,
};