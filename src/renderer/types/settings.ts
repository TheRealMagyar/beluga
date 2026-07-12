// types for the settings page
export type WalrusNetworkConfig = {
  target: string;
  packageId: string;
  registryId: string;
  rpc: string;
};

export type AiAuthMode = "grok-build" | "api-key";

export type AiSettings = {
  enabled: boolean;
  authMode: AiAuthMode;
  apiKey: string;
  model: string;
  includePageContext: boolean;
  allowToolUse: boolean;
};

export type GitHubSettings = {
  clientId: string;
  clientSecret: string;
};

export type AppSettings = {
  autoLaunch: boolean;
  startMinimized: boolean;
  mcpUrl: string;
  walrus: {
    mainnet: WalrusNetworkConfig;
    testnet: WalrusNetworkConfig;
  };
  ai: AiSettings;
  github: GitHubSettings;
};

export type WalrusNetwork = "mainnet" | "testnet";
