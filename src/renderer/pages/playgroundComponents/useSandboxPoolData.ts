import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchSandboxPoolSnapshot,
  fetchSandboxPoolSummaries,
  resolveActivePool,
  type DefiSandboxDeployment,
  type SandboxPoolListItem,
  type SandboxPoolSnapshot,
} from "./defi-playground";

export function useSandboxPoolData(
  deployment: DefiSandboxDeployment | null,
  walletAddress: string | null,
  enabled: boolean,
) {
  const [poolSummaries, setPoolSummaries] = useState<SandboxPoolListItem[]>([]);
  const [poolSnapshot, setPoolSnapshot] = useState<SandboxPoolSnapshot | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    setRefreshing(true);

    try {
      if (!deployment?.pools?.length) {
        if (id === requestId.current) {
          setPoolSummaries([]);
          setPoolSnapshot(null);
        }
        return;
      }

      const active = resolveActivePool(deployment);
      const [summaries, snapshot] = await Promise.all([
        fetchSandboxPoolSummaries(deployment),
        active
          ? fetchSandboxPoolSnapshot(deployment, walletAddress, active)
          : Promise.resolve(null),
      ]);

      if (id !== requestId.current) return;
      setPoolSummaries(summaries);
      setPoolSnapshot(snapshot);
    } catch {
      if (id !== requestId.current) return;
      setPoolSummaries([]);
      setPoolSnapshot(null);
    } finally {
      if (id === requestId.current) {
        setRefreshing(false);
      }
    }
  }, [deployment, walletAddress]);

  const refreshSnapshotOnly = useCallback(async () => {
    const id = ++requestId.current;
    setRefreshing(true);
    try {
      if (!deployment || !resolveActivePool(deployment)) {
        if (id === requestId.current) setPoolSnapshot(null);
        return;
      }
      const snapshot = await fetchSandboxPoolSnapshot(deployment, walletAddress);
      if (id !== requestId.current) return;
      setPoolSnapshot(snapshot);
    } catch {
      if (id === requestId.current) setPoolSnapshot(null);
    } finally {
      if (id === requestId.current) setRefreshing(false);
    }
  }, [deployment, walletAddress]);

  const invalidateSnapshot = useCallback(() => {
    setPoolSnapshot(null);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled || !deployment?.pools?.length) return;
    const timer = window.setInterval(() => {
      void refresh();
    }, 12_000);
    return () => window.clearInterval(timer);
  }, [enabled, deployment?.pools?.length, refresh]);

  return {
    poolSummaries,
    poolSnapshot,
    refreshing,
    refresh,
    refreshSnapshotOnly,
    invalidateSnapshot,
  };
}