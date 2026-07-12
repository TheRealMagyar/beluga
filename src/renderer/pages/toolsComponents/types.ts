export interface GraphNode {
  id: string;
  x: number;
  y: number;
  expanded: boolean;
  expanding: boolean;
  isRoot: boolean;
  depth: number;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  digest: string;
  amountSui: number;
  timestampMs: string | null;
  coinType: string;
}

export interface GraphSelection {
  kind: "node" | "edge";
  id: string;
}