// types for the settings page
export type WalrusNetworkConfig = {
  target: string;
  packageId: string;
  registryId: string;
  rpc: string;
};

export type AppSettings = {
  autoLaunch: boolean;
  startMinimized: boolean;
  mcpUrl: string;
  walrus: {
    mainnet: WalrusNetworkConfig;
    testnet: WalrusNetworkConfig;
  };
};

export type WalrusNetwork = "mainnet" | "testnet";
