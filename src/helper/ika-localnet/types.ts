export interface IkaLocalnetConfigFile {
  packages: {
    ika_package_id: string;
    ika_common_package_id: string;
    ika_dwallet_2pc_mpc_package_id: string;
    ika_dwallet_2pc_mpc_package_id_v2?: string;
    ika_system_package_id: string;
    ika_system_original_package_id?: string;
    ika_dwallet_2pc_mpc_original_package_id?: string;
  };
  objects: {
    ika_system_object_id: string;
    ika_dwallet_coordinator_object_id: string;
  };
}

export interface IkaLocalnetConfigStatus {
  ready: boolean;
  path: string | null;
  config: IkaLocalnetConfigFile | null;
}

export interface IkaChainReadiness {
  dkgChunksReady: boolean;
  dkgChunkCount: number;
  encryptionKeyState: string | null;
  coordinatorEpoch: string | null;
  lastProcessedCheckpoint: string | null;
  latestSuiCheckpoint: string | null;
  suiCheckpointLag: number | null;
  coordinatorEpochReady: boolean;
  protocolOnChainReady: boolean;
  dwalletReady: boolean;
  readinessHint: string | null;
}

export interface LocalnetSessionSnapshot {
  coordinatorObjectId: string;
  suiChainId: string | null;
  networkDkgReady: boolean;
  savedAt: number;
}

export interface LocalnetResumeStatus {
  ikaConfigReady: boolean;
  ikaNetworkConfigReady: boolean;
  /** ika_config.json object IDs match ~/.ika/ika_config/network.yaml */
  configMatchesPersisted: boolean;
  /** Persisted Sui genesis under ~/.beluga/toolchain/sui-localnet */
  suiGenesisReady: boolean;
  canResumeSui: boolean;
  canResumeIka: boolean;
  suiCheckpointLag: number | null;
  session: LocalnetSessionSnapshot | null;
  /** False when ~/.beluga/toolchain is not writable (often root-owned). */
  toolchainWritable: boolean;
  toolchainRoot: string;
}

export interface StartIkaLocalnetOptions {
  /** Republish contracts and rerun network DKG. Default resumes persisted state. */
  reset?: boolean;
}

export interface IkaLocalnetStatus {
  running: boolean;
  configReady: boolean;
  /** On-chain protocol keys available (or seen in current run logs). */
  networkDkgReady: boolean;
  /** Safe to create dWallets: protocol on-chain + Ika synced with Sui checkpoints. */
  dwalletReady: boolean;
  coordinatorEpoch: string | null;
  suiCheckpointLag: number | null;
  encryptionKeyState: string | null;
  dkgChunkCount: number;
  readinessHint: string | null;
  /** Persisted Ika + ika_config.json present — safe to resume without DKG wait. */
  resumeAvailable: boolean;
  /** ika_config.json and ~/.ika/network.yaml disagree — reset required. */
  stateOutOfSync: boolean;
  pid: number | null;
  repoPath: string;
  repoReady: boolean;
  startedAt: number | null;
  recentLogs: string[];
}