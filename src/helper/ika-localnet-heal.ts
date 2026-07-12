import {
  getIkaLocalnetConfig,
  getIkaLocalnetStatus,
  getLocalnetResumeStatus,
  resetIkaLocalnetState,
  startIkaLocalnet,
  stopIkaLocalnet,
  type IkaLocalnetStatus,
} from "./ika-localnet";
import {
  forceStopLocalNetwork,
  refreshLocalNetworkStatus,
  startLocalNetwork,
  type LocalNetworkStatus,
} from "./sui-client-manager";

export interface HealIkaLocalnetResult {
  message: string;
  ikaStatus: IkaLocalnetStatus;
  localStatus: LocalNetworkStatus;
  healed: boolean;
}

/** Heal only when configs/session are inconsistent — not for normal checkpoint lag. */
export async function needsIkaLocalnetHeal(): Promise<{
  needed: boolean;
  reason: string | null;
  suiCheckpointLag: number | null;
}> {
  const [config, resume, suiStatus] = await Promise.all([
    getIkaLocalnetConfig(),
    getLocalnetResumeStatus(),
    refreshLocalNetworkStatus(),
  ]);

  if (!suiStatus.rpcReady || !config.ready || !config.config) {
    return { needed: false, reason: null, suiCheckpointLag: null };
  }

  if (!resume.configMatchesPersisted) {
    return {
      needed: true,
      reason:
        "ika_config.json and ~/.ika/network.yaml are out of sync — coordinated reset required.",
      suiCheckpointLag: resume.suiCheckpointLag,
    };
  }

  if (resume.session?.suiChainId) {
    try {
      const { SuiJsonRpcClient } = await import("@mysten/sui/jsonRpc");
      const client = new SuiJsonRpcClient({
        url: suiStatus.rpcUrl,
        network: "testnet",
      });
      const chainId = await client.getChainIdentifier();
      if (chainId !== resume.session.suiChainId) {
        return {
          needed: true,
          reason:
            "Saved Ika session is from a different Sui chain — coordinated reset required.",
          suiCheckpointLag: resume.suiCheckpointLag,
        };
      }
    } catch {
      // ignore chain probe errors
    }
  }

  return {
    needed: false,
    reason: null,
    suiCheckpointLag: resume.suiCheckpointLag,
  };
}

/**
 * Coordinated reset: wipe Ika state, regenesis Sui (Ika-compatible), fresh Ika bootstrap.
 */
export async function healIkaLocalnetEnvironment(): Promise<HealIkaLocalnetResult> {
  await stopIkaLocalnet();
  await resetIkaLocalnetState();
  await forceStopLocalNetwork();

  const localStatus = await startLocalNetwork({
    forceRegenesis: true,
    forIka: true,
    withFaucet: true,
  });

  if (!localStatus.rpcReady) {
    throw new Error(
      "Sui localnet did not start after heal. Check Sui logs in the panel.",
    );
  }

  await startIkaLocalnet({ reset: true });
  const refreshed = await getIkaLocalnetStatus();

  const message = refreshed.dwalletReady
    ? "Localnet healed — dWallet ready. You can create a dWallet now."
    : refreshed.networkDkgReady
      ? "Localnet healed — network DKG on-chain. Wait for coordinator epoch 2+, then create a dWallet."
      : "Localnet healed — Ika is bootstrapping. Wait for ika_config.json and network DKG (typically 5–10 minutes), then faucet SUI and create a dWallet.";

  return {
    message,
    ikaStatus: refreshed,
    localStatus,
    healed: true,
  };
}