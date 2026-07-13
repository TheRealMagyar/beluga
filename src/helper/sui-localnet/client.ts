import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { toolchainEnv } from "../sui-toolchain";
import { pushLog } from "./runtime";
import type { SuiClientStatus } from "./types";

const execFileAsync = promisify(execFile);

export const DEFAULT_RPC_URL = "http://127.0.0.1:9000";
export const DEFAULT_TESTNET_RPC = "https://fullnode.testnet.sui.io:443";
const LOCAL_ENV_ALIASES = ["local", "localnet"];

function resolveSuiBinary() {
  return process.env.SUI_BIN || "sui";
}

function getConfigPath() {
  return path.join(os.homedir(), ".sui", "sui_config", "client.yaml");
}

export async function runSui(args: string[]) {
  pushLog(`$ sui ${args.join(" ")}`);
  const { stdout, stderr } = await execFileAsync(resolveSuiBinary(), args, {
    timeout: 120_000,
    maxBuffer: 5 * 1024 * 1024,
    env: toolchainEnv(),
  });
  if (stdout.trim()) pushLog(stdout);
  if (stderr.trim()) pushLog(stderr);
  return { stdout: stdout.trim(), stderr: stderr.trim() };
}

export async function getSuiClientStatus(): Promise<SuiClientStatus> {
  const configPath = getConfigPath();

  try {
    const { stdout } = await runSui(["client", "envs", "--json"]);
    const parsed = JSON.parse(stdout) as [
      Array<{ alias: string; rpc: string }>,
      string,
    ];
    const environments = (parsed[0] ?? []).map((env) => ({
      alias: env.alias,
      rpc: env.rpc,
      active: env.alias === parsed[1],
    }));

    let activeAddress: string | null = null;
    try {
      const addressResult = await runSui(["client", "active-address"]);
      activeAddress = addressResult.stdout || null;
    } catch {
      activeAddress = null;
    }

    return {
      configured: true,
      configPath,
      activeEnv: parsed[1] ?? null,
      activeAddress,
      environments,
    };
  } catch {
    return {
      configured: false,
      configPath,
      activeEnv: null,
      activeAddress: null,
      environments: [],
    };
  }
}

export async function initSuiClient(): Promise<{ message: string }> {
  await runSui(["client", "-y"]);
  return { message: "Sui client initialized." };
}

export async function switchSuiEnvironment(alias: string): Promise<{ message: string }> {
  await runSui(["client", "switch", "--env", alias]);
  return { message: `Switched to ${alias}.` };
}

export async function ensureTestnetEnvironment(
  rpcUrl = DEFAULT_TESTNET_RPC,
): Promise<{ message: string; created: boolean; alias: string }> {
  let status = await getSuiClientStatus();
  if (!status.configured) {
    await initSuiClient();
    status = await getSuiClientStatus();
  }

  const existing = status.environments.find(
    (env) =>
      env.alias.toLowerCase().includes("testnet") ||
      env.rpc.toLowerCase().includes("testnet"),
  );

  if (existing) {
    return {
      message: `Testnet environment already configured (${existing.alias}).`,
      created: false,
      alias: existing.alias,
    };
  }

  await runSui([
    "client",
    "new-env",
    "--alias",
    "testnet",
    "--rpc",
    rpcUrl,
  ]);

  return {
    message: `Created testnet environment (${rpcUrl}).`,
    created: true,
    alias: "testnet",
  };
}

export async function ensureLocalEnvironment(
  rpcUrl = DEFAULT_RPC_URL,
): Promise<{ message: string; created: boolean }> {
  const status = await getSuiClientStatus();
  const existing = status.environments.find((env) =>
    LOCAL_ENV_ALIASES.includes(env.alias),
  );

  if (existing) {
    return {
      message: `Local environment already configured (${existing.alias}).`,
      created: false,
    };
  }

  await runSui([
    "client",
    "new-env",
    "--alias",
    "localnet",
    "--rpc",
    rpcUrl,
  ]);

  return {
    message: "Created localnet environment at http://127.0.0.1:9000.",
    created: true,
  };
}