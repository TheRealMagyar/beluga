export type Network = "mainnet" | "testnet";
export type Tab = "remember" | "recall" | "analyze";

export interface RecallResult {
  blob_id: string;
  text: string;
  distance: number;
}

export interface AnalyzedFact {
  text: string;
  job_id: string;
}

export interface MemoryEntry {
  id: string;
  label: string;
  accountId: string;
  delegateKey: string;
  network: Network;
  namespace: string;
  createdAt: number;
}
