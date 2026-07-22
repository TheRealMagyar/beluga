/** Smart-money structure detection for chart overlays */

export type ChartToolId = "ob" | "bos" | "fvg" | "choch" | "liq" | "swings";

export const CHART_TOOLS: {
  id: ChartToolId;
  label: string;
  title: string;
  color: string;
}[] = [
  { id: "ob", label: "OB", title: "Order Block", color: "#0ecb81" },
  { id: "bos", label: "BOS", title: "Break of Structure", color: "#a78bfa" },
  { id: "fvg", label: "FVG", title: "Fair Value Gap / Imbalance", color: "#38bdf8" },
  { id: "choch", label: "CHoCH", title: "Change of Character", color: "#f59e0b" },
  { id: "liq", label: "Liq", title: "Liquidity (equal highs/lows)", color: "#f472b6" },
  { id: "swings", label: "Swing", title: "Swing highs & lows", color: "#94a3b8" },
];

export interface StructureCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface ZoneDrawing {
  kind: "zone";
  tool: ChartToolId;
  timeStart: number;
  timeEnd: number;
  priceTop: number;
  priceBottom: number;
  bullish: boolean;
  label: string;
}

export interface LineDrawing {
  kind: "line";
  tool: ChartToolId;
  timeStart: number;
  timeEnd: number;
  price: number;
  bullish: boolean;
  label: string;
  dashed?: boolean;
}

export interface MarkerDrawing {
  kind: "marker";
  tool: ChartToolId;
  time: number;
  price: number;
  bullish: boolean;
  label: string;
}

export type StructureDrawing = ZoneDrawing | LineDrawing | MarkerDrawing;

function isBull(c: StructureCandle) {
  return c.close >= c.open;
}

function bodyTop(c: StructureCandle) {
  return Math.max(c.open, c.close);
}

function bodyBottom(c: StructureCandle) {
  return Math.min(c.open, c.close);
}

function findSwings(
  candles: StructureCandle[],
  left = 3,
  right = 3,
): { index: number; price: number; type: "high" | "low" }[] {
  const out: { index: number; price: number; type: "high" | "low" }[] = [];
  if (candles.length < left + right + 1) return out;

  for (let i = left; i < candles.length - right; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - left; j <= i + right; j++) {
      if (j === i) continue;
      if (candles[j].high >= candles[i].high) isHigh = false;
      if (candles[j].low <= candles[i].low) isLow = false;
    }
    if (isHigh) out.push({ index: i, price: candles[i].high, type: "high" });
    if (isLow) out.push({ index: i, price: candles[i].low, type: "low" });
  }
  return out;
}

function detectFvg(
  candles: StructureCandle[],
  maxZones = 18,
): ZoneDrawing[] {
  const zones: ZoneDrawing[] = [];
  const lastTime = candles[candles.length - 1]?.time ?? 0;

  for (let i = 1; i < candles.length - 1; i++) {
    const a = candles[i - 1];
    const c = candles[i + 1];

    // Bullish FVG: gap up
    if (a.high < c.low) {
      const gap = c.low - a.high;
      const mid = (a.high + a.low) / 2 || a.close;
      if (gap / Math.max(mid, 1e-12) < 0.00015) continue;
      zones.push({
        kind: "zone",
        tool: "fvg",
        timeStart: a.time,
        timeEnd: lastTime,
        priceTop: c.low,
        priceBottom: a.high,
        bullish: true,
        label: "FVG",
      });
    }

    // Bearish FVG: gap down
    if (a.low > c.high) {
      const gap = a.low - c.high;
      const mid = (a.high + a.low) / 2 || a.close;
      if (gap / Math.max(mid, 1e-12) < 0.00015) continue;
      zones.push({
        kind: "zone",
        tool: "fvg",
        timeStart: a.time,
        timeEnd: lastTime,
        priceTop: a.low,
        priceBottom: c.high,
        bullish: false,
        label: "FVG",
      });
    }
  }

  // Keep most recent
  return zones.slice(-maxZones);
}

function detectOrderBlocks(
  candles: StructureCandle[],
  maxZones = 10,
): ZoneDrawing[] {
  const zones: ZoneDrawing[] = [];
  if (candles.length < 8) return zones;
  const lastTime = candles[candles.length - 1].time;

  for (let i = 4; i < candles.length - 2; i++) {
    const c = candles[i];
    const next = candles[i + 1];
    const next2 = candles[i + 2];

    // Bullish OB: bearish candle followed by strong bullish impulse
    if (!isBull(c)) {
      const impulse =
        next2.close > c.high &&
        next2.close > next.close &&
        (next2.close - c.low) / Math.max(c.low, 1e-12) > 0.004;
      if (impulse) {
        zones.push({
          kind: "zone",
          tool: "ob",
          timeStart: c.time,
          timeEnd: lastTime,
          priceTop: bodyTop(c),
          priceBottom: bodyBottom(c),
          bullish: true,
          label: "OB",
        });
      }
    }

    // Bearish OB: bullish candle followed by strong bearish impulse
    if (isBull(c)) {
      const impulse =
        next2.close < c.low &&
        next2.close < next.close &&
        (c.high - next2.close) / Math.max(c.high, 1e-12) > 0.004;
      if (impulse) {
        zones.push({
          kind: "zone",
          tool: "ob",
          timeStart: c.time,
          timeEnd: lastTime,
          priceTop: bodyTop(c),
          priceBottom: bodyBottom(c),
          bullish: false,
          label: "OB",
        });
      }
    }
  }

  // Deduplicate nearby OBs — keep later ones
  const filtered: ZoneDrawing[] = [];
  for (const z of zones) {
    const near = filtered.find(
      (f) =>
        f.bullish === z.bullish &&
        Math.abs(f.priceTop - z.priceTop) / Math.max(z.priceTop, 1e-12) < 0.003,
    );
    if (near) {
      // replace older
      const idx = filtered.indexOf(near);
      filtered[idx] = z;
    } else {
      filtered.push(z);
    }
  }
  return filtered.slice(-maxZones);
}

function detectBosChoch(
  candles: StructureCandle[],
): { bos: StructureDrawing[]; choch: StructureDrawing[] } {
  const bos: StructureDrawing[] = [];
  const choch: StructureDrawing[] = [];
  const swings = findSwings(candles, 3, 3);
  if (swings.length < 3) return { bos, choch };

  let trend: "up" | "down" | null = null;
  let lastHigh = swings.find((s) => s.type === "high");
  let lastLow = swings.find((s) => s.type === "low");

  for (let i = 1; i < swings.length; i++) {
    const s = swings[i];
    if (s.type === "high") {
      if (lastHigh && s.price > lastHigh.price) {
        // higher high
        if (trend === "down") {
          // CHoCH bullish
          choch.push({
            kind: "marker",
            tool: "choch",
            time: candles[s.index].time,
            price: s.price,
            bullish: true,
            label: "CHoCH",
          });
          choch.push({
            kind: "line",
            tool: "choch",
            timeStart: candles[lastHigh.index].time,
            timeEnd: candles[s.index].time,
            price: lastHigh.price,
            bullish: true,
            label: "",
            dashed: true,
          });
        } else if (trend === "up" || trend === null) {
          bos.push({
            kind: "marker",
            tool: "bos",
            time: candles[s.index].time,
            price: s.price,
            bullish: true,
            label: "BOS",
          });
          bos.push({
            kind: "line",
            tool: "bos",
            timeStart: candles[lastHigh.index].time,
            timeEnd: candles[s.index].time,
            price: lastHigh.price,
            bullish: true,
            label: "",
            dashed: false,
          });
        }
        trend = "up";
      }
      lastHigh = s;
    } else {
      if (lastLow && s.price < lastLow.price) {
        if (trend === "up") {
          choch.push({
            kind: "marker",
            tool: "choch",
            time: candles[s.index].time,
            price: s.price,
            bullish: false,
            label: "CHoCH",
          });
          choch.push({
            kind: "line",
            tool: "choch",
            timeStart: candles[lastLow.index].time,
            timeEnd: candles[s.index].time,
            price: lastLow.price,
            bullish: false,
            label: "",
            dashed: true,
          });
        } else if (trend === "down" || trend === null) {
          bos.push({
            kind: "marker",
            tool: "bos",
            time: candles[s.index].time,
            price: s.price,
            bullish: false,
            label: "BOS",
          });
          bos.push({
            kind: "line",
            tool: "bos",
            timeStart: candles[lastLow.index].time,
            timeEnd: candles[s.index].time,
            price: lastLow.price,
            bullish: false,
            label: "",
            dashed: false,
          });
        }
        trend = "down";
      }
      lastLow = s;
    }
  }

  // Also detect close-based BOS vs last swing
  const recentSwings = swings.slice(-12);
  for (let i = 6; i < candles.length; i++) {
    const c = candles[i];
    const priorHighs = recentSwings.filter(
      (s) => s.type === "high" && s.index < i,
    );
    const priorLows = recentSwings.filter(
      (s) => s.type === "low" && s.index < i,
    );
    const sh = priorHighs[priorHighs.length - 1];
    const sl = priorLows[priorLows.length - 1];

    if (sh && c.close > sh.price && candles[i - 1].close <= sh.price) {
      bos.push({
        kind: "marker",
        tool: "bos",
        time: c.time,
        price: c.high,
        bullish: true,
        label: "BOS",
      });
    }
    if (sl && c.close < sl.price && candles[i - 1].close >= sl.price) {
      bos.push({
        kind: "marker",
        tool: "bos",
        time: c.time,
        price: c.low,
        bullish: false,
        label: "BOS",
      });
    }
  }

  // Cap
  return {
    bos: bos.slice(-24),
    choch: choch.slice(-16),
  };
}

function detectLiquidity(
  candles: StructureCandle[],
  tolerancePct = 0.0012,
): LineDrawing[] {
  const lines: LineDrawing[] = [];
  const swings = findSwings(candles, 2, 2);
  const lastTime = candles[candles.length - 1]?.time ?? 0;

  const highs = swings.filter((s) => s.type === "high");
  const lows = swings.filter((s) => s.type === "low");

  const groupEquals = (
    points: typeof highs,
    bullish: boolean,
  ) => {
    const used = new Set<number>();
    for (let i = 0; i < points.length; i++) {
      if (used.has(i)) continue;
      const group = [points[i]];
      used.add(i);
      for (let j = i + 1; j < points.length; j++) {
        if (used.has(j)) continue;
        const avg =
          group.reduce((a, p) => a + p.price, 0) / group.length;
        if (
          Math.abs(points[j].price - avg) / Math.max(avg, 1e-12) <=
          tolerancePct
        ) {
          group.push(points[j]);
          used.add(j);
        }
      }
      if (group.length >= 2) {
        const price =
          group.reduce((a, p) => a + p.price, 0) / group.length;
        const t0 = candles[group[0].index].time;
        lines.push({
          kind: "line",
          tool: "liq",
          timeStart: t0,
          timeEnd: lastTime,
          price,
          bullish,
          label: bullish ? "EQH" : "EQL",
          dashed: true,
        });
      }
    }
  };

  groupEquals(highs, true);
  groupEquals(lows, false);
  return lines.slice(-14);
}

function detectSwingMarkers(
  candles: StructureCandle[],
): MarkerDrawing[] {
  return findSwings(candles, 3, 3)
    .slice(-40)
    .map((s) => ({
      kind: "marker" as const,
      tool: "swings" as const,
      time: candles[s.index].time,
      price: s.price,
      bullish: s.type === "low",
      label: s.type === "high" ? "SH" : "SL",
    }));
}

export function analyzeStructure(
  candles: StructureCandle[],
  active: Set<ChartToolId> | ChartToolId[],
): StructureDrawing[] {
  const tools = active instanceof Set ? active : new Set(active);
  if (candles.length < 6 || tools.size === 0) return [];

  const out: StructureDrawing[] = [];

  if (tools.has("fvg")) out.push(...detectFvg(candles));
  if (tools.has("ob")) out.push(...detectOrderBlocks(candles));
  if (tools.has("bos") || tools.has("choch")) {
    const { bos, choch } = detectBosChoch(candles);
    if (tools.has("bos")) out.push(...bos);
    if (tools.has("choch")) out.push(...choch);
  }
  if (tools.has("liq")) out.push(...detectLiquidity(candles));
  if (tools.has("swings")) out.push(...detectSwingMarkers(candles));

  return out;
}

export function toolStyle(tool: ChartToolId, bullish: boolean): {
  fill: string;
  stroke: string;
  text: string;
} {
  switch (tool) {
    case "ob":
      return bullish
        ? {
            fill: "rgba(14,203,129,0.14)",
            stroke: "rgba(14,203,129,0.65)",
            text: "#0ecb81",
          }
        : {
            fill: "rgba(246,70,93,0.14)",
            stroke: "rgba(246,70,93,0.65)",
            text: "#f6465d",
          };
    case "fvg":
      return bullish
        ? {
            fill: "rgba(56,189,248,0.12)",
            stroke: "rgba(56,189,248,0.5)",
            text: "#38bdf8",
          }
        : {
            fill: "rgba(251,146,60,0.12)",
            stroke: "rgba(251,146,60,0.5)",
            text: "#fb923c",
          };
    case "bos":
      return {
        fill: "transparent",
        stroke: bullish ? "#a78bfa" : "#c084fc",
        text: "#c4b5fd",
      };
    case "choch":
      return {
        fill: "transparent",
        stroke: bullish ? "#f59e0b" : "#fbbf24",
        text: "#fbbf24",
      };
    case "liq":
      return {
        fill: "transparent",
        stroke: "rgba(244,114,182,0.7)",
        text: "#f9a8d4",
      };
    case "swings":
      return {
        fill: bullish ? "#0ecb81" : "#f6465d",
        stroke: bullish ? "#0ecb81" : "#f6465d",
        text: "#94a3b8",
      };
    default:
      return {
        fill: "rgba(255,255,255,0.05)",
        stroke: "#888",
        text: "#aaa",
      };
  }
}
