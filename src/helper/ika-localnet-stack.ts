import {
  ensureBelugaToolchainWritable,
  resolveBelugaToolchainRoot,
} from "./beluga-toolchain-path";
import {
  healIkaLocalnetEnvironment,
  needsIkaLocalnetHeal,
} from "./ika-localnet-heal";
import {
  getIkaLocalnetStatus,
  getLocalnetResumeStatus,
  resetIkaLocalnetState,
  startIkaLocalnet,
  stopIkaLocalnet,
  type IkaLocalnetStatus,
} from "./ika-localnet";
import {
  appendLocalNetworkLog,
  forceStopLocalNetwork,
  refreshLocalNetworkStatus,
  regenerateBelugaSuiGenesis,
  startLocalNetwork,
  stopLocalNetwork,
  type LocalNetworkStatus,
} from "./sui-client-manager";

export interface IkaLocalnetStackStatus {
  sui: LocalNetworkStatus;
  ika: IkaLocalnetStatus;
  phase: LocalnetStackPhase;
  label: string;
}

export type LocalnetStackPhase =
  | "stopped"
  | "starting"
  | "bootstrapping"
  | "dkg"
  | "ready"
  | "error";

export interface IkaLocalnetStackActionResult {
  message: string;
  sui: LocalNetworkStatus;
  ika: IkaLocalnetStatus;
}

export function describeLocalnetStack(
  sui: LocalNetworkStatus,
  ika: IkaLocalnetStatus,
): Pick<IkaLocalnetStackStatus, "phase" | "label"> {
  if (ika.dwalletReady) {
    return { phase: "ready", label: "Ready · dWallet localnet" };
  }

  if (ika.configReady && ika.running) {
    if (ika.networkDkgReady) {
      return { phase: "dkg", label: "Syncing · network DKG on-chain" };
    }
    return { phase: "dkg", label: "Network DKG in progress" };
  }

  if (ika.running && !ika.configReady) {
    return {
      phase: "bootstrapping",
      label: "Bootstrapping · waiting for ika_config.json",
    };
  }

  if (sui.managed && !sui.rpcReady) {
    return { phase: "starting", label: "Starting Sui localnet…" };
  }

  if (sui.rpcReady && !ika.running) {
    return { phase: "stopped", label: "Stopped · press Start" };
  }

  if (sui.rpcReady || ika.running) {
    return { phase: "starting", label: "Starting…" };
  }

  return { phase: "stopped", label: "Stopped" };
}

export async function getIkaLocalnetStackStatus(): Promise<IkaLocalnetStackStatus> {
  try {
    await resolveBelugaToolchainRoot();
  } catch {
    // Status can still be shown; start will surface permission errors.
  }

  const [sui, ika] = await Promise.all([
    refreshLocalNetworkStatus(),
    getIkaLocalnetStatus(),
  ]);
  const { phase, label } = describeLocalnetStack(sui, ika);
  return { sui, ika, phase, label };
}

function buildStartMessage(
  ika: IkaLocalnetStatus,
  resumed: boolean,
): string {
  if (ika.dwalletReady) {
    return "Localnet ready — you can create dWallets.";
  }
  if (ika.networkDkgReady && ika.resumeAvailable) {
    return "Resumed localnet — network DKG already on-chain.";
  }
  if (ika.configReady) {
    return "Localnet started — wait a few minutes for network DKG.";
  }
  if (resumed) {
    return "Resumed from saved state — ika_config.json should appear shortly.";
  }
  return "Localnet started — first bootstrap may take 5–15 minutes.";
}

export async function startIkaLocalnetStack(): Promise<IkaLocalnetStackActionResult> {
  const toolchainRoot = await ensureBelugaToolchainWritable();
  appendLocalNetworkLog(`Using toolchain at ${toolchainRoot}`);

  const resume = await getLocalnetResumeStatus();
  let sui = await refreshLocalNetworkStatus();

  if (!sui.rpcReady) {
    try {
      sui = await startLocalNetwork({
        forIka: true,
        withFaucet: true,
      });
    } catch (err: any) {
      const retryStatus = await refreshLocalNetworkStatus();
      if (retryStatus.rpcReady) {
        sui = retryStatus;
      } else {
        throw err;
      }
    }
    if (!sui.rpcReady) {
      throw new Error(
        "Sui localnet did not become ready. Check logs and toolchain permissions.",
      );
    }
  }

  const healCheck = await needsIkaLocalnetHeal();
  if (healCheck.needed) {
    const healed = await healIkaLocalnetEnvironment();
    return {
      message: healed.message,
      sui: healed.localStatus,
      ika: healed.ikaStatus,
    };
  }

  const ikaBefore = await getIkaLocalnetStatus();
  if (ikaBefore.running) {
    return {
      message: buildStartMessage(ikaBefore, resume.canResumeIka),
      sui,
      ika: ikaBefore,
    };
  }

  const ika = await startIkaLocalnet({ reset: false });

  return {
    message: buildStartMessage(ika, resume.canResumeIka),
    sui,
    ika,
  };
}

export async function stopIkaLocalnetStack(): Promise<IkaLocalnetStackActionResult> {
  await stopIkaLocalnet();

  let sui = await stopLocalNetwork();
  let message = "Localnet stopped (Sui + Ika). State is saved for resume.";

  if (sui.rpcReady) {
    try {
      sui = await forceStopLocalNetwork();
      message = "Localnet stopped.";
    } catch (err: any) {
      message =
        typeof err?.message === "string"
          ? `Ika stopped. ${err.message}`
          : "Ika stopped, but Sui is still running on port 9000.";
    }
  }

  const ika = await getIkaLocalnetStatus();

  return {
    message,
    sui,
    ika,
  };
}

export async function resetIkaLocalnetStack(): Promise<IkaLocalnetStackActionResult> {
  await ensureBelugaToolchainWritable();

  await stopIkaLocalnet();
  await resetIkaLocalnetState();
  await forceStopLocalNetwork();
  await regenerateBelugaSuiGenesis({ forIka: true, withFaucet: true });
  appendLocalNetworkLog("Prepared fresh Ika-compatible Sui genesis.");

  const sui = await refreshLocalNetworkStatus();
  const ika = await getIkaLocalnetStatus();

  return {
    message:
      "Localnet reset — fresh Sui genesis prepared. Press Start for a clean bootstrap.",
    sui,
    ika,
  };
}