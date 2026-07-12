export interface WalrusNetworkConfig {
  target: string;
  packageId: string;
  registryId: string;
  rpc: string;
}

export type AiAuthMode = "grok-build" | "api-key";

export interface AiSettings {
  enabled: boolean;
  authMode: AiAuthMode;
  apiKey: string;
  model: string;
  includePageContext: boolean;
  allowToolUse: boolean;
}

export interface GitHubSettings {
  clientId: string;
  clientSecret: string;
}

export interface AppSettings {
  autoLaunch: boolean;
  startMinimized: boolean;
  mcpUrl: string;
  walrus: {
    mainnet: WalrusNetworkConfig;
    testnet: WalrusNetworkConfig;
  };
  ai: AiSettings;
  github: GitHubSettings;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "folder";
  size?: number;
  mtime?: string;
  children?: FileTreeNode[];
}

export const RELAYER_PORT = { mainnet: 47821, testnet: 47822 } as const;