/** Matches IKA_START_EPOCH_DURATION_MS in ika-localnet.ts (5-minute epochs). */
export const IKA_EPOCH_DURATION_MS = 5 * 60 * 1000;
export const TARGET_COORDINATOR_EPOCH = 2;

const BOOTSTRAP_FIRST_RUN_MS = 12 * 60 * 1000;
const BOOTSTRAP_RESUME_MS = 2 * 60 * 1000;
const DKG_TYPICAL_MS = 8 * 60 * 1000;

const COMPLETED_KEY_STATES = new Set([
  "NetworkDKGCompleted",
  "NetworkReconfigurationCompleted",
]);

export type IkaLocalnetProgressInput = {
  suiRunning: boolean;
  ikaRunning: boolean;
  configReady: boolean;
  networkDkgReady: boolean;
  dwalletReady: boolean;
  coordinatorEpoch: string | null;
  encryptionKeyState: string | null;
  dkgChunkCount: number;
  suiCheckpointLag: number | null;
  readinessHint: string | null;
  resumeAvailable: boolean;
  stateOutOfSync: boolean;
  ikaStartedAt: number | null;
  phase:
    | "stopped"
    | "starting"
    | "bootstrapping"
    | "dkg"
    | "ready"
    | "error";
};

export type IkaProgressMilestone = {
  id: string;
  label: string;
  done: boolean;
  active: boolean;
};

export type IkaLocalnetProgress = {
  percent: number;
  indeterminate: boolean;
  stepLabel: string;
  statusMessage: string;
  estimatedRemainingMs: number | null;
  estimatedRemainingLabel: string;
  coordinatorEpoch: number | null;
  epochsRemaining: number | null;
  epochDurationMin: number;
  dkgChunkCount: number;
  encryptionKeyState: string | null;
  suiCheckpointLag: number | null;
  milestones: IkaProgressMilestone[];
  healthy: boolean;
};

function parseEpoch(value: string | null): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function encryptionKeyDone(state: string | null): boolean {
  return state != null && COMPLETED_KEY_STATES.has(state);
}

export function formatEta(ms: number | null): string {
  if (ms == null) return "Estimating…";
  if (ms <= 30_000) return "Any moment now";
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min < 1) return "~1 minute";
  if (min < 60) {
    return sec > 0 && min < 10 ? `~${min} min ${sec}s` : `~${min} min`;
  }
  const hours = Math.floor(min / 60);
  const remMin = min % 60;
  return remMin > 0 ? `~${hours}h ${remMin}m` : `~${hours}h`;
}

function estimateRemainingMs(input: IkaLocalnetProgressInput): number | null {
  const epoch = parseEpoch(input.coordinatorEpoch);
  const elapsed =
    input.ikaStartedAt != null ? Date.now() - input.ikaStartedAt : null;

  if (input.dwalletReady) return 0;
  if (input.stateOutOfSync) return null;

  if (!input.suiRunning || !input.ikaRunning) {
    return input.resumeAvailable ? 3 * 60 * 1000 : 5 * 60 * 1000;
  }

  if (!input.configReady) {
    const budget = input.resumeAvailable
      ? BOOTSTRAP_RESUME_MS
      : BOOTSTRAP_FIRST_RUN_MS;
    if (elapsed == null) return budget;
    return Math.max(60_000, budget - elapsed);
  }

  if (input.dkgChunkCount === 0) {
    const sinceConfig = elapsed ?? DKG_TYPICAL_MS;
    return Math.max(90_000, DKG_TYPICAL_MS - sinceConfig * 0.35);
  }

  if (!encryptionKeyDone(input.encryptionKeyState)) {
    return Math.max(60_000, 4 * 60 * 1000);
  }

  if (epoch != null && epoch < TARGET_COORDINATOR_EPOCH) {
    const epochsLeft = TARGET_COORDINATOR_EPOCH - epoch;
    return epochsLeft * IKA_EPOCH_DURATION_MS;
  }

  const lag = input.suiCheckpointLag;
  if (lag != null && lag > 50) {
    return Math.min(3 * 60 * 1000, lag * 250);
  }

  if (!input.dwalletReady) return 45_000;
  return 0;
}

function buildMilestones(input: IkaLocalnetProgressInput): IkaProgressMilestone[] {
  const epoch = parseEpoch(input.coordinatorEpoch);
  const keyDone = encryptionKeyDone(input.encryptionKeyState);

  const items: IkaProgressMilestone[] = [
    {
      id: "sui",
      label: "Sui localnet",
      done: input.suiRunning,
      active: !input.suiRunning && input.phase !== "stopped",
    },
    {
      id: "ika",
      label: "Ika validators",
      done: input.ikaRunning,
      active: input.suiRunning && !input.ikaRunning,
    },
    {
      id: "config",
      label: "Contracts published",
      done: input.configReady,
      active: input.ikaRunning && !input.configReady,
    },
    {
      id: "dkg",
      label: "Network DKG on-chain",
      done: input.networkDkgReady || keyDone,
      active:
        input.configReady &&
        !input.networkDkgReady &&
        !keyDone &&
        input.dkgChunkCount === 0,
    },
    {
      id: "epoch",
      label: `Coordinator epoch ${TARGET_COORDINATOR_EPOCH}+`,
      done: epoch != null && epoch >= TARGET_COORDINATOR_EPOCH,
      active:
        input.configReady &&
        (input.dkgChunkCount > 0 || keyDone) &&
        (epoch == null || epoch < TARGET_COORDINATOR_EPOCH),
    },
    {
      id: "ready",
      label: "dWallet ready",
      done: input.dwalletReady,
      active:
        input.networkDkgReady &&
        !input.dwalletReady &&
        epoch != null &&
        epoch >= TARGET_COORDINATOR_EPOCH,
    },
  ];

  return items;
}

function milestonePercent(milestones: IkaProgressMilestone[]): number {
  const weights = [8, 10, 18, 28, 22, 14];
  let total = 0;
  let earned = 0;
  milestones.forEach((m, i) => {
    const w = weights[i] ?? 10;
    total += w;
    if (m.done) earned += w;
    else if (m.active) earned += w * 0.45;
  });
  return total > 0 ? Math.round((earned / total) * 100) : 0;
}

function stepLabel(input: IkaLocalnetProgressInput): string {
  if (input.dwalletReady) return "Ready";
  if (input.stateOutOfSync) return "Needs reset";
  if (input.phase === "stopped") return "Stopped";
  if (input.phase === "starting" || !input.suiRunning) return "Starting Sui";
  if (!input.ikaRunning) return "Starting Ika";
  if (!input.configReady) return "Bootstrapping";
  if (input.dkgChunkCount === 0) return "Network DKG";
  if (!encryptionKeyDone(input.encryptionKeyState)) return "Finishing DKG";
  const epoch = parseEpoch(input.coordinatorEpoch);
  if (epoch != null && epoch < TARGET_COORDINATOR_EPOCH) {
    return `Epoch ${epoch} → ${TARGET_COORDINATOR_EPOCH}`;
  }
  if (input.suiCheckpointLag != null && input.suiCheckpointLag > 50) {
    return "Syncing with Sui";
  }
  return "Almost ready";
}

function statusMessage(input: IkaLocalnetProgressInput): string {
  if (input.dwalletReady) {
    return "Localnet is ready — you can create dWallets.";
  }
  if (input.stateOutOfSync) {
    return (
      input.readinessHint ??
      "Ika config is out of sync with saved state. Use Fix dWallet localnet or Reset."
    );
  }
  if (input.readinessHint) return input.readinessHint;

  const epoch = parseEpoch(input.coordinatorEpoch);
  if (!input.configReady) {
    return input.resumeAvailable
      ? "Resuming saved chain — ika_config.json should appear shortly."
      : "Compiling Ika and publishing contracts. First run can take 5–15 minutes.";
  }
  if (input.dkgChunkCount === 0) {
    return "Validators are running network DKG — encryption keys are being written on Sui.";
  }
  if (!encryptionKeyDone(input.encryptionKeyState)) {
    return `Encryption key state: ${input.encryptionKeyState ?? "pending"} — DKG is wrapping up.`;
  }
  if (epoch != null && epoch < TARGET_COORDINATOR_EPOCH) {
    const left = TARGET_COORDINATOR_EPOCH - epoch;
    return `Waiting for coordinator epoch ${TARGET_COORDINATOR_EPOCH} (${left} epoch${left === 1 ? "" : "s"} left, ~${IKA_EPOCH_DURATION_MS / 60_000} min each).`;
  }
  if (input.suiCheckpointLag != null && input.suiCheckpointLag > 50) {
    return `Ika is catching up with Sui checkpoints (lag: ${input.suiCheckpointLag}).`;
  }
  return "Final checks — dWallet creation should unlock soon.";
}

export function computeIkaLocalnetProgress(
  input: IkaLocalnetProgressInput,
): IkaLocalnetProgress {
  const milestones = buildMilestones(input);
  const coordinatorEpoch = parseEpoch(input.coordinatorEpoch);
  const epochsRemaining =
    coordinatorEpoch != null && coordinatorEpoch < TARGET_COORDINATOR_EPOCH
      ? TARGET_COORDINATOR_EPOCH - coordinatorEpoch
      : coordinatorEpoch != null && coordinatorEpoch >= TARGET_COORDINATOR_EPOCH
        ? 0
        : null;

  const estimatedRemainingMs = estimateRemainingMs(input);
  const percent = input.dwalletReady
    ? 100
    : Math.min(98, milestonePercent(milestones));

  return {
    percent,
    indeterminate:
      !input.dwalletReady &&
      !input.stateOutOfSync &&
      (input.phase === "starting" ||
        (!input.configReady && input.ikaRunning) ||
        (input.configReady && input.dkgChunkCount === 0)),
    stepLabel: stepLabel(input),
    statusMessage: statusMessage(input),
    estimatedRemainingMs,
    estimatedRemainingLabel: formatEta(estimatedRemainingMs),
    coordinatorEpoch,
    epochsRemaining,
    epochDurationMin: IKA_EPOCH_DURATION_MS / 60_000,
    dkgChunkCount: input.dkgChunkCount,
    encryptionKeyState: input.encryptionKeyState,
    suiCheckpointLag: input.suiCheckpointLag,
    milestones,
    healthy: !input.stateOutOfSync && input.phase !== "stopped",
  };
}