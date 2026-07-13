import { ipcMain, shell } from "electron";
import {
  buildPlaygroundPackage,
  checkSuiCli,
  getPlaygroundWorkspace,
  openPlaygroundWorkspace,
  runPlaygroundShellCommand,
  syncPlaygroundFiles,
} from "../helper/playground-cli";
import {
  ensureIkaRepository,
  getIkaLocalnetConfig,
  getIkaLocalnetLogSnapshot,
  getIkaLocalnetStatus,
  getLocalnetResumeStatus,
  resetIkaLocalnetState,
  startIkaLocalnet,
  stopIkaLocalnet,
} from "../helper/ika-localnet";
import {
  fetchIkaLocalnetExplorerOverview,
  fetchIkaRelatedTransactions,
} from "../helper/ika-explorer";
import {
  healIkaLocalnetEnvironment,
  needsIkaLocalnetHeal,
} from "../helper/ika-localnet-heal";
import {
  getIkaLocalnetStackStatus,
  resetIkaLocalnetStack,
  startIkaLocalnetStack,
  stopIkaLocalnetStack,
} from "../helper/ika-localnet-stack";
import {
  ensureLocalEnvironment,
  fetchLocalAddressOverview,
  fetchLocalCheckpoints,
  fetchLocalNetworkOverview,
  fetchLocalNetworkStats,
  fetchLocalObject,
  fetchLocalTransactionDetail,
  fetchLocalTransactions,
  fetchLocalWalletAssets,
  fetchRecentLocalTransactions,
  getSuiClientStatus,
  getSuiLocalnetLogSnapshot,
  initSuiClient,
  refreshLocalNetworkStatus,
  requestLocalFaucet,
  resetMoveSuiLocalnet,
  startLocalNetwork,
  stopLocalNetwork,
  switchSuiEnvironment,
} from "../helper/sui-client-manager";
import {
  ensurePlaygroundTestWallets,
  getActivePlaygroundSigner,
  getPlaygroundSigners,
  setActivePlaygroundSigner,
  signPlaygroundTransaction,
  type PlaygroundSignerId,
} from "../helper/playground-test-wallets";
import type { MainIpcContext } from "./context";

export function registerPlaygroundIpc(ctx: MainIpcContext) {
  ipcMain.handle("playground:check-cli", async () => checkSuiCli());
  ipcMain.handle("playground:get-workspace", async () => getPlaygroundWorkspace());
  ipcMain.handle("playground:open-workspace", async () => {
    const workspace = await openPlaygroundWorkspace();
    await shell.openPath(workspace);
    return workspace;
  });
  ipcMain.handle(
    "playground:run-shell-command",
    async (_event, { command }: { command: string }) =>
      runPlaygroundShellCommand(command),
  );
  ipcMain.handle(
    "playground:sync-workspace",
    async (_event, { files }: { files: { path: string; content: string }[] }) =>
      syncPlaygroundFiles(files),
  );
  ipcMain.handle(
    "playground:build",
    async (_event, { files }: { files: { path: string; content: string }[] }) =>
      buildPlaygroundPackage(files),
  );
  ipcMain.handle("playground:get-client-status", async () => getSuiClientStatus());
  ipcMain.handle("playground:init-client", async () => initSuiClient());
  ipcMain.handle(
    "playground:switch-env",
    async (_event, { alias }: { alias: string }) => switchSuiEnvironment(alias),
  );
  ipcMain.handle("playground:ensure-local-env", async () =>
    ensureLocalEnvironment(),
  );
  ipcMain.handle(
    "playground:start-local-network",
    async (
      _event,
      options?: {
        forceRegenesis?: boolean;
        withFaucet?: boolean;
        fullnodeRpcPort?: number;
        forIka?: boolean;
        epochDurationMs?: string;
      },
    ) => {
      const status = await startLocalNetwork({ ...options });
      if (options?.forceRegenesis && options?.forIka) {
        await stopIkaLocalnet();
        await resetIkaLocalnetState();
      }
      if (status.rpcReady && !options?.forIka) {
        try {
          await ensurePlaygroundTestWallets();
        } catch {
          // Non-fatal: wallets can be provisioned on first panel open.
        }
      }
      return status;
    },
  );
  ipcMain.handle(
    "playground:stop-local-network",
    async (_event, options?: { stopIka?: boolean }) => {
      if (options?.stopIka !== false) {
        const ikaStatus = await getIkaLocalnetStatus();
        if (ikaStatus.running) {
          await stopIkaLocalnet();
        }
      }
      return stopLocalNetwork();
    },
  );
  ipcMain.handle("playground:reset-move-sui-localnet", async () =>
    resetMoveSuiLocalnet(),
  );
  ipcMain.handle("playground:get-ika-localnet-status", async () =>
    getIkaLocalnetStatus(),
  );
  ipcMain.handle("playground:get-ika-config", async () => getIkaLocalnetConfig());
  ipcMain.handle("playground:ensure-ika-repo", async () => ensureIkaRepository());
  ipcMain.handle(
    "playground:start-ika-localnet",
    async (_event, options?: { reset?: boolean }) => {
      const healCheck = await needsIkaLocalnetHeal();
      if (healCheck.needed) {
        const result = await healIkaLocalnetEnvironment();
        return result.ikaStatus;
      }
      return startIkaLocalnet(options);
    },
  );
  ipcMain.handle("playground:heal-ika-localnet", async () => {
    const result = await healIkaLocalnetEnvironment();
    return {
      message: result.message,
      ikaStatus: result.ikaStatus,
      localStatus: result.localStatus,
    };
  });
  ipcMain.handle("playground:needs-ika-localnet-heal", async () =>
    needsIkaLocalnetHeal(),
  );
  ipcMain.handle("playground:get-localnet-resume-status", async () =>
    getLocalnetResumeStatus(),
  );
  ipcMain.handle("playground:get-localnet-log-snapshot", async () => ({
    sui: getSuiLocalnetLogSnapshot(),
    ika: getIkaLocalnetLogSnapshot(),
  }));
  ipcMain.handle("playground:get-ika-localnet-stack-status", async () =>
    getIkaLocalnetStackStatus(),
  );
  ipcMain.handle("playground:start-ika-localnet-stack", async () =>
    startIkaLocalnetStack(),
  );
  ipcMain.handle("playground:stop-ika-localnet-stack", async () =>
    stopIkaLocalnetStack(),
  );
  ipcMain.handle("playground:reset-ika-localnet-stack", async () =>
    resetIkaLocalnetStack(),
  );
  ipcMain.handle("playground:reset-ika-localnet-state", async () => {
    await stopIkaLocalnet();
    await resetIkaLocalnetState();
    return {
      message: "Ika localnet state wiped. Next start will bootstrap fresh.",
    };
  });
  ipcMain.handle("playground:stop-ika-localnet", async () => stopIkaLocalnet());
  ipcMain.handle("playground:get-local-network-status", async () =>
    refreshLocalNetworkStatus(),
  );
  ipcMain.handle(
    "playground:request-local-faucet",
    async (_event, { recipient }: { recipient?: string } = {}) => {
      const agent = (await ctx.getAgent()) as { address: () => string };
      const target = recipient?.trim() || agent.address();
      return requestLocalFaucet(target);
    },
  );
  ipcMain.handle("playground:get-local-network-stats", async () =>
    fetchLocalNetworkStats(),
  );
  ipcMain.handle("playground:get-local-network-overview", async () =>
    fetchLocalNetworkOverview(),
  );
  ipcMain.handle(
    "playground:get-local-checkpoints",
    async (_event, { limit = 12 }: { limit?: number } = {}) =>
      fetchLocalCheckpoints(limit),
  );
  ipcMain.handle(
    "playground:get-local-recent-transactions",
    async (_event, { limit = 30 }: { limit?: number } = {}) =>
      fetchRecentLocalTransactions(Math.min(limit, 50)),
  );
  ipcMain.handle(
    "playground:get-local-transactions",
    async (
      _event,
      { address, limit = 30 }: { address?: string; limit?: number },
    ) => fetchLocalTransactions(address, limit),
  );
  ipcMain.handle(
    "playground:get-local-transaction-detail",
    async (_event, { digest }: { digest: string }) =>
      fetchLocalTransactionDetail(digest),
  );
  ipcMain.handle(
    "playground:get-local-address-overview",
    async (_event, { address }: { address: string }) =>
      fetchLocalAddressOverview(address),
  );
  ipcMain.handle(
    "playground:get-local-wallet-assets",
    async (_event, { address }: { address: string }) =>
      fetchLocalWalletAssets(address),
  );
  ipcMain.handle(
    "playground:get-local-object",
    async (_event, { objectId }: { objectId: string }) =>
      fetchLocalObject(objectId),
  );
  ipcMain.handle("playground:get-ika-explorer-overview", async () =>
    fetchIkaLocalnetExplorerOverview(),
  );
  ipcMain.handle(
    "playground:get-ika-related-transactions",
    async (_event, { limit = 40 }: { limit?: number } = {}) =>
      fetchIkaRelatedTransactions(Math.min(limit, 50)),
  );
  ipcMain.handle("playground:ensure-test-wallets", async () =>
    ensurePlaygroundTestWallets(),
  );
  ipcMain.handle("playground:get-test-wallets", async () =>
    getPlaygroundSigners(),
  );
  ipcMain.handle(
    "playground:set-active-signer",
    async (_event, { signerId }: { signerId: PlaygroundSignerId }) =>
      setActivePlaygroundSigner(signerId),
  );
  ipcMain.handle("playground:get-active-signer", async () =>
    getActivePlaygroundSigner(),
  );
  ipcMain.handle(
    "playground:sign-transaction",
    async (
      _event,
      {
        signerId,
        transactionBytesB64,
      }: { signerId: PlaygroundSignerId; transactionBytesB64: string },
    ) => {
      try {
        const signed = await signPlaygroundTransaction(
          signerId,
          transactionBytesB64,
        );
        return { success: true, ...signed };
      } catch (err: unknown) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  );
}