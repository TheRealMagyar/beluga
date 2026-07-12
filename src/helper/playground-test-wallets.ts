import fs from "node:fs/promises";
import path from "node:path";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { getBelugaToolchainRoot } from "./beluga-toolchain-path";
import { refreshLocalNetworkStatus } from "./sui-client-manager";
import { requestLocalFaucetCoins } from "./sui-faucet";
import { getAgent } from "../main/agent";

const TEST_WALLET_COUNT = 10;
const LOCALNET_RPC = "http://127.0.0.1:9000";

export type PlaygroundSignerId = "beluga" | `test-${number}`;

export type PlaygroundTestWalletRecord = {
  id: `test-${number}`;
  label: string;
  address: string;
  secretKey: string;
};

type PlaygroundTestWalletsState = {
  activeSignerId: PlaygroundSignerId;
  chainId: string | null;
  fundedChainId: string | null;
  wallets: PlaygroundTestWalletRecord[];
};

export type PlaygroundSignerInfo = {
  id: PlaygroundSignerId;
  label: string;
  address: string;
  balanceSui: number | null;
  isBeluga: boolean;
};

function getStatePath() {
  return path.join(getBelugaToolchainRoot(), "playground-test-wallets.json");
}

function defaultState(): PlaygroundTestWalletsState {
  return {
    activeSignerId: "beluga",
    chainId: null,
    fundedChainId: null,
    wallets: [],
  };
}

async function readState(): Promise<PlaygroundTestWalletsState> {
  try {
    const raw = await fs.readFile(getStatePath(), "utf-8");
    const parsed = JSON.parse(raw) as PlaygroundTestWalletsState;
    return {
      ...defaultState(),
      ...parsed,
      wallets: Array.isArray(parsed.wallets) ? parsed.wallets : [],
    };
  } catch {
    return defaultState();
  }
}

async function writeState(state: PlaygroundTestWalletsState) {
  await fs.mkdir(path.dirname(getStatePath()), { recursive: true });
  await fs.writeFile(getStatePath(), JSON.stringify(state, null, 2), "utf-8");
}

function isTestSignerId(id: string): id is `test-${number}` {
  return /^test-\d+$/.test(id);
}

function createTestWallet(index: number): PlaygroundTestWalletRecord {
  const keypair = Ed25519Keypair.generate();
  const id = `test-${index}` as const;
  return {
    id,
    label: `Test Wallet ${index}`,
    address: keypair.toSuiAddress(),
    secretKey: keypair.getSecretKey(),
  };
}

async function getLocalChainId(): Promise<string> {
  const client = new SuiJsonRpcClient({
    url: LOCALNET_RPC,
    network: "testnet",
  });
  return client.getChainIdentifier();
}

async function resolveBelugaAddress(): Promise<string | null> {
  try {
    const agent = (await getAgent()) as { address: () => string };
    return agent.address();
  } catch {
    return null;
  }
}

async function fetchBalanceSui(address: string): Promise<number | null> {
  try {
    const client = new SuiJsonRpcClient({
      url: LOCALNET_RPC,
      network: "testnet",
    });
    const balance = await client.getBalance({ owner: address });
    return Number(balance.totalBalance) / 1_000_000_000;
  } catch {
    return null;
  }
}

async function fundTestWallets(
  wallets: PlaygroundTestWalletRecord[],
  faucetUrl: string,
): Promise<void> {
  for (const wallet of wallets) {
    try {
      await requestLocalFaucetCoins(wallet.address, faucetUrl);
    } catch {
      // Continue funding remaining wallets even if one fails.
    }
  }
}

export async function ensurePlaygroundTestWallets(): Promise<{
  wallets: PlaygroundTestWalletRecord[];
  funded: boolean;
}> {
  const status = await refreshLocalNetworkStatus();
  if (!status.rpcReady) {
    throw new Error("Local network is not running.");
  }

  const chainId = await getLocalChainId();
  const state = await readState();

  if (state.wallets.length < TEST_WALLET_COUNT) {
    const existing = new Map(state.wallets.map((wallet) => [wallet.id, wallet]));
    const wallets: PlaygroundTestWalletRecord[] = [];
    for (let index = 1; index <= TEST_WALLET_COUNT; index += 1) {
      const id = `test-${index}` as const;
      wallets.push(existing.get(id) ?? createTestWallet(index));
    }
    state.wallets = wallets;
  }

  state.chainId = chainId;

  let funded = false;
  if (state.fundedChainId !== chainId) {
    await fundTestWallets(state.wallets, status.faucetUrl);
    state.fundedChainId = chainId;
    funded = true;
  }

  await writeState(state);
  return { wallets: state.wallets, funded };
}

export async function getPlaygroundSigners(): Promise<{
  activeSignerId: PlaygroundSignerId;
  signers: PlaygroundSignerInfo[];
}> {
  const status = await refreshLocalNetworkStatus();
  const state = await readState();
  const belugaAddress = await resolveBelugaAddress();

  const signers: PlaygroundSignerInfo[] = [];

  if (belugaAddress) {
    signers.push({
      id: "beluga",
      label: "Beluga Wallet",
      address: belugaAddress,
      balanceSui:
        status.rpcReady ? await fetchBalanceSui(belugaAddress) : null,
      isBeluga: true,
    });
  }

  for (const wallet of state.wallets) {
    signers.push({
      id: wallet.id,
      label: wallet.label,
      address: wallet.address,
      balanceSui:
        status.rpcReady ? await fetchBalanceSui(wallet.address) : null,
      isBeluga: false,
    });
  }

  const activeExists = signers.some((signer) => signer.id === state.activeSignerId);
  const activeSignerId = activeExists ? state.activeSignerId : "beluga";

  return { activeSignerId, signers };
}

export async function setActivePlaygroundSigner(
  signerId: PlaygroundSignerId,
): Promise<{ activeSignerId: PlaygroundSignerId; address: string | null }> {
  const state = await readState();

  if (signerId === "beluga") {
    state.activeSignerId = "beluga";
    await writeState(state);
    return { activeSignerId: "beluga", address: await resolveBelugaAddress() };
  }

  if (!isTestSignerId(signerId)) {
    throw new Error(`Unknown signer: ${signerId}`);
  }

  const wallet = state.wallets.find((entry) => entry.id === signerId);
  if (!wallet) {
    throw new Error(`Test wallet not found: ${signerId}`);
  }

  state.activeSignerId = signerId;
  await writeState(state);
  return { activeSignerId: signerId, address: wallet.address };
}

export async function getActivePlaygroundSigner(): Promise<{
  activeSignerId: PlaygroundSignerId;
  address: string | null;
}> {
  const state = await readState();

  if (state.activeSignerId === "beluga") {
    return { activeSignerId: "beluga", address: await resolveBelugaAddress() };
  }

  const wallet = state.wallets.find((entry) => entry.id === state.activeSignerId);
  if (!wallet) {
    return { activeSignerId: "beluga", address: await resolveBelugaAddress() };
  }

  return { activeSignerId: state.activeSignerId, address: wallet.address };
}

export async function signPlaygroundTransaction(
  signerId: PlaygroundSignerId,
  transactionBytesB64: string,
): Promise<{ signature: string; bytes: string }> {
  const bytes = Buffer.from(transactionBytesB64, "base64");

  if (signerId === "beluga") {
    const agent = (await getAgent()) as {
      keypair: {
        signTransaction: (payload: Buffer) => Promise<{
          signature: string;
          bytes: string | Uint8Array;
        }>;
      };
    };
    const { signature, bytes: signedBytes } =
      await agent.keypair.signTransaction(bytes);
    return {
      signature,
      bytes:
        typeof signedBytes === "string"
          ? signedBytes
          : Buffer.from(signedBytes).toString("base64"),
    };
  }

  const state = await readState();
  const wallet = state.wallets.find((entry) => entry.id === signerId);
  if (!wallet) {
    throw new Error(`Test wallet not found: ${signerId}`);
  }

  const keypair = Ed25519Keypair.fromSecretKey(wallet.secretKey);
  const { signature, bytes: signedBytes } = await keypair.signTransaction(bytes);
  return {
    signature,
    bytes:
      typeof signedBytes === "string"
        ? signedBytes
        : Buffer.from(signedBytes).toString("base64"),
  };
}