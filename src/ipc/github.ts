import { BrowserWindow, ipcMain } from "electron";
import type { MainIpcContext } from "./context";
import {
  getGitHubAuthStatus,
  logoutGitHub,
  onGitHubOAuthLoginComplete,
  pollGitHubDeviceLogin,
  saveGitHubPat,
  startGitHubDeviceLogin,
  startGitHubOAuthLogin,
  verifyGitHubToken,
} from "../helper/github-oauth";
import {
  connectProjectToExistingGithubRepo,
  connectProjectToNewGithubRepo,
  getGitHubConnectionStatus,
  gitAdd,
  gitBranchCreate,
  gitBranchList,
  gitCheckout,
  gitCommit,
  gitInit,
  gitLog,
  gitMerge,
  listGithubReposForUser,
  projectGitFetch,
  projectGitPull,
  projectGitPush,
  projectGitStatus,
  setProjectGithubVisibility,
} from "../helper/git-project-service";
import { resolveProjectPath } from "../main/project-fs";
import type { GitHubSettings } from "../main/types";

function broadcastEvent(channel: string, payload: Record<string, unknown>) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }
}

function readGitHubSettings(ctx: MainIpcContext): GitHubSettings {
  const github = ctx.settingsStore.get("github");
  return {
    clientId: github?.clientId ?? "",
    clientSecret: github?.clientSecret ?? "",
  };
}

export function registerGitHubIpc(ctx: MainIpcContext) {
  onGitHubOAuthLoginComplete((ok, message) => {
    broadcastEvent("github:oauth-complete", { ok, message });
  });

  ipcMain.handle("github:get-status", async () => {
    const auth = await getGitHubAuthStatus();
    const connection = await getGitHubConnectionStatus();
    return {
      ...auth,
      gitInstalled: connection.gitInstalled,
      clientId: readGitHubSettings(ctx).clientId,
      hasClientSecret: Boolean(readGitHubSettings(ctx).clientSecret),
    };
  });

  ipcMain.handle("github:verify", async () => verifyGitHubToken());

  ipcMain.handle("github:logout", async () => {
    await logoutGitHub();
    return { ok: true };
  });

  ipcMain.handle("github:save-pat", async (_event, params: { token: string }) => {
    const verified = await saveGitHubPat(params.token);
    if (verified.ok) {
      await verifyGitHubToken();
    }
    return verified;
  });

  ipcMain.handle("github:oauth-start", async () => {
    const { clientId, clientSecret } = readGitHubSettings(ctx);
    return startGitHubOAuthLogin({ clientId, clientSecret });
  });

  ipcMain.handle("github:device-start", async () => {
    const { clientId } = readGitHubSettings(ctx);
    return startGitHubDeviceLogin(clientId);
  });

  ipcMain.handle("github:device-poll", async () => pollGitHubDeviceLogin());

  ipcMain.handle("github:list-repos", async (_event, params?: { page?: number }) =>
    listGithubReposForUser(params?.page ?? 1),
  );

  ipcMain.handle(
    "github:project-status",
    async (_event, params: { projectName: string }) =>
      projectGitStatus(params.projectName),
  );

  ipcMain.handle(
    "github:create-repo",
    async (
      _event,
      params: {
        projectName: string;
        repoName?: string;
        description?: string;
        private?: boolean;
        push?: boolean;
      },
    ) => connectProjectToNewGithubRepo(params),
  );

  ipcMain.handle(
    "github:connect-repo",
    async (
      _event,
      params: {
        projectName: string;
        owner: string;
        repo: string;
        push?: boolean;
      },
    ) => connectProjectToExistingGithubRepo(params),
  );

  ipcMain.handle(
    "github:set-repo-visibility",
    async (
      _event,
      params: { projectName: string; private: boolean },
    ) => setProjectGithubVisibility(params.projectName, params.private),
  );

  ipcMain.handle(
    "github:git-init",
    async (_event, params: { projectName: string; branch?: string }) => {
      const projectPath = await resolveProjectPath(params.projectName);
      await gitInit(projectPath, params.branch ?? "main");
      return projectGitStatus(params.projectName);
    },
  );

  ipcMain.handle(
    "github:git-add",
    async (_event, params: { projectName: string; paths?: string[] }) => {
      const projectPath = await resolveProjectPath(params.projectName);
      await gitAdd(projectPath, params.paths);
      return projectGitStatus(params.projectName);
    },
  );

  ipcMain.handle(
    "github:git-commit",
    async (_event, params: { projectName: string; message: string }) => {
      const projectPath = await resolveProjectPath(params.projectName);
      await gitCommit(projectPath, params.message);
      return projectGitStatus(params.projectName);
    },
  );

  ipcMain.handle(
    "github:git-push",
    async (
      _event,
      params: { projectName: string; branch?: string; setUpstream?: boolean },
    ) => projectGitPush(params.projectName, {
      branch: params.branch,
      setUpstream: params.setUpstream,
    }),
  );

  ipcMain.handle(
    "github:git-pull",
    async (_event, params: { projectName: string; branch?: string }) =>
      projectGitPull(params.projectName, { branch: params.branch }),
  );

  ipcMain.handle(
    "github:git-fetch",
    async (_event, params: { projectName: string }) =>
      projectGitFetch(params.projectName),
  );

  ipcMain.handle(
    "github:git-merge",
    async (
      _event,
      params: { projectName: string; branch: string; message?: string },
    ) => {
      const projectPath = await resolveProjectPath(params.projectName);
      await gitMerge(projectPath, params.branch, params.message);
      return projectGitStatus(params.projectName);
    },
  );

  ipcMain.handle(
    "github:git-branches",
    async (_event, params: { projectName: string }) => {
      const projectPath = await resolveProjectPath(params.projectName);
      return gitBranchList(projectPath);
    },
  );

  ipcMain.handle(
    "github:git-checkout",
    async (_event, params: { projectName: string; branch: string }) => {
      const projectPath = await resolveProjectPath(params.projectName);
      await gitCheckout(projectPath, params.branch);
      return projectGitStatus(params.projectName);
    },
  );

  ipcMain.handle(
    "github:git-branch-create",
    async (
      _event,
      params: { projectName: string; branch: string; checkout?: boolean },
    ) => {
      const projectPath = await resolveProjectPath(params.projectName);
      await gitBranchCreate(projectPath, params.branch, params.checkout !== false);
      return projectGitStatus(params.projectName);
    },
  );

  ipcMain.handle(
    "github:git-log",
    async (_event, params: { projectName: string; limit?: number }) => {
      const projectPath = await resolveProjectPath(params.projectName);
      return gitLog(projectPath, params.limit ?? 20);
    },
  );
}