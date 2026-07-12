import { ipcMain } from "electron";
import {
  checkNpmCli,
  createCustomPackage,
  deleteCustomPackage,
  installCatalogPackage,
  installPackagesToProject,
  listCatalog,
  listCustomPackages,
  listInstalled,
  uninstallCatalogPackage,
  updateCatalogPackage,
  updateCustomPackage,
  type CreateCustomPackageInput,
  type UpdateCustomPackageInput,
} from "../helper/package-manager";
import {
  buildIkaBinary,
  cleanupIkaBuildLock,
  cloneIkaRepository,
  getIkaToolchainStatus,
  installIkaSdk,
  rebuildIkaBinary,
  uninstallIkaBinary,
  uninstallIkaRepository,
  uninstallIkaSdk,
  updateIkaRepository,
  updateIkaSdk,
} from "../helper/ika-toolchain";
import { ikaWasmIsInstalled } from "../helper/ika-vendor-path";
import { cancelJob, listActiveJobs } from "../helper/packages-job-manager";
import { installGit, updateGit } from "../helper/git-toolchain";
import {
  getToolchainStatus,
  installRust,
  installSuiCli,
  installSuiup,
  uninstallRust,
  uninstallSuiCli,
  uninstallSuiup,
  updateRust,
  updateSuiCli,
  updateSuiup,
} from "../helper/sui-toolchain";
import type { MainIpcContext } from "./context";

export function registerPackagesIpc(ctx: MainIpcContext) {
  ipcMain.handle("packages:check-npm", async () => checkNpmCli());

  ipcMain.handle(
    "packages:cancel-job",
    async (_event, { jobId }: { jobId: string }) => {
      const cancelled = cancelJob(jobId);
      if (jobId === "ika-binary") {
        await cleanupIkaBuildLock();
      }
      return cancelled;
    },
  );

  ipcMain.handle("packages:list-active-jobs", async () => listActiveJobs());

  ipcMain.handle("packages:get-toolchain-status", async () => ({
    ...(await getToolchainStatus()),
    ika: await getIkaToolchainStatus(),
  }));

  ipcMain.handle("packages:install-rust", async () => installRust());
  ipcMain.handle("packages:install-suiup", async () => installSuiup());
  ipcMain.handle(
    "packages:install-sui-cli",
    async (_event, { method = "suiup" }: { method?: "suiup" | "brew" }) =>
      installSuiCli(method),
  );
  ipcMain.handle("packages:update-rust", async () => updateRust());
  ipcMain.handle("packages:uninstall-rust", async () => uninstallRust());
  ipcMain.handle("packages:update-suiup", async () => updateSuiup());
  ipcMain.handle("packages:uninstall-suiup", async () => uninstallSuiup());
  ipcMain.handle("packages:update-sui-cli", async () => updateSuiCli());
  ipcMain.handle("packages:uninstall-sui-cli", async () => uninstallSuiCli());
  ipcMain.handle("packages:install-git", async () => installGit());
  ipcMain.handle("packages:update-git", async () => updateGit());

  ipcMain.handle("packages:clone-ika-repo", async () =>
    cloneIkaRepository(ctx.broadcastToolchainProgress),
  );
  ipcMain.handle("packages:build-ika-binary", async () =>
    buildIkaBinary(ctx.broadcastToolchainProgress),
  );
  ipcMain.handle("packages:update-ika-repo", async () => updateIkaRepository());
  ipcMain.handle("packages:uninstall-ika-repo", async () =>
    uninstallIkaRepository(),
  );
  ipcMain.handle("packages:rebuild-ika-binary", async () =>
    rebuildIkaBinary(ctx.broadcastToolchainProgress),
  );
  ipcMain.handle("packages:uninstall-ika-binary", async () =>
    uninstallIkaBinary(),
  );
  ipcMain.handle("packages:install-ika-sdk", async () =>
    installIkaSdk(ctx.broadcastToolchainProgress),
  );
  ipcMain.handle("packages:update-ika-sdk", async () =>
    updateIkaSdk(ctx.broadcastToolchainProgress),
  );
  ipcMain.handle("packages:uninstall-ika-sdk", async () => uninstallIkaSdk());
  ipcMain.handle("packages:has-ika-wasm", async () => ikaWasmIsInstalled());

  ipcMain.handle("packages:list-catalog", async () => listCatalog());
  ipcMain.handle("packages:list-custom", async () => listCustomPackages());
  ipcMain.handle(
    "packages:create-custom",
    async (_event, input: CreateCustomPackageInput) => createCustomPackage(input),
  );
  ipcMain.handle(
    "packages:update-custom",
    async (
      _event,
      { id, patch }: { id: string; patch: UpdateCustomPackageInput },
    ) => updateCustomPackage(id, patch),
  );
  ipcMain.handle("packages:delete-custom", async (_event, { id }: { id: string }) => {
    try {
      await uninstallCatalogPackage(id);
    } catch {
      // not installed in cache
    }
    await deleteCustomPackage(id);
    return true;
  });
  ipcMain.handle("packages:list-installed", async () => listInstalled());
  ipcMain.handle("packages:install", async (_event, { id }: { id: string }) =>
    installCatalogPackage(id),
  );
  ipcMain.handle("packages:update", async (_event, { id }: { id: string }) =>
    updateCatalogPackage(id),
  );
  ipcMain.handle("packages:uninstall", async (_event, { id }: { id: string }) => {
    await uninstallCatalogPackage(id);
    return true;
  });
  ipcMain.handle(
    "packages:install-to-project",
    async (
      _event,
      {
        projectPath,
        packageIds,
      }: { projectPath: string; packageIds: string[] },
    ) => {
      await installPackagesToProject(projectPath, packageIds);
      return true;
    },
  );
}