import { callRenderer } from "./renderer-ipc";
import {
  buildPlaygroundPackage,
  checkSuiCli,
  getPlaygroundWorkspace,
  syncPlaygroundFiles,
} from "./playground-cli";
import { buildAndPublishPlayground } from "./playground-publish";
import {
  linkPackagesToProject,
  unlinkPackagesFromProject,
} from "./project-beluga-config";
import {
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
} from "./package-manager";
import { getToolchainStatus } from "./sui-toolchain";
import { getIkaToolchainStatus } from "./ika-toolchain";
import { executeGrpcQuery, listGrpcQueryCatalog } from "./grpc-query";
import { fetchAddressGraph } from "./tx-visualizer";
import { scanToken } from "./token-scanner";
import {
  buildTokenPackage,
  type TokenGeneratorConfig,
} from "./token-generator";
import { buildNftPackage, type NftContractConfig } from "./nft-manager";
import { getAgent, setAgent } from "../main/agent";
import { resolveProjectPath } from "../main/project-fs";
import { requestFaucetCoins } from "./sui-faucet";
import { getSimpleWalletBalance } from "./sui-rpc";
import {
  getSuiClientStatus,
  getSuiLocalnetLogSnapshot,
  fetchLocalNetworkOverview,
  fetchLocalNetworkStats,
  refreshLocalNetworkStatus,
  requestLocalFaucet,
  resetMoveSuiLocalnet,
  startLocalNetwork,
  stopLocalNetwork,
} from "./sui-client-manager";
import {
  getIkaLocalnetLogSnapshot,
  getIkaLocalnetStatus,
  startIkaLocalnet,
  stopIkaLocalnet,
} from "./ika-localnet";
import { healIkaLocalnetEnvironment } from "./ika-localnet-heal";
import {
  getIkaLocalnetStackStatus,
  resetIkaLocalnetStack,
  startIkaLocalnetStack,
  stopIkaLocalnetStack,
} from "./ika-localnet-stack";
import { fetchIkaLocalnetExplorerOverview } from "./ika-explorer";
import { getLocalnetResumeStatus } from "./ika-localnet";

import {
  connectProjectToExistingGithubRepo,
  connectProjectToNewGithubRepo,
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
} from "./git-project-service";

const EXTENDED_TOOL_NAMES = new Set([
  "playground_get_status",
  "playground_get_workspace",
  "playground_write_files",
  "playground_build",
  "playground_publish",
  "playground_start_sui_localnet",
  "playground_stop_sui_localnet",
  "playground_reset_sui_localnet",
  "playground_request_faucet",
  "playground_get_localnet_logs",
  "playground_get_localnet_overview",
  "playground_start_ika_localnet",
  "playground_stop_ika_localnet",
  "playground_start_ika_stack",
  "playground_stop_ika_stack",
  "playground_reset_ika_stack",
  "playground_heal_ika",
  "playground_get_ika_status",
  "playground_get_ika_explorer",
  "playground_create_dwallet",
  "playground_list_dwallets",
  "packages_list_catalog",
  "packages_list_installed",
  "packages_get_toolchain_status",
  "packages_install",
  "packages_update",
  "packages_uninstall",
  "packages_install_to_project",
  "packages_link_to_project",
  "packages_unlink_from_project",
  "packages_list_custom",
  "packages_create_custom",
  "packages_update_custom",
  "packages_delete_custom",
  "tool_scan_token",
  "tool_build_token_package",
  "tool_build_nft_package",
  "tool_list_grpc_catalog",
  "tool_grpc_query",
  "tool_fetch_address_graph",
  "wallet_get_info",
  "wallet_generate",
  "wallet_get_balance",
  "wallet_request_faucet",
  "wallet_send_sui",
  "git_status",
  "git_init",
  "git_add",
  "git_commit",
  "git_push",
  "git_pull",
  "git_fetch",
  "git_branch",
  "git_merge",
  "git_log",
  "github_create_repo",
  "github_connect_repo",
  "github_set_repo_visibility",
  "github_list_repos",
]);

export function isExtendedBelugaTool(name: string): boolean {
  return EXTENDED_TOOL_NAMES.has(name);
}

function parseFiles(
  args: Record<string, unknown> | undefined,
): { path: string; content: string }[] {
  const raw = args?.files;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("files array is required with at least one { path, content }.");
  }
  return raw.map((f) => {
    const item = f as { path?: string; content?: string };
    if (!item.path || item.content === undefined) {
      throw new Error("Each file needs path and content.");
    }
    return { path: item.path, content: item.content };
  });
}

export async function executeExtendedBelugaTool(
  name: string,
  args: Record<string, unknown> | undefined,
): Promise<{ text: string; isError: boolean } | null> {
  if (!isExtendedBelugaTool(name)) return null;

  try {
    switch (name) {
      case "playground_get_status": {
        const [cli, client, local] = await Promise.all([
          checkSuiCli(),
          getSuiClientStatus(),
          refreshLocalNetworkStatus(),
        ]);
        return {
          text: JSON.stringify({ cli, client, local }, null, 2),
          isError: false,
        };
      }

      case "playground_get_workspace": {
        const workspace = await getPlaygroundWorkspace();
        return { text: workspace, isError: false };
      }

      case "playground_write_files": {
        const files = parseFiles(args);
        const workspace = await syncPlaygroundFiles(files);
        return {
          text: `✅ Wrote ${files.length} file(s) to ${workspace}`,
          isError: false,
        };
      }

      case "playground_build": {
        const build = await buildPlaygroundPackage(parseFiles(args));
        return {
          text: JSON.stringify(
            {
              modules: build.modules.length,
              dependencies: build.dependencies,
              stdout: build.stdout.slice(0, 2000),
              stderr: build.stderr.slice(0, 2000),
            },
            null,
            2,
          ),
          isError: false,
        };
      }

      case "playground_publish": {
        const result = await buildAndPublishPlayground({
          files: parseFiles(args),
          network: args?.network as
            | "mainnet"
            | "testnet"
            | "devnet"
            | "localnet"
            | undefined,
        });
        return {
          text: `✅ Published on ${result.network}\nPackage: ${result.packageId}\nDigest: ${result.digest}`,
          isError: false,
        };
      }

      case "playground_start_sui_localnet": {
        const status = await startLocalNetwork({
          withFaucet: args?.with_faucet !== false,
          forceRegenesis: Boolean(args?.force_regenesis),
          forIka: Boolean(args?.for_ika),
        });
        return { text: JSON.stringify(status, null, 2), isError: false };
      }

      case "playground_stop_sui_localnet": {
        const status = await stopLocalNetwork();
        if (args?.stop_ika !== false) {
          await stopIkaLocalnet().catch(() => undefined);
        }
        return { text: JSON.stringify(status, null, 2), isError: false };
      }

      case "playground_reset_sui_localnet": {
        const status = await resetMoveSuiLocalnet();
        return { text: JSON.stringify(status, null, 2), isError: false };
      }

      case "playground_request_faucet": {
        const agent = (await getAgent()) as { address: () => string };
        const recipient =
          (args?.recipient as string)?.trim() || agent.address();
        const result = await requestLocalFaucet(recipient);
        return { text: JSON.stringify(result, null, 2), isError: false };
      }

      case "playground_get_localnet_logs": {
        const tail = Math.min(Number(args?.tail) || 80, 200);
        const sui = getSuiLocalnetLogSnapshot().slice(-tail);
        const ika = getIkaLocalnetLogSnapshot().slice(-tail);
        return {
          text: JSON.stringify({ sui, ika }, null, 2),
          isError: false,
        };
      }

      case "playground_get_localnet_overview": {
        const [overview, stats, resume, local] = await Promise.all([
          fetchLocalNetworkOverview(),
          fetchLocalNetworkStats(),
          getLocalnetResumeStatus(),
          refreshLocalNetworkStatus(),
        ]);
        return {
          text: JSON.stringify({ overview, stats, resume, local }, null, 2),
          isError: false,
        };
      }

      case "playground_start_ika_localnet": {
        const status = await startIkaLocalnet({
          reset: Boolean(args?.reset),
        });
        return { text: JSON.stringify(status, null, 2), isError: false };
      }

      case "playground_stop_ika_localnet": {
        const status = await stopIkaLocalnet();
        return { text: JSON.stringify(status, null, 2), isError: false };
      }

      case "playground_start_ika_stack": {
        const status = await startIkaLocalnetStack();
        return { text: JSON.stringify(status, null, 2), isError: false };
      }

      case "playground_stop_ika_stack": {
        const status = await stopIkaLocalnetStack();
        return { text: JSON.stringify(status, null, 2), isError: false };
      }

      case "playground_reset_ika_stack": {
        const status = await resetIkaLocalnetStack();
        return { text: JSON.stringify(status, null, 2), isError: false };
      }

      case "playground_heal_ika": {
        const result = await healIkaLocalnetEnvironment();
        return { text: JSON.stringify(result, null, 2), isError: false };
      }

      case "playground_get_ika_status": {
        const [ika, stack] = await Promise.all([
          getIkaLocalnetStatus(),
          getIkaLocalnetStackStatus(),
        ]);
        return {
          text: JSON.stringify({ ika, stack }, null, 2),
          isError: false,
        };
      }

      case "playground_get_ika_explorer": {
        const overview = await fetchIkaLocalnetExplorerOverview();
        return { text: JSON.stringify(overview, null, 2), isError: false };
      }

      case "playground_create_dwallet": {
        const result = await callRenderer<{
          dWalletId: string;
          dWalletCapId: string;
          digest: string;
          curve: string;
        }>("mcp:playground-create-dwallet", {
          curve: (args?.curve as string) ?? "secp256k1",
        });
        return {
          text: `✅ dWallet created (${result.curve})\nID: ${result.dWalletId}\nCap: ${result.dWalletCapId}\nDigest: ${result.digest}`,
          isError: false,
        };
      }

      case "playground_list_dwallets": {
        const caps = await callRenderer<unknown[]>("mcp:playground-list-dwallets");
        return {
          text: JSON.stringify(caps, null, 2),
          isError: false,
        };
      }

      case "packages_list_catalog": {
        const catalog = await listCatalog();
        return { text: JSON.stringify(catalog, null, 2), isError: false };
      }

      case "packages_list_installed": {
        const installed = await listInstalled();
        return { text: JSON.stringify(installed, null, 2), isError: false };
      }

      case "packages_list_custom": {
        const custom = await listCustomPackages();
        return { text: JSON.stringify(custom, null, 2), isError: false };
      }

      case "packages_create_custom": {
        const record = await createCustomPackage({
          name: args?.name as string,
          description: args?.description as string,
          id: args?.id as string | undefined,
          dependencies: (args?.dependencies as Record<string, string>) ?? {},
          devDependencies:
            (args?.dev_dependencies as Record<string, string>) ?? {},
          category: args?.category as
            | "core"
            | "wallet"
            | "storage"
            | "payments"
            | "tooling"
            | undefined,
          docsUrl: args?.docs_url as string | undefined,
        });
        return {
          text: `✅ Created custom package ${record.id}\n${JSON.stringify(record, null, 2)}`,
          isError: false,
        };
      }

      case "packages_update_custom": {
        const record = await updateCustomPackage(args?.package_id as string, {
          name: args?.name as string | undefined,
          description: args?.description as string | undefined,
          dependencies: args?.dependencies as
            | Record<string, string>
            | undefined,
          devDependencies: args?.dev_dependencies as
            | Record<string, string>
            | undefined,
          category: args?.category as
            | "core"
            | "wallet"
            | "storage"
            | "payments"
            | "tooling"
            | undefined,
          docsUrl: args?.docs_url as string | undefined,
        });
        return {
          text: `✅ Updated custom package ${record.id}`,
          isError: false,
        };
      }

      case "packages_delete_custom": {
        try {
          await uninstallCatalogPackage(args?.package_id as string);
        } catch {
          // not in cache
        }
        await deleteCustomPackage(args?.package_id as string);
        return {
          text: `✅ Deleted custom package ${args?.package_id}`,
          isError: false,
        };
      }

      case "packages_get_toolchain_status": {
        const [sui, ika] = await Promise.all([
          getToolchainStatus(),
          getIkaToolchainStatus(),
        ]);
        return {
          text: JSON.stringify({ sui, ika }, null, 2),
          isError: false,
        };
      }

      case "packages_install": {
        const info = await installCatalogPackage(args?.package_id as string);
        return {
          text: `✅ Installed ${info.id} at ${info.path}`,
          isError: false,
        };
      }

      case "packages_update": {
        const info = await updateCatalogPackage(args?.package_id as string);
        return { text: `✅ Updated ${info.id}`, isError: false };
      }

      case "packages_uninstall": {
        await uninstallCatalogPackage(args?.package_id as string);
        return {
          text: `✅ Uninstalled ${args?.package_id}`,
          isError: false,
        };
      }

      case "packages_install_to_project": {
        const projectPath = await resolveProjectPath(
          args?.project_name as string,
        );
        const ids = args?.package_ids as string[];
        await installPackagesToProject(projectPath, ids);
        return {
          text: `✅ Installed ${ids.join(", ")} into ${args?.project_name}`,
          isError: false,
        };
      }

      case "packages_link_to_project": {
        const projectPath = await resolveProjectPath(
          args?.project_name as string,
        );
        const ids = args?.package_ids as string[];
        const config = await linkPackagesToProject(projectPath, ids);
        if (args?.install !== false) {
          await installPackagesToProject(projectPath, ids);
        }
        return {
          text: `✅ Linked packages: ${config.packages.join(", ")}`,
          isError: false,
        };
      }

      case "packages_unlink_from_project": {
        const projectPath = await resolveProjectPath(
          args?.project_name as string,
        );
        const config = await unlinkPackagesFromProject(
          projectPath,
          args?.package_ids as string[],
        );
        return {
          text: `✅ Project packages: ${config.packages.join(", ") || "(none)"}`,
          isError: false,
        };
      }

      case "tool_scan_token": {
        const report = await scanToken(
          args?.input as string,
          (args?.network as "mainnet" | "testnet" | "devnet" | "localnet") ??
            "mainnet",
        );
        return { text: JSON.stringify(report, null, 2), isError: false };
      }

      case "tool_build_token_package": {
        const pkg = await buildTokenPackage(
          args?.config as TokenGeneratorConfig,
        );
        return { text: JSON.stringify(pkg, null, 2), isError: false };
      }

      case "tool_build_nft_package": {
        const pkg = await buildNftPackage(args?.config as NftContractConfig);
        return { text: JSON.stringify(pkg, null, 2), isError: false };
      }

      case "tool_list_grpc_catalog": {
        const catalog = await listGrpcQueryCatalog();
        return { text: JSON.stringify(catalog, null, 2), isError: false };
      }

      case "tool_grpc_query": {
        const result = await executeGrpcQuery({
          network: args?.network as
            | "mainnet"
            | "testnet"
            | "devnet"
            | "localnet",
          service: args?.service as Parameters<typeof executeGrpcQuery>[0]["service"],
          method: args?.method as string,
          request: args?.request as Record<string, unknown> | undefined,
        });
        return { text: JSON.stringify(result, null, 2), isError: false };
      }

      case "tool_fetch_address_graph": {
        const graph = await fetchAddressGraph(
          args?.address as string,
          (args?.network as "mainnet" | "testnet" | "devnet") ?? "mainnet",
          Number(args?.limit) || 25,
        );
        return { text: JSON.stringify(graph, null, 2), isError: false };
      }

      case "wallet_get_info": {
        const agent = (await getAgent()) as {
          address: () => string;
          keypair: { getPublicKey: () => { toSuiPublicKey: () => string } };
        };
        return {
          text: JSON.stringify(
            {
              address: agent.address(),
              publicKey: agent.keypair.getPublicKey().toSuiPublicKey(),
            },
            null,
            2,
          ),
          isError: false,
        };
      }

      case "wallet_generate": {
        const { T2000 } = await import("@t2000/sdk");
        const { agent, address } = await T2000.init();
        setAgent(agent);
        const publicKey = (
          agent as { keypair: { getPublicKey: () => { toSuiPublicKey: () => string } } }
        ).keypair
          .getPublicKey()
          .toSuiPublicKey();
        return {
          text: `✅ Wallet created\nAddress: ${address}\nPublic key: ${publicKey}`,
          isError: false,
        };
      }

      case "wallet_get_balance": {
        const agent = (await getAgent()) as { address: () => string };
        const network =
          (args?.network as "mainnet" | "testnet" | "devnet" | "localnet") ??
          "testnet";
        const address = agent.address();
        if (network === "mainnet") {
          const bal = await (
            agent as { balance: () => Promise<unknown> }
          ).balance();
          return { text: JSON.stringify(bal, null, 2), isError: false };
        }
        const balance = await getSimpleWalletBalance(address, network);
        return { text: JSON.stringify(balance, null, 2), isError: false };
      }

      case "wallet_request_faucet": {
        const agent = (await getAgent()) as { address: () => string };
        const network = args?.network as "testnet" | "devnet" | "localnet";
        const recipient =
          (args?.recipient as string)?.trim() || agent.address();
        const result = await requestFaucetCoins(network, recipient);
        return { text: JSON.stringify(result, null, 2), isError: false };
      }

      case "wallet_send_sui": {
        const agent = (await getAgent()) as {
          send: (opts: {
            to: string;
            amount: number;
            asset: string;
          }) => Promise<{ digest: string }>;
        };
        const result = await agent.send({
          to: args?.to as string,
          amount: Number(args?.amount),
          asset: (args?.asset as string) || "SUI",
        });
        return {
          text: `✅ Sent ${args?.amount} SUI to ${args?.to}\nDigest: ${result.digest}`,
          isError: false,
        };
      }

      case "git_status": {
        const result = await projectGitStatus(args?.project_name as string);
        return { text: JSON.stringify(result, null, 2), isError: false };
      }

      case "git_init": {
        const projectPath = await resolveProjectPath(args?.project_name as string);
        await gitInit(
          projectPath,
          (args?.branch as string) || "main",
        );
        const status = await projectGitStatus(args?.project_name as string);
        return {
          text: `✅ Git initialized.\n${JSON.stringify(status, null, 2)}`,
          isError: false,
        };
      }

      case "git_add": {
        const projectPath = await resolveProjectPath(args?.project_name as string);
        const paths = args?.paths as string[] | undefined;
        await gitAdd(projectPath, paths?.length ? paths : undefined);
        const status = await projectGitStatus(args?.project_name as string);
        return {
          text: `✅ Staged changes.\n${JSON.stringify(status.status, null, 2)}`,
          isError: false,
        };
      }

      case "git_commit": {
        const projectPath = await resolveProjectPath(args?.project_name as string);
        await gitCommit(projectPath, args?.message as string);
        const log = await gitLog(projectPath, 3);
        return {
          text: `✅ Committed.\nRecent:\n${JSON.stringify(log, null, 2)}`,
          isError: false,
        };
      }

      case "git_push": {
        const status = await projectGitPush(args?.project_name as string, {
          branch: args?.branch as string | undefined,
          setUpstream: args?.set_upstream !== false,
        });
        return {
          text: `✅ Pushed.\n${JSON.stringify(status.status, null, 2)}`,
          isError: false,
        };
      }

      case "git_pull": {
        const status = await projectGitPull(args?.project_name as string, {
          branch: args?.branch as string | undefined,
        });
        return {
          text: `✅ Pulled.\n${JSON.stringify(status.status, null, 2)}`,
          isError: false,
        };
      }

      case "git_fetch": {
        const status = await projectGitFetch(args?.project_name as string);
        return {
          text: `✅ Fetched.\n${JSON.stringify(status.status, null, 2)}`,
          isError: false,
        };
      }

      case "git_branch": {
        const projectPath = await resolveProjectPath(args?.project_name as string);
        const action = args?.action as "list" | "create" | "checkout";
        if (action === "list") {
          const branches = await gitBranchList(projectPath);
          return { text: JSON.stringify(branches, null, 2), isError: false };
        }
        const name = args?.name as string;
        if (!name) {
          return { text: "❌ branch name is required.", isError: true };
        }
        if (action === "create") {
          await gitBranchCreate(projectPath, name, args?.checkout !== false);
        } else {
          await gitCheckout(projectPath, name);
        }
        const status = await projectGitStatus(args?.project_name as string);
        return {
          text: `✅ Branch ${action} complete.\n${JSON.stringify(status.status, null, 2)}`,
          isError: false,
        };
      }

      case "git_merge": {
        const projectPath = await resolveProjectPath(args?.project_name as string);
        await gitMerge(
          projectPath,
          args?.branch as string,
          args?.message as string | undefined,
        );
        const status = await projectGitStatus(args?.project_name as string);
        return {
          text: `✅ Merged.\n${JSON.stringify(status.status, null, 2)}`,
          isError: false,
        };
      }

      case "git_log": {
        const projectPath = await resolveProjectPath(args?.project_name as string);
        const log = await gitLog(projectPath, (args?.limit as number) ?? 15);
        return { text: JSON.stringify(log, null, 2), isError: false };
      }

      case "github_create_repo": {
        const result = await connectProjectToNewGithubRepo({
          projectName: args?.project_name as string,
          repoName: args?.repo_name as string | undefined,
          description: args?.description as string | undefined,
          private: args?.private as boolean | undefined,
          push: args?.push !== false,
        });
        return {
          text: `✅ GitHub repo created: ${result.repo.html_url}\n${JSON.stringify(result, null, 2)}`,
          isError: false,
        };
      }

      case "github_connect_repo": {
        const result = await connectProjectToExistingGithubRepo({
          projectName: args?.project_name as string,
          owner: args?.owner as string,
          repo: args?.repo as string,
          push: Boolean(args?.push),
        });
        return {
          text: `✅ Linked to ${result.repo.html_url}\n${JSON.stringify(result, null, 2)}`,
          isError: false,
        };
      }

      case "github_set_repo_visibility": {
        const isPrivate = args?.private as boolean;
        if (typeof isPrivate !== "boolean") {
          return { text: "❌ private (boolean) is required.", isError: true };
        }
        const status = await setProjectGithubVisibility(
          args?.project_name as string,
          isPrivate,
        );
        return {
          text: `✅ Repository is now ${isPrivate ? "private" : "public"}.\n${JSON.stringify(status.github, null, 2)}`,
          isError: false,
        };
      }

      case "github_list_repos": {
        const repos = await listGithubReposForUser((args?.page as number) ?? 1);
        return { text: JSON.stringify(repos, null, 2), isError: false };
      }

      default:
        return null;
    }
  } catch (e: unknown) {
    return {
      text: `❌ Error: ${e instanceof Error ? e.message : String(e)}`,
      isError: true,
    };
  }
}