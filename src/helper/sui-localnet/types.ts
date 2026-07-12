export interface SuiClientEnvironment {
  alias: string;
  rpc: string;
  active: boolean;
}

export interface SuiClientStatus {
  configured: boolean;
  configPath: string;
  activeEnv: string | null;
  activeAddress: string | null;
  environments: SuiClientEnvironment[];
}

export interface LocalNetworkStatus {
  /** Beluga-managed process is alive, or RPC was reachable recently. */
  running: boolean;
  /** RPC at rpcUrl responds to requests. */
  rpcReady: boolean;
  /** Started by Beluga in this app session. */
  managed: boolean;
  pid: number | null;
  rpcUrl: string;
  faucetUrl: string;
  startedAt: number | null;
  recentLogs: string[];
  /** True when persisted genesis was regenerated (explicit chain reset). */
  chainReset?: boolean;
  /** Persisted genesis exists for the active localnet profile. */
  persistedGenesisReady?: boolean;
  /** True when the running (or last started) genesis uses Ika-compatible epochs. */
  forIka?: boolean;
}

export interface StartLocalNetworkOptions {
  forceRegenesis?: boolean;
  withFaucet?: boolean;
  fullnodeRpcPort?: number;
  /** Long epoch duration required when running Ika localnet alongside Sui. */
  forIka?: boolean;
  epochDurationMs?: string;
}

export interface KillSuiProcessesResult {
  killed: number[];
  unkillable: Array<{ pid: number; owner: string | null }>;
}

export interface LocalNetworkStats {
  totalTransactions: string | null;
  latestCheckpoint: string | null;
  rpcUrl: string;
}

export interface LocalNetworkOverview extends LocalNetworkStats {
  epoch: string | null;
  epochDurationMs: string | null;
  referenceGasPrice: string | null;
  chainId: string | null;
  faucetUrl: string;
  running: boolean;
  pid: number | null;
  startedAt: number | null;
}

export interface LocalCheckpointSummary {
  sequenceNumber: string;
  digest: string;
  timestampMs: string | null;
  transactionCount: number;
  networkTotalTransactions: string | null;
}

export interface LocalTransactionSummary {
  digest: string;
  timestampMs: string | null;
  sender: string | null;
  status: string | null;
  gasUsed: string | null;
  checkpoint: string | null;
  kind: string | null;
}

export interface LocalObjectChangeSummary {
  type: string;
  objectId: string | null;
  packageId: string | null;
  objectType: string | null;
}

export interface LocalEventSummary {
  packageId: string;
  module: string;
  /** Full Move event type, e.g. 0xabc::lottery::TicketPurchased */
  type: string;
  sender: string | null;
  parsedJson: unknown | null;
  eventSeq: string | null;
}

export interface LocalTransactionDetail extends LocalTransactionSummary {
  error: string | null;
  computationCost: string | null;
  storageCost: string | null;
  storageRebate: string | null;
  commandCount: number;
  objectChanges: LocalObjectChangeSummary[];
  events: LocalEventSummary[];
}

export interface LocalAddressOverview {
  address: string;
  balanceSui: number;
  coinCount: number;
  objectCount: number;
}

export interface LocalObjectSummary {
  objectId: string;
  version: string | null;
  digest: string | null;
  objectType: string | null;
  owner: string | null;
  content: string | null;
}