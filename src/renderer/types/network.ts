export type SuiNetwork = "mainnet" | "testnet" | "devnet" | "localnet";

export const WALLET_NETWORK_KEY = "beluga-wallet-network-v1";

export const LOCALNET_RPC = "http://127.0.0.1:9000";

export interface SuiNetworkConfig {
  label: string;
  rpc: string;
  faucet: boolean;
  accent: string;
}

export const SUI_NETWORKS: Record<SuiNetwork, SuiNetworkConfig> = {
  mainnet: {
    label: "Mainnet",
    rpc: "https://fullnode.mainnet.sui.io:443",
    faucet: false,
    accent: "#00d4aa",
  },
  testnet: {
    label: "Testnet",
    rpc: "https://fullnode.testnet.sui.io:443",
    faucet: true,
    accent: "#ffb347",
  },
  devnet: {
    label: "Devnet",
    rpc: "https://fullnode.devnet.sui.io:443",
    faucet: true,
    accent: "#4ca3ff",
  },
  localnet: {
    label: "Localnet",
    rpc: LOCALNET_RPC,
    faucet: true,
    accent: "#7dd3fc",
  },
};

export function loadWalletNetwork(): SuiNetwork {
  try {
    const raw = localStorage.getItem(WALLET_NETWORK_KEY);
    if (
      raw === "testnet" ||
      raw === "devnet" ||
      raw === "mainnet" ||
      raw === "localnet"
    ) {
      return raw;
    }
  } catch {
    // ignore
  }
  return "testnet";
}

export function saveWalletNetwork(network: SuiNetwork) {
  localStorage.setItem(WALLET_NETWORK_KEY, network);
}