import { refreshLocalNetworkStatus } from "../sui-client-manager";
import { getIkaLocalnetConfig, repoIsReady } from "./config";
import { getIkaLocalnetLogMessages, isNetworkDkgReadyFromLogs } from "./logs";
import { findOrphanedIkaStartPids } from "./process-kill";
import { getIkaRepoPath } from "./paths";
import {
  getLocalnetResumeStatus,
  probeIkaChainReadiness,
  refreshLocalnetSessionSnapshot,
} from "./readiness";
import {ikaLocalnetRuntime} from "./runtime";
import { clearLocalnetSession } from "./session";
import type { IkaLocalnetStatus } from "./types";

export async function getIkaLocalnetStatus(): Promise<IkaLocalnetStatus> {
  const repoPath = getIkaRepoPath();
  const config = await getIkaLocalnetConfig();
  const recentLogs = getIkaLocalnetLogMessages();
  const resume = await getLocalnetResumeStatus();
  const trackedRunning = ikaLocalnetRuntime.ikaProcess != null && !ikaLocalnetRuntime.ikaProcess.killed;
  const orphanPids = trackedRunning
    ? []
    : await findOrphanedIkaStartPids(repoPath);
  const running = trackedRunning || orphanPids.length > 0;
  const stateOutOfSync =
    config.ready &&
    config.config &&
    resume.ikaNetworkConfigReady &&
    !resume.configMatchesPersisted;

  let networkDkgReady = false;
  let dwalletReady = false;
  let coordinatorEpoch: string | null = null;
  let suiCheckpointLag: number | null = resume.suiCheckpointLag;
  let encryptionKeyState: string | null = null;
  let dkgChunkCount = 0;
  let readinessHint: string | null = null;

  if (config.ready && config.config && !stateOutOfSync) {
    const suiStatus = await refreshLocalNetworkStatus();
    if (suiStatus.rpcReady) {
      const readiness = await probeIkaChainReadiness(config.config);
      networkDkgReady = readiness.protocolOnChainReady;
      dwalletReady = readiness.dwalletReady;
      coordinatorEpoch = readiness.coordinatorEpoch;
      suiCheckpointLag = readiness.suiCheckpointLag;
      encryptionKeyState = readiness.encryptionKeyState;
      dkgChunkCount = readiness.dkgChunkCount;
      readinessHint = readiness.readinessHint;

      if (!networkDkgReady) {
        networkDkgReady = isNetworkDkgReadyFromLogs(recentLogs);
      }
      if (networkDkgReady && resume.canResumeIka) {
        void refreshLocalnetSessionSnapshot();
      }
    }
  }

  if (stateOutOfSync) {
    void clearLocalnetSession();
  }

  return {
    running,
    configReady: config.ready,
    networkDkgReady,
    dwalletReady,
    coordinatorEpoch,
    suiCheckpointLag,
    encryptionKeyState,
    dkgChunkCount,
    readinessHint,
    resumeAvailable: resume.canResumeIka && networkDkgReady,
    stateOutOfSync,
    pid: ikaLocalnetRuntime.ikaProcess?.pid ?? orphanPids[0] ?? null,
    repoPath,
    repoReady: await repoIsReady(repoPath),
    startedAt: ikaLocalnetRuntime.ikaStartedAt,
    recentLogs,
  };
}