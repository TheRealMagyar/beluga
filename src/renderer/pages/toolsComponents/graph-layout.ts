import type { GraphNode } from "./types";

export const CANVAS_SIZE = 2400;
export const NODE_RADIUS = 28;
const MIN_NODE_GAP = 56;
export const MIN_NODE_DISTANCE = NODE_RADIUS * 2 + MIN_NODE_GAP;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function collidesWithAny(
  x: number,
  y: number,
  occupied: Map<string, GraphNode>,
  ignoreId?: string,
): boolean {
  for (const node of occupied.values()) {
    if (ignoreId && node.id === ignoreId) continue;
    if (Math.hypot(node.x - x, node.y - y) < MIN_NODE_DISTANCE) {
      return true;
    }
  }
  return false;
}

function findFreePosition(
  preferredX: number,
  preferredY: number,
  occupied: Map<string, GraphNode>,
): { x: number; y: number } {
  const bounded = {
    x: clamp(preferredX, NODE_RADIUS + 20, CANVAS_SIZE - NODE_RADIUS - 20),
    y: clamp(preferredY, NODE_RADIUS + 20, CANVAS_SIZE - NODE_RADIUS - 20),
  };

  if (!collidesWithAny(bounded.x, bounded.y, occupied)) {
    return bounded;
  }

  for (let ring = 1; ring <= 30; ring++) {
    const ringDistance = ring * (MIN_NODE_DISTANCE * 0.62);
    const steps = Math.max(10, Math.ceil(ring * 5.5));

    for (let step = 0; step < steps; step++) {
      const angle = (Math.PI * 2 * step) / steps;
      const x = clamp(
        bounded.x + Math.cos(angle) * ringDistance,
        NODE_RADIUS + 20,
        CANVAS_SIZE - NODE_RADIUS - 20,
      );
      const y = clamp(
        bounded.y + Math.sin(angle) * ringDistance,
        NODE_RADIUS + 20,
        CANVAS_SIZE - NODE_RADIUS - 20,
      );

      if (!collidesWithAny(x, y, occupied)) {
        return { x, y };
      }
    }
  }

  return bounded;
}

function relaxNodes(nodes: Map<string, GraphNode>, anchorId?: string) {
  const list = Array.from(nodes.values());
  const iterations = 14;

  for (let pass = 0; pass < iterations; pass++) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy) || 0.001;

        if (distance >= MIN_NODE_DISTANCE) continue;

        const overlap = (MIN_NODE_DISTANCE - distance) / 2;
        const nx = dx / distance;
        const ny = dy / distance;
        const aAnchored = a.id === anchorId;
        const bAnchored = b.id === anchorId;

        if (aAnchored && !bAnchored) {
          b.x += nx * overlap * 2;
          b.y += ny * overlap * 2;
        } else if (bAnchored && !aAnchored) {
          a.x -= nx * overlap * 2;
          a.y -= ny * overlap * 2;
        } else {
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;
        }

        a.x = clamp(a.x, NODE_RADIUS + 20, CANVAS_SIZE - NODE_RADIUS - 20);
        a.y = clamp(a.y, NODE_RADIUS + 20, CANVAS_SIZE - NODE_RADIUS - 20);
        b.x = clamp(b.x, NODE_RADIUS + 20, CANVAS_SIZE - NODE_RADIUS - 20);
        b.y = clamp(b.y, NODE_RADIUS + 20, CANVAS_SIZE - NODE_RADIUS - 20);
      }
    }
  }
}

export function placeAround(
  center: GraphNode,
  ids: string[],
  existing: Map<string, GraphNode>,
): GraphNode[] {
  const pendingIds = ids.filter((id) => !existing.has(id));
  if (!pendingIds.length) return [];

  const occupied = new Map(existing);
  const newcomers: GraphNode[] = [];

  const ringRadius = Math.max(
    180 + center.depth * 36,
    (MIN_NODE_DISTANCE * pendingIds.length) / (2 * Math.PI),
  );

  pendingIds.forEach((id, index) => {
    const angle =
      (Math.PI * 2 * index) / pendingIds.length - Math.PI / 2;
    const preferredX = center.x + Math.cos(angle) * ringRadius;
    const preferredY = center.y + Math.sin(angle) * ringRadius;
    const { x, y } = findFreePosition(preferredX, preferredY, occupied);

    const node: GraphNode = {
      id,
      x,
      y,
      expanded: false,
      expanding: false,
      isRoot: false,
      depth: center.depth + 1,
    };

    newcomers.push(node);
    occupied.set(id, node);
  });

  relaxNodes(occupied, center.id);

  return newcomers.map((node) => occupied.get(node.id)!);
}