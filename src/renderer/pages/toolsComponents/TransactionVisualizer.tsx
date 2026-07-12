import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Loader2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ArrowRight,
  ArrowLeft,
  GitBranch,
} from "lucide-react";
import type { SuiNetwork } from "../../types/network";
import { SUI_NETWORKS } from "../../types/network";
import type { GraphEdge, GraphNode, GraphSelection } from "./types";
import {
  CANVAS_SIZE,
  NODE_RADIUS,
  placeAround,
} from "./graph-layout";
const MIN_ZOOM = 0.08;
const MAX_ZOOM = 8;
const DRAG_CLICK_THRESHOLD = 6;

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatAmount(amount: number) {
  if (amount >= 1) return `${amount.toFixed(3)} SUI`;
  if (amount >= 0.001) return `${amount.toFixed(4)} SUI`;
  return `${amount.toFixed(6)} SUI`;
}

function formatTime(timestampMs: string | null) {
  if (!timestampMs) return "Unknown time";
  return new Date(Number(timestampMs)).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TransactionVisualizer({
  network,
  walletAddress,
}: {
  network: SuiNetwork;
  walletAddress: string | null;
}) {
  const [addressInput, setAddressInput] = useState(walletAddress ?? "");
  const [nodes, setNodes] = useState<Map<string, GraphNode>>(new Map());
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selection, setSelection] = useState<GraphSelection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panDragRef = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null>(null);
  const nodeDragRef = useRef<{
    nodeId: string;
    startClientX: number;
    startClientY: number;
    nodeX: number;
    nodeY: number;
    moved: boolean;
  } | null>(null);

  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const nodeList = useMemo(() => Array.from(nodes.values()), [nodes]);
  const edgeList = edges;

  const selectedEdge = useMemo(() => {
    if (selection?.kind !== "edge") return null;
    return edgeList.find((edge) => edge.id === selection.id) ?? null;
  }, [selection, edgeList]);

  const selectedNode = useMemo(() => {
    if (selection?.kind !== "node") return null;
    return nodes.get(selection.id) ?? null;
  }, [selection, nodes]);

  const mergeGraph = useCallback(
    (
      centerId: string,
      result: {
        edges: Array<{
          digest: string;
          from: string;
          to: string;
          amountSui: number;
          timestampMs: string | null;
          coinType: string;
        }>;
        counterparties: string[];
      },
      markExpanded: boolean,
    ) => {
      setNodes((prev) => {
        const next = new Map(prev);
        const center = next.get(centerId);
        if (!center) return prev;

        if (markExpanded) {
          next.set(centerId, { ...center, expanded: true, expanding: false });
        }

        const newcomers = placeAround(center, result.counterparties, next);
        for (const node of newcomers) {
          next.set(node.id, node);
        }
        return next;
      });

      setEdges((prev) => {
        const map = new Map(prev.map((edge) => [edge.id, edge]));
        for (const edge of result.edges) {
          const id = `${edge.digest}:${edge.from}:${edge.to}`;
          map.set(id, { ...edge, id });
        }
        return Array.from(map.values());
      });
    },
    [],
  );

  const exploreAddress = useCallback(
    async (address: string, options?: { asRoot?: boolean; markExpanded?: boolean }) => {
      setLoading(true);
      setError(null);
      try {
        const result = await window.tools.fetchAddressGraph({
          address,
          network,
          limit: 25,
        });

        if (options?.asRoot) {
          const rootNode: GraphNode = {
            id: result.address,
            x: CANVAS_SIZE / 2,
            y: CANVAS_SIZE / 2,
            expanded: true,
            expanding: false,
            isRoot: true,
            depth: 0,
          };

          setNodes(() => {
            const next = new Map([[result.address, rootNode]]);
            const newcomers = placeAround(rootNode, result.counterparties, next);
            for (const node of newcomers) next.set(node.id, node);
            return next;
          });
          setEdges(
            result.edges.map((edge) => ({
              ...edge,
              id: `${edge.digest}:${edge.from}:${edge.to}`,
            })),
          );
          setPan({ x: 0, y: 0 });
          setZoom(1);
          setSelection({ kind: "node", id: result.address });
        } else {
          mergeGraph(result.address, result, options?.markExpanded ?? true);
        }
      } catch (e: any) {
        setError(e.message || "Failed to load transactions.");
        setNodes((prev) => {
          const next = new Map(prev);
          const node = next.get(address);
          if (node) next.set(address, { ...node, expanding: false });
          return next;
        });
      }
      setLoading(false);
    },
    [mergeGraph, network],
  );

  const handleExplore = async () => {
    const trimmed = addressInput.trim();
    if (!trimmed) {
      setError("Enter a Sui address.");
      return;
    }
    await exploreAddress(trimmed, { asRoot: true });
  };

  const getContainerCenter = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { cx: 0, cy: 0 };
    return {
      cx: rect.left + rect.width / 2,
      cy: rect.top + rect.height / 2,
    };
  }, []);

  const applyZoomAtPoint = useCallback(
    (nextZoom: number, clientX: number, clientY: number) => {
      const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
      const { cx, cy } = getContainerCenter();
      const mx = clientX - cx;
      const my = clientY - cy;
      const graphX = (mx - pan.x) / zoom + CANVAS_SIZE / 2;
      const graphY = (my - pan.y) / zoom + CANVAS_SIZE / 2;

      setZoom(clamped);
      setPan({
        x: mx - clamped * (graphX - CANVAS_SIZE / 2),
        y: my - clamped * (graphY - CANVAS_SIZE / 2),
      });
    },
    [getContainerCenter, pan.x, pan.y, zoom],
  );

  const expandNode = useCallback(
    async (nodeId: string) => {
      const node = nodesRef.current.get(nodeId);
      if (!node || node.expanded || node.expanding) return;

      setNodes((prev) => {
        const next = new Map(prev);
        const current = next.get(nodeId);
        if (current) next.set(nodeId, { ...current, expanding: true });
        return next;
      });

      await exploreAddress(nodeId, { markExpanded: true });
    },
    [exploreAddress],
  );

  const onWheel = (event: React.WheelEvent) => {
    event.preventDefault();
    const factor = event.deltaY > 0 ? 0.88 : 1.14;
    applyZoomAtPoint(zoom * factor, event.clientX, event.clientY);
  };

  const onCanvasMouseDown = (event: React.MouseEvent) => {
    if (event.button !== 0 || nodeDragRef.current) return;
    panDragRef.current = {
      x: event.clientX,
      y: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const onNodeMouseDown = (event: React.MouseEvent, node: GraphNode) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    panDragRef.current = null;

    nodeDragRef.current = {
      nodeId: node.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      nodeX: node.x,
      nodeY: node.y,
      moved: false,
    };
    setDraggingNodeId(node.id);
    setSelection({ kind: "node", id: node.id });
  };

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      if (nodeDragRef.current) {
        const drag = nodeDragRef.current;
        const dx = event.clientX - drag.startClientX;
        const dy = event.clientY - drag.startClientY;

        if (Math.hypot(dx, dy) > DRAG_CLICK_THRESHOLD) {
          drag.moved = true;
        }

        setNodes((prev) => {
          const next = new Map(prev);
          const current = next.get(drag.nodeId);
          if (!current) return prev;
          next.set(drag.nodeId, {
            ...current,
            x: drag.nodeX + dx / zoom,
            y: drag.nodeY + dy / zoom,
          });
          return next;
        });
        return;
      }

      if (!panDragRef.current) return;
      setPan({
        x: panDragRef.current.panX + (event.clientX - panDragRef.current.x),
        y: panDragRef.current.panY + (event.clientY - panDragRef.current.y),
      });
    };

    const onMouseUp = async () => {
      const nodeDrag = nodeDragRef.current;
      if (nodeDrag) {
        const shouldExpand = !nodeDrag.moved;
        const nodeId = nodeDrag.nodeId;
        nodeDragRef.current = null;
        setDraggingNodeId(null);

        if (shouldExpand) {
          await expandNode(nodeId);
        }
        return;
      }

      panDragRef.current = null;
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [expandNode, zoom]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-shrink-0 px-6 py-5 border-b border-white/[0.06]">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[280px]">
            <h2 className="text-xl font-bold text-[#f0f0f5] mb-1">
              Transaction Visualizer
            </h2>
            <p className="text-sm text-[#8888a0] max-w-2xl">
              Explore incoming and outgoing SUI transfers for any address. Scroll
              to zoom, drag the background to pan, drag nodes to rearrange, and
              click a node to expand its transactions.
            </p>
          </div>
          <div className="text-[12px] px-3 py-1.5 rounded-full border border-[#4ca3ff]/25 text-[#4ca3ff] bg-[#4ca3ff]/10">
            {SUI_NETWORKS[network].label}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-4">
          <div className="relative flex-1 min-w-[320px] max-w-xl">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8888a0]"
            />
            <input
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleExplore()}
              placeholder="0x... Sui address"
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#1e1e1e] border border-[#2a2a3c] text-sm font-mono outline-none focus:border-[#4ca3ff]/40"
            />
          </div>
          {walletAddress && (
            <button
              onClick={() => {
                setAddressInput(walletAddress);
              }}
              className="h-11 px-4 rounded-xl border border-[#2a2a3c] text-[12px] text-[#8888a0] hover:text-[#f0f0f5] cursor-pointer bg-transparent"
            >
              Use wallet
            </button>
          )}
          <button
            onClick={handleExplore}
            disabled={loading}
            className="h-11 px-5 rounded-xl bg-[#4ca3ff] text-white text-sm font-medium cursor-pointer disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <GitBranch size={15} />}
            Visualize
          </button>
        </div>

        {error && (
          <div className="mt-3 px-4 py-2.5 rounded-xl border border-[#ff4d6d]/25 bg-[#ff4d6d]/10 text-[13px] text-[#ff4d6d]">
            {error}
          </div>
        )}
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0 relative bg-[#080810] overflow-hidden">
          <div className="absolute top-4 right-4 z-10 flex items-center gap-2 rounded-xl border border-[#2a2a3c] bg-[#1e1e1e]/95 px-2 py-2 backdrop-blur-sm">
            <button
              onClick={() => {
                const rect = containerRef.current?.getBoundingClientRect();
                const cx = rect ? rect.left + rect.width / 2 : 0;
                const cy = rect ? rect.top + rect.height / 2 : 0;
                applyZoomAtPoint(zoom * 1.25, cx, cy);
              }}
              className="w-9 h-9 rounded-lg border border-[#2a2a3c] bg-[#14141f] text-[#8888a0] hover:text-[#f0f0f5] cursor-pointer flex items-center justify-center"
              title="Zoom in"
            >
              <ZoomIn size={15} />
            </button>
            <button
              onClick={() => {
                const rect = containerRef.current?.getBoundingClientRect();
                const cx = rect ? rect.left + rect.width / 2 : 0;
                const cy = rect ? rect.top + rect.height / 2 : 0;
                applyZoomAtPoint(zoom / 1.25, cx, cy);
              }}
              className="w-9 h-9 rounded-lg border border-[#2a2a3c] bg-[#14141f] text-[#8888a0] hover:text-[#f0f0f5] cursor-pointer flex items-center justify-center"
              title="Zoom out"
            >
              <ZoomOut size={15} />
            </button>
            <input
              type="range"
              min={Math.round(MIN_ZOOM * 100)}
              max={Math.round(MAX_ZOOM * 100)}
              value={Math.round(zoom * 100)}
              onChange={(e) => {
                const rect = containerRef.current?.getBoundingClientRect();
                const cx = rect ? rect.left + rect.width / 2 : 0;
                const cy = rect ? rect.top + rect.height / 2 : 0;
                applyZoomAtPoint(Number(e.target.value) / 100, cx, cy);
              }}
              className="w-28 accent-[#4ca3ff]"
              title="Zoom level"
            />
            <span className="text-[11px] font-mono text-[#8888a0] w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              className="w-9 h-9 rounded-lg border border-[#2a2a3c] bg-[#14141f] text-[#8888a0] hover:text-[#f0f0f5] cursor-pointer flex items-center justify-center"
              title="Reset view"
            >
              <Maximize2 size={15} />
            </button>
          </div>

          {nodeList.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-8">
              <GitBranch size={42} className="text-[#2a2a3c] mb-4" />
              <p className="text-[15px] font-medium text-[#f0f0f5] mb-2">
                No graph yet
              </p>
              <p className="text-[13px] text-[#8888a0] max-w-md">
                Enter a Sui address and click Visualize to map its incoming and
                outgoing transfers.
              </p>
            </div>
          ) : (
            <div
              ref={containerRef}
              className={`h-full w-full ${
                draggingNodeId
                  ? "cursor-grabbing"
                  : "cursor-grab active:cursor-grabbing"
              }`}
              onWheel={onWheel}
              onMouseDown={onCanvasMouseDown}
            >
              <svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`}
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: "center center",
                }}
              >
                <defs>
                  <marker
                    id="arrow-out"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#4ca3ff88" />
                  </marker>
                </defs>

                {edgeList.map((edge) => {
                  const from = nodes.get(edge.from);
                  const to = nodes.get(edge.to);
                  if (!from || !to) return null;
                  const selected = selection?.kind === "edge" && selection.id === edge.id;
                  const dx = to.x - from.x;
                  const dy = to.y - from.y;
                  const length = Math.hypot(dx, dy) || 1;
                  const startX = from.x + (dx / length) * NODE_RADIUS;
                  const startY = from.y + (dy / length) * NODE_RADIUS;
                  const endX = to.x - (dx / length) * (NODE_RADIUS + 8);
                  const endY = to.y - (dy / length) * (NODE_RADIUS + 8);
                  const labelX = (startX + endX) / 2;
                  const labelY = (startY + endY) / 2;

                  return (
                    <g
                      key={edge.id}
                      onMouseDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelection({ kind: "edge", id: edge.id });
                      }}
                      className="cursor-pointer"
                    >
                      <line
                        x1={startX}
                        y1={startY}
                        x2={endX}
                        y2={endY}
                        stroke={selected ? "#4ca3ff" : "#4ca3ff55"}
                        strokeWidth={selected ? 3 : 2}
                        markerEnd="url(#arrow-out)"
                      />
                      <rect
                        x={labelX - 42}
                        y={labelY - 12}
                        width={84}
                        height={24}
                        rx={8}
                        fill={selected ? "#4ca3ff22" : "#0d0d18cc"}
                        stroke={selected ? "#4ca3ff55" : "#2a2a3c"}
                      />
                      <text
                        x={labelX}
                        y={labelY + 4}
                        textAnchor="middle"
                        fill={selected ? "#c7e5ff" : "#8888a0"}
                        fontSize="11"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {formatAmount(edge.amountSui)}
                      </text>
                    </g>
                  );
                })}

                {nodeList.map((node) => {
                  const selected = selection?.kind === "node" && selection.id === node.id;
                  const fill = node.isRoot
                    ? "#6c63ff"
                    : node.expanded
                      ? "#00d4aa"
                      : "#1e1e1e";
                  const stroke = selected
                    ? "#f0f0f5"
                    : node.expanding
                      ? "#ffb347"
                      : node.isRoot
                        ? "#9d97ff"
                        : "#4ca3ff66";

                  const isDragging = draggingNodeId === node.id;

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x}, ${node.y})`}
                      onMouseDown={(event) => onNodeMouseDown(event, node)}
                      className={isDragging ? "cursor-grabbing" : "cursor-grab"}
                    >
                      <circle
                        r={NODE_RADIUS}
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={selected ? 3 : 2}
                      />
                      {node.expanding && (
                        <circle
                          r={NODE_RADIUS + 6}
                          fill="none"
                          stroke="#ffb347"
                          strokeWidth={2}
                          strokeDasharray="4 4"
                        />
                      )}
                      <text
                        y={5}
                        textAnchor="middle"
                        fill={node.isRoot || node.expanded ? "#0a0a0f" : "#f0f0f5"}
                        fontSize="10"
                        fontWeight="700"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {shortAddress(node.id)}
                      </text>
                      {!node.expanded && !node.expanding && !isDragging && (
                        <text
                          y={NODE_RADIUS + 16}
                          textAnchor="middle"
                          fill="#55556a"
                          fontSize="9"
                        >
                          drag · click to expand
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </div>

        <aside className="w-[300px] flex-shrink-0 border-l border-white/[0.06] bg-[#12121a] p-4 overflow-y-auto">
          <p className="text-[11px] font-bold uppercase tracking-[1.2px] text-[#8888a0] mb-3">
            Inspector
          </p>

          {!selection ? (
            <p className="text-[12px] text-[#8888a0] leading-relaxed">
              Select a node or transaction edge to inspect details.
            </p>
          ) : selectedNode ? (
            <div className="space-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[#55556a] mb-1">
                  Address
                </p>
                <p className="text-[11px] font-mono text-[#a8b0c8] break-all">
                  {selectedNode.id}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[12px]">
                <div className="rounded-lg bg-white/[0.04] px-3 py-2">
                  <div className="text-[#55556a] text-[10px]">Depth</div>
                  <div className="text-[#f0f0f5] font-medium">{selectedNode.depth}</div>
                </div>
                <div className="rounded-lg bg-white/[0.04] px-3 py-2">
                  <div className="text-[#55556a] text-[10px]">Status</div>
                  <div className="text-[#f0f0f5] font-medium">
                    {selectedNode.expanded ? "Expanded" : "Click to expand"}
                  </div>
                </div>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[#55556a] mb-2">
                  Connected edges
                </p>
                <div className="space-y-2">
                  {edgeList
                    .filter(
                      (edge) =>
                        edge.from === selectedNode.id ||
                        edge.to === selectedNode.id,
                    )
                    .slice(0, 8)
                    .map((edge) => {
                      const outgoing = edge.from === selectedNode.id;
                      return (
                        <button
                          key={edge.id}
                          onClick={() =>
                            setSelection({ kind: "edge", id: edge.id })
                          }
                          className="w-full text-left rounded-xl border border-[#2a2a3c] bg-[#1e1e1e] px-3 py-2.5 cursor-pointer hover:border-[#4ca3ff]/35"
                        >
                          <div className="flex items-center gap-2 text-[11px] text-[#f0f0f5]">
                            {outgoing ? (
                              <ArrowRight size={12} className="text-[#4ca3ff]" />
                            ) : (
                              <ArrowLeft size={12} className="text-[#00d4aa]" />
                            )}
                            {formatAmount(edge.amountSui)}
                          </div>
                          <div className="text-[10px] font-mono text-[#55556a] mt-1 truncate">
                            {edge.digest}
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>
          ) : selectedEdge ? (
            <div className="space-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[#55556a] mb-1">
                  Amount
                </p>
                <p className="text-lg font-semibold text-[#4ca3ff]">
                  {formatAmount(selectedEdge.amountSui)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[#55556a] mb-1">
                  Digest
                </p>
                <p className="text-[11px] font-mono text-[#a8b0c8] break-all">
                  {selectedEdge.digest}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[#55556a] mb-1">
                  From
                </p>
                <p className="text-[11px] font-mono text-[#a8b0c8] break-all">
                  {selectedEdge.from}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[#55556a] mb-1">
                  To
                </p>
                <p className="text-[11px] font-mono text-[#a8b0c8] break-all">
                  {selectedEdge.to}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[#55556a] mb-1">
                  Time
                </p>
                <p className="text-[12px] text-[#8888a0]">
                  {formatTime(selectedEdge.timestampMs)}
                </p>
              </div>
            </div>
          ) : null}

          <div className="mt-6 pt-4 border-t border-white/[0.06] text-[11px] text-[#55556a] leading-relaxed">
            {nodeList.length} addresses · {edgeList.length} transfers shown
          </div>
        </aside>
      </div>
    </div>
  );
}