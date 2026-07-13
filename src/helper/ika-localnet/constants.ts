export const IKA_REPO_URL = "https://github.com/dwallet-labs/ika.git";
/** 5-minute epochs — validated in Ika localnet playbook (too short breaks dWallet DKG). */
export const IKA_START_EPOCH_DURATION_MS = "300000";

/** Ika playbook: dWallet traffic needs coordinator epoch >= 2. */
export const MIN_COORDINATOR_EPOCH_FOR_DWALLET = 2;

export const COMPLETED_ENCRYPTION_KEY_STATES = new Set([
  "NetworkDKGCompleted",
  "NetworkReconfigurationCompleted",
]);

/** Brief reconfiguration between epochs is normal; dWallet ops still work. */
export const TRANSIENT_USABLE_ENCRYPTION_KEY_STATES = new Set([
  "AwaitingNetworkReconfiguration",
]);

export const READINESS_STICKY_MS = 60_000;

export const IKA_PERMISSION_DENIED_HINT =
  "Ika cannot write temporary database files (permission denied). " +
  "This usually happens after running Beluga with sudo. " +
  "Run in Terminal:\n\nnpm run fix-permissions\nnpm run kill-ika\nnpm run kill-sui\n\n" +
  "Then restart Beluga without sudo.";

export const IKA_MOVE_CACHE_HINT =
  "Ika cannot write to the Move package cache. " +
  "This usually means ~/.move has root-owned folders from running with sudo. " +
  "Run in Terminal:\n\nnpm run fix-permissions\n\n" +
  "Then restart Beluga without sudo and press Start again.";

export const IKA_FAUCET_FAILURE_HINT =
  "Ika could not fund its publisher address from the Sui localnet faucet. " +
  "Ika needs the faucet on http://127.0.0.1:9123 when bootstrapping contracts.\n\n" +
  "Try: Stop the localnet, press Reset in the Ika CLI panel, then Start again. " +
  "If Sui was started outside Beluga without --with-faucet, stop it and let Beluga start Sui.";