import { SUI_NETWORKS } from "../../types/network";
import type { PlaygroundNetwork } from "./types";

export const NETWORK_CONFIG: Record<
  PlaygroundNetwork,
  { label: string; rpc: string; network: PlaygroundNetwork; faucet: boolean }
> = Object.fromEntries(
  (Object.entries(SUI_NETWORKS) as Array<
    [PlaygroundNetwork, (typeof SUI_NETWORKS)[PlaygroundNetwork]]
  >).map(([id, config]) => [
    id,
    { label: config.label, rpc: config.rpc, network: id, faucet: config.faucet },
  ]),
) as Record<
  PlaygroundNetwork,
  { label: string; rpc: string; network: PlaygroundNetwork; faucet: boolean }
>;

export const DEPLOYMENT_STORAGE_KEY = "beluga-playground-deployment-v1";