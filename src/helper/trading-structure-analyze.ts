/** Pure structure analysis for trading agent (main-process safe). */

export interface StructureCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export type ToolId = "ob" | "bos" | "fvg" | "swings";

export interface StructureHit {
  tool: ToolId;
  label: string;
  bullish: boolean;
  time: number;
  price?: number;
  priceTop?: number;
  priceBottom?: number;
}

function isBull(c: StructureCandle) {
  return c.close >= c.open;
}

function bodyTop(c: StructureCandle) {
  return Math.max(c.open, c.close);
}
function bodyBottom(c: StructureCandle) {
  return Math.min(c.open, c.close);
}

function findSwings(candles: StructureCandle[], left = 3, right = 3) {
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

export function analyzeStructure(
  candles: StructureCandle[],
  tools: ToolId[],
): StructureHit[] {
  const set = new Set(tools);
  const hits: StructureHit[] = [];
  if (candles.length < 6) return hits;

  if (set.has("fvg")) {
    for (let i = 1; i < candles.length - 1; i++) {
      const a = candles[i - 1];
      const c = candles[i + 1];
      if (a.high < c.low) {
        hits.push({
          tool: "fvg",
          label: "FVG",
          bullish: true,
          time: a.time,
          priceTop: c.low,
          priceBottom: a.high,
        });
      }
      if (a.low > c.high) {
        hits.push({
          tool: "fvg",
          label: "FVG",
          bullish: false,
          time: a.time,
          priceTop: a.low,
          priceBottom: c.high,
        });
      }
    }
  }

  if (set.has("ob")) {
    for (let i = 4; i < candles.length - 2; i++) {
      const c = candles[i];
      const next = candles[i + 1];
      const next2 = candles[i + 2];
      if (
        !isBull(c) &&
        next2.close > c.high &&
        (next2.close - c.low) / Math.max(c.low, 1e-12) > 0.004
      ) {
        hits.push({
          tool: "ob",
          label: "OB",
          bullish: true,
          time: c.time,
          priceTop: bodyTop(c),
          priceBottom: bodyBottom(c),
        });
      }
      if (
        isBull(c) &&
        next2.close < c.low &&
        (c.high - next2.close) / Math.max(c.high, 1e-12) > 0.004
      ) {
        hits.push({
          tool: "ob",
          label: "OB",
          bullish: false,
          time: c.time,
          priceTop: bodyTop(c),
          priceBottom: bodyBottom(c),
        });
      }
    }
  }

  if (set.has("bos") || set.has("swings")) {
    const swings = findSwings(candles, 3, 3);
    if (set.has("swings")) {
      for (const s of swings.slice(-20)) {
        hits.push({
          tool: "swings",
          label: s.type === "high" ? "SH" : "SL",
          bullish: s.type === "low",
          time: candles[s.index].time,
          price: s.price,
        });
      }
    }
    if (set.has("bos")) {
      for (let i = 6; i < candles.length; i++) {
        const c = candles[i];
        const priorHighs = swings.filter((s) => s.type === "high" && s.index < i);
        const priorLows = swings.filter((s) => s.type === "low" && s.index < i);
        const sh = priorHighs[priorHighs.length - 1];
        const sl = priorLows[priorLows.length - 1];
        if (sh && c.close > sh.price && candles[i - 1].close <= sh.price) {
          hits.push({
            tool: "bos",
            label: "BOS",
            bullish: true,
            time: c.time,
            price: c.high,
          });
        }
        if (sl && c.close < sl.price && candles[i - 1].close >= sl.price) {
          hits.push({
            tool: "bos",
            label: "BOS",
            bullish: false,
            time: c.time,
            price: c.low,
          });
        }
      }
    }
  }

  return hits.slice(-30);
}
