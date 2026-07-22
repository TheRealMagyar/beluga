import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useLayoutEffect,
  useCallback,
} from "react";
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type UTCTimestamp,
  type CandlestickData,
  type SeriesMarker,
} from "lightweight-charts";
import { useWallet } from "../components/Walletcontext";
import {
  fetchDeepBookMidPriceReadonly,
  isDeepBookNetwork,
  listDeepBookPools,
  resolveDeepBookPoolForCoin,
  type DeepBookNetwork,
} from "./playgroundComponents/deepbook-playground";
import {
  analyzeStructure,
  CHART_TOOLS,
  toolStyle,
  type ChartToolId,
  type StructureCandle,
  type StructureDrawing,
} from "./chartStructureTools";
import { TradingTradePanel } from "./TradingTradePanel";
import { TradingAgentPanel } from "./TradingAgentPanel";

interface SymbolItem {
  label: string;
  symbol: string;
  category: "crypto" | "stock" | "sui" | "deepbook";
  isOnchain?: boolean;
  poolKey?: string;
  pythBase?: string;
}

interface Watchlist {
  id: string;
  name: string;
  symbols: string[];
}

interface ChartTarget {
  symbol: string;
  mode: "tv" | "onchain";
  label: string;
  tvSymbol?: string;
  poolKey?: string;
  pythBase?: string;
}

const STORAGE = {
  WATCHLISTS: "beluga-charts-watchlists",
  ACTIVE: "beluga-charts-active-watchlist",
  LAST_SYMBOL: "beluga-charts-last-symbol",
  TIMEFRAME: "beluga-charts-timeframe",
};

const DEFAULT_SYMBOL = "BINANCE:BTCUSDT";

type TimeframeId = "1s" | "1m" | "5m" | "15m" | "1h" | "4h" | "1D" | "1W";

const TIMEFRAMES: {
  id: TimeframeId;
  label: string;
  pythResolution: string | null; // null = live-only (1s)
  tvInterval: string;
  lookbackDays: number;
  barSeconds: number;
  seedBars: number;
}[] = [
  {
    id: "1s",
    label: "1s",
    pythResolution: null,
    tvInterval: "1",
    lookbackDays: 0,
    barSeconds: 1,
    seedBars: 180,
  },
  {
    id: "1m",
    label: "1m",
    pythResolution: "1",
    tvInterval: "1",
    lookbackDays: 1,
    barSeconds: 60,
    seedBars: 180,
  },
  {
    id: "5m",
    label: "5m",
    pythResolution: "5",
    tvInterval: "5",
    lookbackDays: 3,
    barSeconds: 300,
    seedBars: 180,
  },
  {
    id: "15m",
    label: "15m",
    pythResolution: "15",
    tvInterval: "15",
    lookbackDays: 5,
    barSeconds: 900,
    seedBars: 160,
  },
  {
    id: "1h",
    label: "1h",
    pythResolution: "60",
    tvInterval: "60",
    lookbackDays: 14,
    barSeconds: 3600,
    seedBars: 168,
  },
  {
    id: "4h",
    label: "4h",
    pythResolution: "240",
    tvInterval: "240",
    lookbackDays: 60,
    barSeconds: 14400,
    seedBars: 180,
  },
  {
    id: "1D",
    label: "1D",
    pythResolution: "D",
    tvInterval: "D",
    lookbackDays: 364,
    barSeconds: 86400,
    seedBars: 180,
  },
  {
    id: "1W",
    label: "1W",
    pythResolution: "W",
    tvInterval: "W",
    lookbackDays: 364,
    barSeconds: 604800,
    seedBars: 52,
  },
];

const MARKET_SYMBOLS: SymbolItem[] = [
  { label: "BTC/USDT", symbol: "BINANCE:BTCUSDT", category: "crypto" },
  { label: "ETH/USDT", symbol: "BINANCE:ETHUSDT", category: "crypto" },
  { label: "SOL/USDT", symbol: "BINANCE:SOLUSDT", category: "crypto" },
  { label: "AAPL", symbol: "NASDAQ:AAPL", category: "stock" },
  { label: "TSLA", symbol: "NASDAQ:TSLA", category: "stock" },
  { label: "SPY", symbol: "AMEX:SPY", category: "stock" },
  { label: "NVDA", symbol: "NASDAQ:NVDA", category: "stock" },
];

const SUI_PYTH_FEEDS: SymbolItem[] = [
  { label: "SUI", symbol: "SUI", category: "sui", isOnchain: true, pythBase: "SUI", poolKey: "SUI_USDC" },
  { label: "CETUS", symbol: "CETUS", category: "sui", isOnchain: true, pythBase: "CETUS" },
  { label: "DEEP", symbol: "DEEP", category: "sui", isOnchain: true, pythBase: "DEEP", poolKey: "DEEP_USDC" },
  { label: "NAVX", symbol: "NAVX", category: "sui", isOnchain: true, pythBase: "NAVX" },
  { label: "WAL", symbol: "WAL", category: "sui", isOnchain: true, pythBase: "WAL", poolKey: "WAL_USDC" },
  { label: "IKA", symbol: "IKA", category: "sui", isOnchain: true, pythBase: "IKA", poolKey: "IKA_USDC" },
  { label: "NS", symbol: "NS", category: "sui", isOnchain: true, pythBase: "NS", poolKey: "NS_USDC" },
  { label: "SEND", symbol: "SEND", category: "sui", isOnchain: true, pythBase: "SEND", poolKey: "SEND_USDC" },
];

const PYTH_FEEDS: Record<string, { priceId: string; historySymbol: string }> = {
  SUI: {
    priceId: "0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744",
    historySymbol: "Crypto.SUI/USD",
  },
  CETUS: {
    priceId: "0xe5b274b2611143df055d6e7cd8d93fe1961716bcd4dca1cad87a83bc1e78c1ef",
    historySymbol: "Crypto.CETUS/USD",
  },
  DEEP: {
    priceId: "0x29bdd5248234e33bd93d3b81100b5fa32eaa5997843847e2c2cb16d7c6d9f7ff",
    historySymbol: "Crypto.DEEP/USD",
  },
  NAVX: {
    priceId: "0x88250f854c019ef4f88a5c073d52a18bb1c6ac437033f5932cd017d24917ab46",
    historySymbol: "Crypto.NAVX/USD",
  },
  WAL: {
    priceId: "0xeba0732395fae9dec4bae12e52760b35fc1c5671e2da8b449c9af4efe5d54341",
    historySymbol: "Crypto.WAL/USD",
  },
  IKA: {
    priceId: "0x2b529621fa6e2c8429f623ba705572aa64175d7768365ef829df6a12c9f365f4",
    historySymbol: "Crypto.IKA/USD",
  },
  SEND: {
    priceId: "0x7d19b607c945f7edf3a444289c86f7b58dcd8b18df82deadf925074807c99b59",
    historySymbol: "Crypto.SEND/USD",
  },
  NS: {
    priceId: "0xbb5ff26e47a3a6cc7ec2fce1db996c2a145300edc5acaabe43bf9ff7c5dd5d32",
    historySymbol: "Crypto.NS/USD",
  },
};

const pythIdCache: Record<string, { priceId: string; historySymbol: string }> = {
  ...PYTH_FEEDS,
};

type PriceSource = "pyth" | "deepbook" | null;

function parsePythPrice(price: { price: string | number; expo: number }): number {
  return Number(price.price) * Math.pow(10, price.expo);
}

async function resolvePythFeed(
  base: string,
): Promise<{ priceId: string; historySymbol: string } | null> {
  const key = base.trim().toUpperCase();
  if (!key) return null;
  if (pythIdCache[key]) return pythIdCache[key];

  try {
    const url = new URL("https://hermes.pyth.network/v2/price_feeds");
    url.searchParams.set("query", key);
    url.searchParams.set("asset_type", "crypto");
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const feeds = (await res.json()) as Array<{
      id: string;
      attributes?: { base?: string; quote_currency?: string; symbol?: string };
    }>;
    const exact =
      feeds.find(
        (f) =>
          f.attributes?.base?.toUpperCase() === key &&
          (f.attributes?.quote_currency === "USD" ||
            f.attributes?.symbol?.endsWith("/USD")),
      ) || feeds.find((f) => f.attributes?.base?.toUpperCase() === key);

    if (!exact?.id) return null;
    const priceId = exact.id.startsWith("0x") ? exact.id : `0x${exact.id}`;
    const historySymbol = exact.attributes?.symbol || `Crypto.${key}/USD`;
    const resolved = { priceId, historySymbol };
    pythIdCache[key] = resolved;
    return resolved;
  } catch {
    return null;
  }
}

async function fetchPythSpotByFeed(
  feed: { priceId: string } | null,
): Promise<number | null> {
  if (!feed) return null;
  try {
    const url = new URL("https://hermes.pyth.network/v2/updates/price/latest");
    url.searchParams.append("ids[]", feed.priceId);
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    const parsed = data?.parsed?.[0]?.price;
    if (!parsed) return null;
    return parsePythPrice(parsed);
  } catch {
    return null;
  }
}

async function fetchPythHistoryByFeed(
  historySymbol: string,
  resolution: string,
  days: number,
): Promise<CandlestickData[]> {
  const to = Math.floor(Date.now() / 1000);
  const cappedDays = Math.min(Math.max(days, 1), 364);
  const from = to - cappedDays * 86400;
  const url = new URL(
    "https://benchmarks.pyth.network/v1/shims/tradingview/history",
  );
  url.searchParams.set("symbol", historySymbol);
  url.searchParams.set("resolution", resolution);
  url.searchParams.set("from", String(from));
  url.searchParams.set("to", String(to));

  const res = await fetch(url.toString());
  if (!res.ok) return [];
  const data = await res.json();
  if (data?.s !== "ok" || !Array.isArray(data.t) || data.t.length === 0) return [];

  const candles: CandlestickData[] = [];
  for (let i = 0; i < data.t.length; i++) {
    const open = Number(data.o[i]);
    const high = Number(data.h[i]);
    const low = Number(data.l[i]);
    const close = Number(data.c[i]);
    if (![open, high, low, close].every((n) => Number.isFinite(n) && n > 0)) continue;
    candles.push({
      time: data.t[i] as UTCTimestamp,
      open,
      high,
      low,
      close,
    });
  }
  return candles;
}

/** Seed bars at bar interval ending at now (flat around spot — filled by live ticks). */
function seedLiveBars(
  spot: number,
  barSeconds: number,
  count: number,
): CandlestickData[] {
  const now = Math.floor(Date.now() / 1000);
  const aligned = Math.floor(now / barSeconds) * barSeconds;
  const out: CandlestickData[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const t = (aligned - i * barSeconds) as UTCTimestamp;
    out.push({
      time: t,
      open: spot,
      high: spot,
      low: spot,
      close: spot,
    });
  }
  return out;
}

function alignBarTime(unixSec: number, barSeconds: number): UTCTimestamp {
  return (Math.floor(unixSec / barSeconds) * barSeconds) as UTCTimestamp;
}

function formatPrice(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(4);
  if (n >= 0.01) return n.toFixed(6);
  return n.toPrecision(4);
}

function buildDeepBookPoolSymbols(network: DeepBookNetwork): SymbolItem[] {
  return listDeepBookPools(network).map((p) => ({
    label: `${p.baseCoin}/${p.quoteCoin}`,
    symbol: `DB:${p.key}`,
    category: "deepbook" as const,
    isOnchain: true,
    poolKey: p.key,
    pythBase: p.baseCoin,
  }));
}

function getDefaultDeepBookNetwork(
  walletNetwork: string | undefined,
): DeepBookNetwork {
  if (walletNetwork && isDeepBookNetwork(walletNetwork)) return walletNetwork;
  return "mainnet";
}

function resolveChartTarget(
  raw: string,
  network: DeepBookNetwork,
  catalog: SymbolItem[],
): ChartTarget {
  const input = raw.trim();
  if (!input) {
    return {
      symbol: DEFAULT_SYMBOL,
      mode: "tv",
      label: DEFAULT_SYMBOL,
      tvSymbol: DEFAULT_SYMBOL,
    };
  }

  const upper = input.toUpperCase();
  const exact = catalog.find(
    (s) =>
      s.symbol.toUpperCase() === upper || s.label.toUpperCase() === upper,
  );
  if (exact) {
    if (exact.isOnchain) {
      return {
        symbol: exact.symbol,
        mode: "onchain",
        label: exact.label,
        poolKey: exact.poolKey,
        pythBase: exact.pythBase || exact.label.split("/")[0],
      };
    }
    return {
      symbol: exact.symbol,
      mode: "tv",
      label: exact.label,
      tvSymbol: exact.symbol,
    };
  }

  if (/^[A-Z0-9_]+:[A-Z0-9._-]+$/i.test(input) && !upper.startsWith("DB:")) {
    return {
      symbol: upper,
      mode: "tv",
      label: upper,
      tvSymbol: upper,
    };
  }

  const pool = resolveDeepBookPoolForCoin(network, upper);
  if (pool) {
    return {
      symbol: `DB:${pool.key}`,
      mode: "onchain",
      label: `${pool.baseCoin}/${pool.quoteCoin}`,
      poolKey: pool.key,
      pythBase: pool.baseCoin,
    };
  }

  if (/^[A-Z][A-Z0-9]{1,15}$/i.test(upper)) {
    return {
      symbol: upper,
      mode: "onchain",
      label: upper,
      pythBase: upper,
      poolKey: resolveDeepBookPoolForCoin(network, upper)?.key,
    };
  }

  return {
    symbol: upper,
    mode: "tv",
    label: upper,
    tvSymbol: upper,
  };
}

const DEFAULT_WATCHLISTS: Watchlist[] = [
  {
    id: "default",
    name: "Default",
    symbols: ["BINANCE:BTCUSDT", "SUI", "DB:WAL_USDC"],
  },
  {
    id: "sui",
    name: "Sui",
    symbols: ["SUI", "DEEP", "WAL", "IKA", "DB:SUI_USDC"],
  },
];

export type ChartTradeMarker = {
  id: string;
  market: string;
  time: number;
  price: number;
  type: "long" | "short" | "swap" | "sl" | "tp" | "close_long" | "close_short";
  label: string;
};

interface OnchainChartProps {
  symbol: string;
  timeframe: TimeframeId;
  poolKey: string | null;
  pythBase: string | null;
  deepbookPrice: number | null;
  onSpotChange: (spot: number | null, source: PriceSource) => void;
  tradeMarkers?: ChartTradeMarker[];
}

function candleTime(c: CandlestickData): number {
  return typeof c.time === "number" ? c.time : (c.time as { timestamp?: number }).timestamp ?? 0;
}

function toStructureCandles(candles: CandlestickData[]): StructureCandle[] {
  return candles.map((c) => ({
    time: candleTime(c),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }));
}

function OnchainChart({
  symbol,
  timeframe,
  poolKey,
  pythBase,
  deepbookPrice,
  onSpotChange,
  tradeMarkers = [],
}: OnchainChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<SVGSVGElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lastCandleRef = useRef<CandlestickData | null>(null);
  const candlesRef = useRef<CandlestickData[]>([]);
  const deepbookPriceRef = useRef(deepbookPrice);
  const feedRef = useRef<{ priceId: string; historySymbol: string } | null>(null);
  const barSecondsRef = useRef(1);
  const usePythRef = useRef(true);
  const activeToolsRef = useRef<Set<ChartToolId>>(new Set());
  const drawingsRef = useRef<StructureDrawing[]>([]);
  const lastStructureAtRef = useRef(0);
  const tradePriceLinesRef = useRef<IPriceLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTools, setActiveTools] = useState<Set<ChartToolId>>(
    () => new Set(),
  );

  deepbookPriceRef.current = deepbookPrice;
  activeToolsRef.current = activeTools;

  const tf = TIMEFRAMES.find((t) => t.id === timeframe) || TIMEFRAMES[1];
  barSecondsRef.current = tf.barSeconds;

  // Draw agent entries / swaps / SL / TP on the candle series
  useEffect(() => {
    const series = seriesRef.current;
    if (!series || loading) return;

    const barSec = barSecondsRef.current || 1;
    const align = (t: number) =>
      (Math.floor(t / barSec) * barSec) as UTCTimestamp;

    // Clear previous SL/TP lines
    for (const pl of tradePriceLinesRef.current) {
      try {
        series.removePriceLine(pl);
      } catch {
        /* ignore */
      }
    }
    tradePriceLinesRef.current = [];

    if (!tradeMarkers.length) {
      try {
        series.setMarkers([]);
      } catch {
        /* ignore */
      }
      return;
    }

    // Markers: open long/short, close long/short, swap
    const markers: SeriesMarker<UTCTimestamp>[] = tradeMarkers
      .filter(
        (m) =>
          m.type === "long" ||
          m.type === "short" ||
          m.type === "swap" ||
          m.type === "close_long" ||
          m.type === "close_short",
      )
      .map((m) => {
        if (m.type === "long") {
          return {
            time: align(m.time),
            position: "belowBar" as const,
            shape: "arrowUp" as const,
            color: "#0ecb81",
            text: m.label || "LONG",
          };
        }
        if (m.type === "short") {
          return {
            time: align(m.time),
            position: "aboveBar" as const,
            shape: "arrowDown" as const,
            color: "#f6465d",
            text: m.label || "SHORT",
          };
        }
        if (m.type === "close_long") {
          // Closing a long = selling — mark above with square
          return {
            time: align(m.time),
            position: "aboveBar" as const,
            shape: "square" as const,
            color: "#86efac",
            text: m.label || "CLOSE LONG",
          };
        }
        if (m.type === "close_short") {
          // Cover short = buy back — mark below
          return {
            time: align(m.time),
            position: "belowBar" as const,
            shape: "square" as const,
            color: "#fca5a5",
            text: m.label || "CLOSE SHORT",
          };
        }
        return {
          time: align(m.time),
          position: "inBar" as const,
          shape: "circle" as const,
          color: "#4ca3ff",
          text: m.label || "SWAP",
        };
      })
      .sort((a, b) => (a.time as number) - (b.time as number));

    // Deduplicate times (lightweight-charts requires unique ascending times for markers)
    const deduped: SeriesMarker<UTCTimestamp>[] = [];
    const usedTimes = new Set<number>();
    for (const mk of markers) {
      let t = mk.time as number;
      while (usedTimes.has(t)) t += barSec;
      usedTimes.add(t);
      deduped.push({ ...mk, time: t as UTCTimestamp });
    }

    try {
      series.setMarkers(deduped);
    } catch {
      /* ignore */
    }

    // Latest SL/TP as horizontal price lines (per open risk levels)
    const levels = tradeMarkers.filter(
      (m) => m.type === "sl" || m.type === "tp",
    );
    // Show last few SL/TP only to avoid clutter
    const recent = levels.slice(-12);
    for (const lv of recent) {
      try {
        const pl = series.createPriceLine({
          price: lv.price,
          color: lv.type === "sl" ? "#f6465d" : "#0ecb81",
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: lv.label || (lv.type === "sl" ? "SL" : "TP"),
        });
        tradePriceLinesRef.current.push(pl);
      } catch {
        /* ignore */
      }
    }
  }, [tradeMarkers, loading, timeframe, symbol]);

  const redrawOverlay = useCallback(() => {
    const svg = overlayRef.current;
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!svg || !chart || !series) return;

    const drawings = drawingsRef.current;
    const timeScale = chart.timeScale();
    const w = svg.clientWidth || 0;
    const h = svg.clientHeight || 0;
    if (w < 10 || h < 10) return;

    const els: string[] = [];

    for (const d of drawings) {
      const style = toolStyle(d.tool, d.bullish);

      if (d.kind === "zone") {
        const x1 = timeScale.timeToCoordinate(d.timeStart as UTCTimestamp);
        const x2 = timeScale.timeToCoordinate(d.timeEnd as UTCTimestamp);
        const y1 = series.priceToCoordinate(d.priceTop);
        const y2 = series.priceToCoordinate(d.priceBottom);
        if (x1 == null || y1 == null || y2 == null) continue;
        const xEnd = x2 ?? w - 8;
        const left = Math.min(x1, xEnd);
        const width = Math.max(Math.abs(xEnd - x1), 4);
        const top = Math.min(y1, y2);
        const height = Math.max(Math.abs(y2 - y1), 2);
        els.push(
          `<rect x="${left}" y="${top}" width="${width}" height="${height}" fill="${style.fill}" stroke="${style.stroke}" stroke-width="1" rx="2"/>`,
        );
        if (d.label) {
          els.push(
            `<text x="${left + 4}" y="${top + 12}" fill="${style.text}" font-size="10" font-family="ui-monospace,monospace" font-weight="600">${d.label}</text>`,
          );
        }
      } else if (d.kind === "line") {
        const x1 = timeScale.timeToCoordinate(d.timeStart as UTCTimestamp);
        const x2 = timeScale.timeToCoordinate(d.timeEnd as UTCTimestamp);
        const y = series.priceToCoordinate(d.price);
        if (x1 == null || y == null) continue;
        const xEnd = x2 ?? w - 8;
        const dash = d.dashed ? ' stroke-dasharray="4 3"' : "";
        els.push(
          `<line x1="${x1}" y1="${y}" x2="${xEnd}" y2="${y}" stroke="${style.stroke}" stroke-width="1.25"${dash} opacity="0.85"/>`,
        );
        if (d.label) {
          els.push(
            `<text x="${xEnd - 28}" y="${y - 4}" fill="${style.text}" font-size="9" font-family="ui-monospace,monospace">${d.label}</text>`,
          );
        }
      } else if (d.kind === "marker") {
        const x = timeScale.timeToCoordinate(d.time as UTCTimestamp);
        const y = series.priceToCoordinate(d.price);
        if (x == null || y == null) continue;
        const dy = d.bullish ? 10 : -10;
        const arrow = d.bullish
          ? `${x},${y + 2} ${x - 5},${y + 12} ${x + 5},${y + 12}`
          : `${x},${y - 2} ${x - 5},${y - 12} ${x + 5},${y - 12}`;
        els.push(
          `<polygon points="${arrow}" fill="${style.stroke}" opacity="0.9"/>`,
        );
        if (d.label) {
          els.push(
            `<text x="${x + 6}" y="${y + dy}" fill="${style.text}" font-size="10" font-family="ui-monospace,monospace" font-weight="700">${d.label}</text>`,
          );
        }
      }
    }

    svg.innerHTML = els.join("");
  }, []);

  const recomputeStructure = useCallback(() => {
    const candles = toStructureCandles(candlesRef.current);
    drawingsRef.current = analyzeStructure(candles, activeToolsRef.current);
    lastStructureAtRef.current = Date.now();
    redrawOverlay();
  }, [redrawOverlay]);

  const setCandles = useCallback(
    (candles: CandlestickData[]) => {
      candlesRef.current = candles;
      if (activeToolsRef.current.size > 0) {
        recomputeStructure();
      }
    },
    [recomputeStructure],
  );

  const pushTick = useCallback(
    (spot: number) => {
      const series = seriesRef.current;
      if (!series || !Number.isFinite(spot) || spot <= 0) return;

      const barSeconds = barSecondsRef.current;
      const barTime = alignBarTime(Math.floor(Date.now() / 1000), barSeconds);
      const last = lastCandleRef.current;
      let candle: CandlestickData;

      if (!last || (last.time as number) < (barTime as number)) {
        const open = last?.close ?? spot;
        candle = {
          time: barTime,
          open,
          high: Math.max(open, spot),
          low: Math.min(open, spot),
          close: spot,
        };
        lastCandleRef.current = candle;
        series.update(candle);
        candlesRef.current = [...candlesRef.current, candle].slice(-2000);
        if (barSeconds <= 1) {
          chartRef.current?.timeScale().scrollToRealTime();
        }
      } else if ((last.time as number) === (barTime as number)) {
        candle = {
          time: barTime,
          open: last.open,
          high: Math.max(last.high, spot),
          low: Math.min(last.low, spot),
          close: spot,
        };
        lastCandleRef.current = candle;
        series.update(candle);
        const arr = candlesRef.current.slice();
        if (arr.length) arr[arr.length - 1] = candle;
        candlesRef.current = arr;
      } else {
        return;
      }

      if (activeToolsRef.current.size > 0) {
        const now = Date.now();
        // Recompute structure every ~2s while streaming (overlay still follows pan via redraw)
        if (now - lastStructureAtRef.current > 2000) {
          lastStructureAtRef.current = now;
          recomputeStructure();
        } else {
          redrawOverlay();
        }
      }
    },
    [recomputeStructure, redrawOverlay],
  );

  const toggleTool = (id: ChartToolId) => {
    setActiveTools((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    activeToolsRef.current = activeTools;
    recomputeStructure();
  }, [activeTools, recomputeStructure]);

  // Chart shell
  useLayoutEffect(() => {
    let disposed = false;
    let ro: ResizeObserver | null = null;
    let chart: IChartApi | null = null;
    const el = containerRef.current;
    if (!el) return;

    const init = async () => {
      await new Promise<void>((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r())),
      );
      if (disposed || !containerRef.current) return;
      const node = containerRef.current;
      node.innerHTML = "";

      chart = createChart(node, {
        width: Math.max(node.clientWidth || 0, 320),
        height: Math.max(node.clientHeight || 0, 420),
        layout: {
          background: { color: "#0b0b10" },
          textColor: "#6b6b80",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: "rgba(255,255,255,0.03)" },
          horzLines: { color: "rgba(255,255,255,0.03)" },
        },
        timeScale: {
          borderColor: "rgba(255,255,255,0.06)",
          timeVisible: true,
          secondsVisible: true,
          rightOffset: 4,
        },
        rightPriceScale: {
          borderColor: "rgba(255,255,255,0.06)",
          scaleMargins: { top: 0.08, bottom: 0.08 },
        },
        crosshair: {
          mode: 0,
          vertLine: {
            color: "rgba(76,163,255,0.35)",
            width: 1,
            style: 2,
            labelBackgroundColor: "#1a1a28",
          },
          horzLine: {
            color: "rgba(76,163,255,0.35)",
            width: 1,
            style: 2,
            labelBackgroundColor: "#1a1a28",
          },
        },
      });

      const series = chart.addCandlestickSeries({
        upColor: "#0ecb81",
        downColor: "#f6465d",
        borderUpColor: "#0ecb81",
        borderDownColor: "#f6465d",
        wickUpColor: "#0ecb81",
        wickDownColor: "#f6465d",
        priceLineVisible: true,
        lastValueVisible: true,
      });

      chartRef.current = chart;
      seriesRef.current = series;

      const onRange = () => redrawOverlay();
      chart.timeScale().subscribeVisibleLogicalRangeChange(onRange);
      chart.subscribeCrosshairMove(onRange);

      ro = new ResizeObserver(() => {
        if (!chartRef.current || !containerRef.current) return;
        const n = containerRef.current;
        chartRef.current.resize(
          Math.max(n.clientWidth || 0, 320),
          Math.max(n.clientHeight || 0, 420),
        );
        redrawOverlay();
      });
      ro.observe(node);
      if (wrapRef.current) ro.observe(wrapRef.current);
    };

    void init();
    return () => {
      disposed = true;
      ro?.disconnect();
      try {
        chart?.remove();
      } catch {
        /* ignore */
      }
      chartRef.current = null;
      seriesRef.current = null;
      lastCandleRef.current = null;
      candlesRef.current = [];
    };
  }, [symbol, redrawOverlay]);

  // History load + 1Hz live stream
  useEffect(() => {
    let disposed = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let inFlight = false;

    const load = async () => {
      for (let i = 0; i < 40 && !seriesRef.current; i++) {
        await new Promise((r) => setTimeout(r, 40));
      }
      if (disposed || !seriesRef.current) return;
      setLoading(true);

      const base = (
        pythBase || symbol.replace(/^DB:/i, "").split("_")[0]
      ).toUpperCase();
      const quoteLooksUsd =
        !poolKey ||
        /_(USDC|USDT|USD|AUSD|DBUSDC|DBUSDT|WUSDC|WUSDT)$/i.test(poolKey);
      usePythRef.current = quoteLooksUsd;

      const feed = quoteLooksUsd ? await resolvePythFeed(base) : null;
      feedRef.current = feed;

      let candles: CandlestickData[] = [];
      let spot: number | null = null;
      let source: PriceSource = null;

      if (tf.pythResolution && feed) {
        candles = await fetchPythHistoryByFeed(
          feed.historySymbol,
          tf.pythResolution,
          tf.lookbackDays,
        );
      }

      spot = await fetchPythSpotByFeed(feed);
      if (spot == null || spot <= 0) {
        for (let i = 0; i < 12 && !deepbookPriceRef.current; i++) {
          await new Promise((r) => setTimeout(r, 150));
        }
        const db = deepbookPriceRef.current;
        if (db != null && db > 0) {
          spot = db;
          source = "deepbook";
        }
      } else {
        source = "pyth";
      }

      if (disposed || !seriesRef.current || spot == null) {
        if (!disposed) setLoading(false);
        return;
      }

      if (candles.length === 0) {
        candles = seedLiveBars(spot, tf.barSeconds, tf.seedBars);
      } else {
        const last = candles[candles.length - 1];
        candles[candles.length - 1] = {
          ...last,
          high: Math.max(last.high, spot),
          low: Math.min(last.low, spot),
          close: spot,
        };
      }

      const nowBar = alignBarTime(Math.floor(Date.now() / 1000), tf.barSeconds);
      const lastC = candles[candles.length - 1];
      if ((lastC.time as number) < (nowBar as number)) {
        candles.push({
          time: nowBar,
          open: lastC.close,
          high: Math.max(lastC.close, spot),
          low: Math.min(lastC.close, spot),
          close: spot,
        });
      }

      seriesRef.current.setData(candles);
      lastCandleRef.current = candles[candles.length - 1];
      setCandles(candles);
      chartRef.current?.applyOptions({
        timeScale: {
          timeVisible: true,
          secondsVisible: tf.barSeconds <= 60,
        },
      });
      chartRef.current?.timeScale().fitContent();
      onSpotChange(spot, source);
      setLoading(false);
      requestAnimationFrame(() => recomputeStructure());

      const tick = async () => {
        if (disposed || inFlight) return;
        inFlight = true;
        try {
          let live: number | null = null;
          let src: PriceSource = null;

          if (usePythRef.current && feedRef.current) {
            live = await fetchPythSpotByFeed(feedRef.current);
            if (live != null) src = "pyth";
          }

          if (live == null) {
            const db = deepbookPriceRef.current;
            if (db != null && db > 0) {
              live = db;
              src = "deepbook";
            }
          }

          if (live != null && !disposed) {
            pushTick(live);
            onSpotChange(live, src);
          }
        } finally {
          inFlight = false;
        }
      };

      void tick();
      pollTimer = setInterval(tick, 1000);
    };

    void load();
    return () => {
      disposed = true;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [
    symbol,
    timeframe,
    tf,
    poolKey,
    pythBase,
    onSpotChange,
    pushTick,
    setCandles,
    recomputeStructure,
  ]);

  useEffect(() => {
    if (deepbookPrice == null || deepbookPrice <= 0) return;
    if (!usePythRef.current || !feedRef.current) {
      pushTick(deepbookPrice);
      onSpotChange(deepbookPrice, "deepbook");
    }
  }, [deepbookPrice, pushTick, onSpotChange]);

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" />
      <svg
        ref={overlayRef}
        className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
      />

      {/* Structure tools */}
      <div className="absolute left-3 top-3 z-[2] flex flex-wrap items-center gap-1">
        {CHART_TOOLS.map((tool) => {
          const on = activeTools.has(tool.id);
          return (
            <button
              key={tool.id}
              type="button"
              title={tool.title}
              onClick={() => toggleTool(tool.id)}
              className={`rounded-md px-2 py-1 text-[11px] font-semibold tracking-wide transition-all ${
                on
                  ? "shadow-sm"
                  : "bg-black/45 text-[#8a8a9e] backdrop-blur-sm hover:bg-black/60 hover:text-white"
              }`}
              style={
                on
                  ? {
                      backgroundColor: `${tool.color}22`,
                      color: tool.color,
                      boxShadow: `inset 0 0 0 1px ${tool.color}88`,
                    }
                  : undefined
              }
            >
              {tool.label}
            </button>
          );
        })}
        {activeTools.size > 0 && (
          <button
            type="button"
            title="Clear tools"
            onClick={() => setActiveTools(new Set())}
            className="rounded-md bg-black/45 px-2 py-1 text-[11px] text-[#666] backdrop-blur-sm hover:text-white"
          >
            ✕
          </button>
        )}
      </div>

      {loading && (
        <div className="pointer-events-none absolute inset-0 z-[3] flex items-center justify-center bg-[#0b0b10]/70">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#4ca3ff]/30 border-t-[#4ca3ff]" />
        </div>
      )}
    </div>
  );
}

function formatDelta(prev: number | null, next: number | null): {
  text: string;
  up: boolean | null;
} {
  if (prev == null || next == null || prev <= 0) return { text: "", up: null };
  const pct = ((next - prev) / prev) * 100;
  if (Math.abs(pct) < 0.00005) return { text: "0.00%", up: null };
  const up = pct >= 0;
  return {
    text: `${up ? "+" : ""}${pct.toFixed(3)}%`,
    up,
  };
}

export function TradingChartsPage() {
  const { walletInfo, network: walletNetwork } = useWallet();
  const deepbookNetwork = getDefaultDeepBookNetwork(walletNetwork);

  const deepbookPools = useMemo(
    () => buildDeepBookPoolSymbols(deepbookNetwork),
    [deepbookNetwork],
  );
  const catalog = useMemo(
    () => [...MARKET_SYMBOLS, ...SUI_PYTH_FEEDS, ...deepbookPools],
    [deepbookPools],
  );

  const [currentSymbol, setCurrentSymbol] = useState(DEFAULT_SYMBOL);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isChartLoading, setIsChartLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<TimeframeId>("1m");
  const [watchlists, setWatchlists] = useState<Watchlist[]>(DEFAULT_WATCHLISTS);
  const [activeWatchlistId, setActiveWatchlistId] = useState("default");
  const [onchainMidPrice, setOnchainMidPrice] = useState<number | null>(null);
  const [chartSpot, setChartSpot] = useState<number | null>(null);
  const [priceSource, setPriceSource] = useState<PriceSource>(null);
  const [prevSpot, setPrevSpot] = useState<number | null>(null);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const [sidePanel, setSidePanel] = useState<"trade" | "agent" | "markets">(
    "agent",
  );
  const [tradeMarkers, setTradeMarkers] = useState<ChartTradeMarker[]>([]);

  const target = useMemo(
    () => resolveChartTarget(currentSymbol, deepbookNetwork, catalog),
    [currentSymbol, deepbookNetwork, catalog],
  );
  const isOnchain = target.mode === "onchain";
  const activeTf = TIMEFRAMES.find((t) => t.id === timeframe) || TIMEFRAMES[1];
  const delta = formatDelta(prevSpot, chartSpot);

  const chartMarket = useMemo(
    () =>
      (
        target.pythBase ||
        target.label.split("/")[0] ||
        "SUI"
      ).toUpperCase(),
    [target.pythBase, target.label],
  );

  // Poll agent trade markers for the open market
  useEffect(() => {
    if (!isOnchain) return;
    let cancelled = false;
    const pull = async () => {
      try {
        const res = await window.belugaAi?.tradingChartAnnotations?.({
          market: chartMarket,
        });
        if (cancelled || !res?.ok || !res.annotations) return;
        setTradeMarkers(
          res.annotations.map((a) => ({
            id: a.id,
            market: a.market,
            time: a.time,
            price: a.price,
            type: a.type,
            label: a.label,
          })),
        );
      } catch {
        /* ignore */
      }
    };
    void pull();
    const id = setInterval(pull, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isOnchain, chartMarket]);

  const spotRef = useRef<number | null>(null);

  const handleSpotChange = useCallback((spot: number | null, source: PriceSource) => {
    const prev = spotRef.current;
    if (spot != null && prev != null && spot !== prev) {
      setFlash(spot > prev ? "up" : "down");
      setPrevSpot(prev);
    } else if (spot != null && prev == null) {
      setPrevSpot(spot);
    }
    spotRef.current = spot;
    setChartSpot(spot);
    setPriceSource(source);
  }, []);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 400);
    return () => clearTimeout(t);
  }, [flash]);

  useEffect(() => {
    if (!isOnchain) setIsChartLoading(true);
  }, [target.tvSymbol, isOnchain, timeframe]);

  useEffect(() => {
    if (!isChartLoading || isOnchain) return;
    const t = setTimeout(() => setIsChartLoading(false), 5000);
    return () => clearTimeout(t);
  }, [isChartLoading, isOnchain]);

  // DeepBook mid — poll fast for live pool prices
  useEffect(() => {
    let cancelled = false;

    const fetchMid = async () => {
      if (!isOnchain) {
        setOnchainMidPrice(null);
        return;
      }
      let poolKey = target.poolKey;
      if (!poolKey && target.pythBase) {
        poolKey = resolveDeepBookPoolForCoin(
          deepbookNetwork,
          target.pythBase,
        )?.key;
      }
      if (!poolKey) {
        setOnchainMidPrice(null);
        return;
      }
      try {
        const price = await fetchDeepBookMidPriceReadonly(
          deepbookNetwork,
          poolKey,
          walletInfo?.address,
        );
        if (!cancelled) setOnchainMidPrice(price);
      } catch {
        if (!cancelled) setOnchainMidPrice(null);
      }
    };

    void fetchMid();
    const id = setInterval(fetchMid, isOnchain ? 3000 : 60000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [
    isOnchain,
    target.poolKey,
    target.pythBase,
    deepbookNetwork,
    walletInfo?.address,
  ]);

  useEffect(() => {
    try {
      const savedLists = localStorage.getItem(STORAGE.WATCHLISTS);
      if (savedLists) setWatchlists(JSON.parse(savedLists));
      const savedActive = localStorage.getItem(STORAGE.ACTIVE);
      if (savedActive) setActiveWatchlistId(savedActive);
      const savedSymbol = localStorage.getItem(STORAGE.LAST_SYMBOL);
      if (savedSymbol) setCurrentSymbol(savedSymbol);
      const savedTf = localStorage.getItem(STORAGE.TIMEFRAME) as TimeframeId | null;
      if (savedTf && TIMEFRAMES.some((t) => t.id === savedTf)) setTimeframe(savedTf);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE.WATCHLISTS, JSON.stringify(watchlists));
  }, [watchlists]);
  useEffect(() => {
    localStorage.setItem(STORAGE.ACTIVE, activeWatchlistId);
  }, [activeWatchlistId]);
  useEffect(() => {
    localStorage.setItem(STORAGE.LAST_SYMBOL, currentSymbol);
  }, [currentSymbol]);
  useEffect(() => {
    localStorage.setItem(STORAGE.TIMEFRAME, timeframe);
  }, [timeframe]);

  const activeWatchlist =
    watchlists.find((w) => w.id === activeWatchlistId) || watchlists[0];
  const chips = activeWatchlist?.symbols || [];

  const loadSymbol = (symbol: string) => {
    const resolved = resolveChartTarget(symbol, deepbookNetwork, catalog);
    setCurrentSymbol(resolved.symbol);
    setSearchQuery("");
    setShowSuggestions(false);
    spotRef.current = null;
    setChartSpot(null);
    setPrevSpot(null);
    setPriceSource(null);
  };

  const groupedSuggestions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let items = catalog;
    if (q) {
      items = catalog.filter(
        (s) =>
          s.label.toLowerCase().includes(q) ||
          s.symbol.toLowerCase().includes(q) ||
          s.poolKey?.toLowerCase().includes(q) ||
          s.pythBase?.toLowerCase().includes(q),
      );
    }
    const groups: Record<string, SymbolItem[]> = {
      Markets: [],
      Tokens: [],
      Pools: [],
    };
    items.forEach((item) => {
      if (item.category === "deepbook") groups.Pools.push(item);
      else if (item.isOnchain) groups.Tokens.push(item);
      else groups.Markets.push(item);
    });
    if (!q && groups.Pools.length > 20) groups.Pools = groups.Pools.slice(0, 20);
    return groups;
  }, [searchQuery, catalog]);

  const addToWatchlist = (symbol: string) => {
    setWatchlists((prev) =>
      prev.map((wl) =>
        wl.id === activeWatchlistId
          ? {
              ...wl,
              symbols: wl.symbols.includes(symbol)
                ? wl.symbols
                : [...wl.symbols, symbol],
            }
          : wl,
      ),
    );
  };

  const removeFromWatchlist = (symbol: string) => {
    setWatchlists((prev) =>
      prev.map((wl) =>
        wl.id === activeWatchlistId
          ? { ...wl, symbols: wl.symbols.filter((s) => s !== symbol) }
          : wl,
      ),
    );
  };

  const priceColor =
    flash === "up"
      ? "text-[#0ecb81]"
      : flash === "down"
        ? "text-[#f6465d]"
        : delta.up === true
          ? "text-[#0ecb81]"
          : delta.up === false
            ? "text-[#f6465d]"
            : "text-[#f4f4fa]";

  return (
    <div className="flex h-full flex-col bg-[#0b0b10] text-[#e8e8f0]">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] px-4 py-2.5">
        <div className="relative min-w-[200px] flex-1 max-w-md">
          <input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 140)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && searchQuery.trim()) {
                loadSymbol(searchQuery.trim());
              }
              if (e.key === "Escape") setShowSuggestions(false);
            }}
            placeholder="Search or paste pool / ticker…"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[13px] text-[#f0f0f5] placeholder:text-[#55556a] outline-none focus:border-[#4ca3ff]/50"
          />
          {showSuggestions && (
            <div className="absolute z-50 mt-1 max-h-[380px] w-full overflow-auto rounded-xl border border-white/[0.08] bg-[#12121a] py-1 shadow-2xl">
              {Object.entries(groupedSuggestions).map(([name, items]) =>
                items.length ? (
                  <div key={name}>
                    <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#4a4a5c]">
                      {name}
                    </div>
                    {items.map((item) => (
                      <button
                        key={item.symbol}
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-white/[0.04]"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => loadSymbol(item.symbol)}
                      >
                        <span className="font-medium">{item.label}</span>
                        <span className="font-mono text-[10px] text-[#55556a]">
                          {item.symbol}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null,
              )}
              {searchQuery.trim() && (
                <button
                  type="button"
                  className="w-full border-t border-white/[0.06] px-3 py-2 text-left text-xs text-[#4ca3ff] hover:bg-white/[0.03]"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => loadSymbol(searchQuery.trim())}
                >
                  Open {searchQuery.trim()}
                </button>
              )}
            </div>
          )}
        </div>

        <select
          value={activeWatchlistId}
          onChange={(e) => setActiveWatchlistId(e.target.value)}
          className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-xs text-[#c8c8d8]"
        >
          {watchlists.map((wl) => (
            <option key={wl.id} value={wl.id}>
              {wl.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => addToWatchlist(target.symbol)}
          className="rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-xs text-[#4ca3ff] hover:bg-[#4ca3ff]/10"
        >
          + Watch
        </button>
      </div>

      {/* Watch chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-white/[0.04] px-4 py-2">
          {chips.map((sym) => {
            const active = target.symbol === sym || currentSymbol === sym;
            return (
              <button
                key={sym}
                type="button"
                onClick={() => loadSymbol(sym)}
                className={`group flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[11px] transition-colors ${
                  active
                    ? "bg-[#4ca3ff]/15 text-[#4ca3ff]"
                    : "bg-white/[0.03] text-[#8a8a9e] hover:bg-white/[0.06] hover:text-[#d0d0e0]"
                }`}
              >
                {sym.replace(/^DB:/, "")}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFromWatchlist(sym);
                  }}
                  className="ml-0.5 hidden text-[#555] group-hover:inline hover:text-[#f6465d]"
                >
                  ×
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Chart column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Symbol header */}
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-2">
            <div className="flex min-w-0 items-baseline gap-3">
              <span className="truncate text-base font-semibold tracking-tight text-white">
                {target.label}
              </span>
              {isOnchain && chartSpot != null && (
                <>
                  <span
                    className={`font-mono text-xl font-semibold tabular-nums transition-colors duration-300 ${priceColor}`}
                  >
                    {formatPrice(chartSpot)}
                  </span>
                  {delta.text && (
                    <span
                      className={`font-mono text-xs tabular-nums ${
                        delta.up === true
                          ? "text-[#0ecb81]"
                          : delta.up === false
                            ? "text-[#f6465d]"
                            : "text-[#666]"
                      }`}
                    >
                      {delta.text}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-[#4a4a5c]">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        priceSource
                          ? "animate-pulse bg-[#0ecb81]"
                          : "bg-[#444]"
                      }`}
                    />
                    live
                  </span>
                </>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-0.5 rounded-lg bg-white/[0.03] p-0.5">
              {TIMEFRAMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTimeframe(t.id)}
                  className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                    timeframe === t.id
                      ? "bg-[#4ca3ff] text-white shadow-sm"
                      : "text-[#7a7a90] hover:text-white"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative min-h-0 flex-1 bg-[#0b0b10]">
            {isOnchain ? (
              <OnchainChart
                key={target.symbol}
                symbol={target.symbol}
                timeframe={timeframe}
                poolKey={target.poolKey ?? null}
                pythBase={target.pythBase ?? null}
                deepbookPrice={onchainMidPrice}
                onSpotChange={handleSpotChange}
                tradeMarkers={tradeMarkers}
              />
            ) : (
              <>
                <iframe
                  key={`${target.tvSymbol}-${activeTf.tvInterval}`}
                  src={`https://s.tradingview.com/embed-widget/advanced-chart/?symbol=${encodeURIComponent(
                    target.tvSymbol || target.symbol,
                  )}&interval=${encodeURIComponent(
                    activeTf.tvInterval,
                  )}&theme=dark&style=1&locale=en&hide_top_toolbar=0&hide_legend=0&save_image=0&withdateranges=1`}
                  className="h-full w-full border-0"
                  title={target.tvSymbol}
                  allowFullScreen
                  onLoad={() => setIsChartLoading(false)}
                  onError={() => setIsChartLoading(false)}
                />
                {isChartLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#0b0b10]/80">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#4ca3ff]/30 border-t-[#4ca3ff]" />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Trade + markets rail */}
        <aside className="hidden w-[300px] shrink-0 flex-col border-l border-white/[0.06] bg-[#0a0a0e] sm:flex">
          <div className="flex gap-0.5 border-b border-white/[0.06] p-1.5">
            {(
              [
                ["agent", "Agent"],
                ["trade", "Trade"],
                ["markets", "Markets"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setSidePanel(id)}
                className={`flex-1 rounded-md py-1.5 text-[11px] font-semibold ${
                  sidePanel === id
                    ? "bg-[#4ca3ff]/15 text-[#4ca3ff]"
                    : "text-[#6b6b80] hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {sidePanel === "agent" ? (
            <div className="min-h-0 flex-1">
              <TradingAgentPanel
                market={(
                  target.pythBase ||
                  target.label.split("/")[0] ||
                  "SUI"
                ).toUpperCase()}
                timeframe={timeframe}
                onPreferTimeframe={(tf) => {
                  if (TIMEFRAMES.some((t) => t.id === tf)) {
                    setTimeframe(tf as TimeframeId);
                  }
                }}
              />
            </div>
          ) : sidePanel === "trade" ? (
            <div className="min-h-0 flex-1">
              <TradingTradePanel
                preferredMarket={
                  target.pythBase ||
                  target.label.split("/")[0] ||
                  (isOnchain ? currentSymbol : null)
                }
              />
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="border-b border-white/[0.04] px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#4a4a5c]">
                Tokens
              </div>
              <div className="max-h-[40%] overflow-auto">
                {SUI_PYTH_FEEDS.map((t) => (
                  <div
                    key={t.symbol}
                    className={`flex w-full items-center justify-between px-3 py-1.5 text-[13px] transition-colors ${
                      target.symbol === t.symbol
                        ? "bg-[#4ca3ff]/10 text-[#4ca3ff]"
                        : "text-[#b0b0c4] hover:bg-white/[0.03]"
                    }`}
                  >
                    <button
                      type="button"
                      className="flex-1 text-left"
                      onClick={() => loadSymbol(t.symbol)}
                    >
                      {t.label}
                    </button>
                    <button
                      type="button"
                      className="px-1 text-[11px] text-[#4a4a5c] hover:text-[#4ca3ff]"
                      onClick={() => addToWatchlist(t.symbol)}
                    >
                      +
                    </button>
                  </div>
                ))}
              </div>

              <div className="border-b border-t border-white/[0.04] px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#4a4a5c]">
                DeepBook
              </div>
              <div className="flex-1 overflow-auto">
                {deepbookPools.map((p) => (
                  <div
                    key={p.symbol}
                    className={`flex w-full items-center justify-between px-3 py-1.5 font-mono text-[11px] transition-colors ${
                      target.symbol === p.symbol
                        ? "bg-[#6c63ff]/12 text-[#a8a0ff]"
                        : "text-[#8a8a9e] hover:bg-white/[0.03] hover:text-[#c8c8d8]"
                    }`}
                  >
                    <button
                      type="button"
                      className="flex-1 text-left"
                      onClick={() => loadSymbol(p.symbol)}
                    >
                      {p.label}
                    </button>
                    <button
                      type="button"
                      className="px-1 text-[11px] text-[#4a4a5c] hover:text-[#4ca3ff]"
                      onClick={() => addToWatchlist(p.symbol)}
                    >
                      +
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
