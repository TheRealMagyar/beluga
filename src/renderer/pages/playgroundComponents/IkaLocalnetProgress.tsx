import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import {
  computeIkaLocalnetProgress,
  type IkaLocalnetProgressInput,
} from "./ika-localnet-progress";

export function IkaLocalnetProgressPanel({
  status,
}: {
  status: IkaLocalnetProgressInput;
}) {
  const progress = computeIkaLocalnetProgress(status);

  if (status.dwalletReady) {
    return (
      <div className="rounded-2xl border border-[#00d4aa]/25 bg-[#00d4aa]/[0.04] p-4 mb-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-[13px] font-semibold text-[#00d4aa]">
            dWallet localnet ready
          </p>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-[#00d4aa]/30 text-[#00d4aa] bg-[#00d4aa]/10">
            100%
          </span>
        </div>
        <div className="h-2 rounded-full bg-[#1e1e1e] overflow-hidden">
          <div className="h-full w-full rounded-full bg-gradient-to-r from-[#00d4aa] to-[#7dd3fc]" />
        </div>
      </div>
    );
  }

  const showPanel =
    status.phase !== "stopped" ||
    status.ikaRunning ||
    status.suiRunning ||
    status.configReady;

  if (!showPanel) return null;

  const tone = status.stateOutOfSync
    ? "border-[#ff4d6d]/25 bg-[#ff4d6d]/[0.04]"
    : "border-[#00e5ff]/25 bg-[#00e5ff]/[0.04]";

  const barTone = status.stateOutOfSync
    ? "from-[#ff4d6d] to-[#ffb347]"
    : "from-[#00e5ff] to-[#4ca3ff]";

  return (
    <div className={`rounded-2xl border ${tone} p-4 mb-4`}>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[#f0f0f5]">
            {progress.stepLabel}
          </p>
          <p className="text-[11px] text-[#8888a0] mt-0.5 leading-relaxed">
            {progress.statusMessage}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-[#00e5ff]/30 text-[#00e5ff] bg-[#00e5ff]/10">
            {progress.indeterminate ? "In progress" : `${progress.percent}%`}
          </span>
          {progress.healthy && progress.estimatedRemainingMs != null && (
            <span className="text-[10px] text-[#a8b0c8]">
              ETA {progress.estimatedRemainingLabel}
            </span>
          )}
        </div>
      </div>

      <div className="h-2 rounded-full bg-[#1e1e1e] overflow-hidden mb-3">
        {progress.indeterminate ? (
          <div
            className={`h-full rounded-full bg-gradient-to-r ${barTone} animate-pulse`}
            style={{ width: `${Math.max(progress.percent, 18)}%` }}
          />
        ) : (
          <div
            className={`h-full rounded-full bg-gradient-to-r ${barTone} transition-all duration-700`}
            style={{ width: `${progress.percent}%` }}
          />
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-[10px]">
        <Stat
          label="Coordinator ε"
          value={
            progress.coordinatorEpoch != null
              ? String(progress.coordinatorEpoch)
              : "—"
          }
          hint={
            progress.epochsRemaining != null && progress.epochsRemaining > 0
              ? `${progress.epochsRemaining} left`
              : progress.coordinatorEpoch != null &&
                  progress.coordinatorEpoch >= 2
                ? "ready"
                : undefined
          }
        />
        <Stat
          label="Epoch length"
          value={`${progress.epochDurationMin} min`}
        />
        <Stat
          label="DKG chunks"
          value={String(progress.dkgChunkCount)}
        />
        <Stat
          label="Sui lag"
          value={
            progress.suiCheckpointLag != null
              ? String(progress.suiCheckpointLag)
              : "—"
          }
        />
      </div>

      <ul className="space-y-1.5">
        {progress.milestones.map((m) => (
          <li
            key={m.id}
            className="flex items-center gap-2 text-[11px] leading-snug"
          >
            {m.done ? (
              <CheckCircle2 size={13} className="text-[#00d4aa] flex-shrink-0" />
            ) : m.active ? (
              <Loader2
                size={13}
                className="text-[#00e5ff] animate-spin flex-shrink-0"
              />
            ) : (
              <Circle size={13} className="text-[#444466] flex-shrink-0" />
            )}
            <span
              className={
                m.done
                  ? "text-[#c7c7d8]"
                  : m.active
                    ? "text-[#f0f0f5]"
                    : "text-[#55556a]"
              }
            >
              {m.label}
            </span>
          </li>
        ))}
      </ul>

      {progress.encryptionKeyState && (
        <p className="mt-3 text-[10px] font-mono text-[#55556a]">
          key state: {progress.encryptionKeyState}
        </p>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-[#2a2a3c] bg-[#12121a] px-2.5 py-2">
      <p className="text-[#55556a] uppercase tracking-wide text-[9px]">{label}</p>
      <p className="text-[#c7c7d8] font-mono mt-0.5">{value}</p>
      {hint && <p className="text-[#8888a0] text-[9px] mt-0.5">{hint}</p>}
    </div>
  );
}