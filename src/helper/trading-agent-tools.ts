/**
 * Tools for the autonomous chart trading agent (T2000 + Pyth analysis + Walrus memory).
 */
import type { BelugaToolDefinition } from "./beluga-tool-catalog";
import { getAgent } from "../main/agent";
import {
  analyzeStructure,
  type StructureCandle,
} from "./trading-structure-analyze";
import {
  remember as walrusRemember,
  recall as walrusRecall,
  type WalrusCredentials,
} from "./walrus-memory";
import {
  enqueuePendingOnchain,
  flushPendingToWalrus,
  isWalrusUploadPausedError,
  localNoteCount,
  localRecall,
  pendingOnchainCount,
} from "./strategy-local-memory";
import {
  assessHeadlineImpact,
  getMarketFeedSnapshot,
} from "./trading-news-feeds";

export type DemoTradeRecord = {
  id: string;
  ts: number;
  action: "long" | "short" | "swap" | "close";
  market: string;
  fromAsset: string;
  toAsset: string;
  amountIn: number;
  amountOut: number;
  price: number;
  note?: string;
};

export type DemoAccount = {
  balances: Record<string, number>;
  startingSui: number;
  startingSpotUsd: number;
  startingEquityUsd: number;
  startedAt: number;
  trades: DemoTradeRecord[];
};

export type SessionMemoryCred = {
  entryId: string;
  label: string;
  accountId: string;
  delegateKey: string;
  network: "mainnet" | "testnet";
  namespace: string;
};

/** Drawn on the lightweight-charts candle chart (entries, closes, swaps, SL/TP). */
export type ChartTradeAnnotation = {
  id: string;
  sessionId: string;
  market: string;
  /** unix seconds — aligned for candle series markers */
  time: number;
  price: number;
  type: "long" | "short" | "swap" | "sl" | "tp" | "close_long" | "close_short";
  label: string;
  parentId?: string;
  createdAt: number;
};

type OpenChartPosition = {
  id: string;
  market: string;
  side: "long" | "short";
  entryPrice: number;
  openedAt: number;
};

export type TradingSessionState = {
  plan: string;
  thoughts: string[];
  stopped: boolean;
  nextTickSeconds: number | null;
  lastAction: string | null;
  /** Simulated account — real prices, no chain txs */
  demoMode: boolean;
  demo: DemoAccount | null;
  /** Walrus memories linked to the active strategy */
  memory: SessionMemoryCred[];
  strategyId: string | null;
  stopLossPct: number;
  takeProfitPct: number;
  chartAnnotations: ChartTradeAnnotation[];
  /** Track open long/short so we can mark closes on the chart */
  openPositions: OpenChartPosition[];
};

const sessions = new Map<string, TradingSessionState>();

export function getOrCreateSession(sessionId: string): TradingSessionState {
  let s = sessions.get(sessionId);
  if (!s) {
    s = {
      plan: "",
      thoughts: [],
      stopped: false,
      nextTickSeconds: null,
      lastAction: null,
      demoMode: false,
      demo: null,
      memory: [],
      strategyId: null,
      stopLossPct: 0.4,
      takeProfitPct: 0.6,
      chartAnnotations: [],
      openPositions: [],
    };
    sessions.set(sessionId, s);
  }
  if (!s.openPositions) s.openPositions = [];
  return s;
}

export function setSessionRisk(
  sessionId: string,
  stopLossPct?: number,
  takeProfitPct?: number,
) {
  const s = getOrCreateSession(sessionId);
  if (typeof stopLossPct === "number" && stopLossPct > 0) {
    s.stopLossPct = stopLossPct;
  }
  if (typeof takeProfitPct === "number" && takeProfitPct > 0) {
    s.takeProfitPct = takeProfitPct;
  }
}

function annId() {
  return `ann-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function pushAnnotations(
  s: TradingSessionState,
  created: ChartTradeAnnotation[],
) {
  s.chartAnnotations.push(...created);
  if (s.chartAnnotations.length > 160) {
    s.chartAnnotations = s.chartAnnotations.slice(-160);
  }
}

function removeRiskLinesForParent(s: TradingSessionState, parentId: string) {
  s.chartAnnotations = s.chartAnnotations.filter(
    (a) =>
      !(a.parentId === parentId && (a.type === "sl" || a.type === "tp")),
  );
}

function recordClose(
  sessionId: string,
  params: {
    market: string;
    price: number;
    closedSide: "long" | "short";
    parentId: string;
    entryPrice: number;
  },
): ChartTradeAnnotation {
  const s = getOrCreateSession(sessionId);
  const price = params.price;
  const entry = params.entryPrice;
  const pnlPct =
    params.closedSide === "long"
      ? ((price - entry) / entry) * 100
      : ((entry - price) / entry) * 100;
  const sign = pnlPct >= 0 ? "+" : "";
  const type =
    params.closedSide === "long" ? "close_long" : "close_short";
  const ann: ChartTradeAnnotation = {
    id: annId(),
    sessionId,
    market: params.market.toUpperCase(),
    time: Math.floor(Date.now() / 1000),
    price,
    type,
    label: `CLOSE ${params.closedSide.toUpperCase()} ${sign}${pnlPct.toFixed(2)}%`,
    parentId: params.parentId,
    createdAt: Date.now(),
  };
  removeRiskLinesForParent(s, params.parentId);
  pushAnnotations(s, [ann]);
  s.openPositions = s.openPositions.filter((p) => p.id !== params.parentId);
  return ann;
}

/**
 * Record open/close on the chart.
 * Opposite-side trade closes the open position first (with CLOSE marker + PnL%).
 */
function recordEntryWithRisk(
  sessionId: string,
  params: {
    market: string;
    price: number;
    side: "long" | "short";
    label?: string;
  },
): ChartTradeAnnotation[] {
  const s = getOrCreateSession(sessionId);
  const time = Math.floor(Date.now() / 1000);
  const price = params.price;
  if (!(price > 0)) return [];

  const market = params.market.toUpperCase();
  const created: ChartTradeAnnotation[] = [];

  // Close opposite open position if any
  const open = s.openPositions.find((p) => p.market === market);
  if (open && open.side !== params.side) {
    created.push(
      recordClose(sessionId, {
        market,
        price,
        closedSide: open.side,
        parentId: open.id,
        entryPrice: open.entryPrice,
      }),
    );
  }

  // Same side already open: still mark a new entry (scale-in) without closing
  const entryId = annId();
  const slPct = s.stopLossPct || 0.4;
  const tpPct = s.takeProfitPct || 0.6;

  const entry: ChartTradeAnnotation = {
    id: entryId,
    sessionId,
    market,
    time,
    price,
    type: params.side,
    label:
      params.label ||
      (params.side === "long"
        ? `LONG @ ${price.toPrecision(6)}`
        : `SHORT @ ${price.toPrecision(6)}`),
    createdAt: Date.now(),
  };
  created.push(entry);

  const slPrice =
    params.side === "long"
      ? price * (1 - slPct / 100)
      : price * (1 + slPct / 100);
  const tpPrice =
    params.side === "long"
      ? price * (1 + tpPct / 100)
      : price * (1 - tpPct / 100);

  created.push({
    id: annId(),
    sessionId,
    market,
    time,
    price: slPrice,
    type: "sl",
    label: `SL ${slPct}%`,
    parentId: entryId,
    createdAt: Date.now(),
  });
  created.push({
    id: annId(),
    sessionId,
    market,
    time,
    price: tpPrice,
    type: "tp",
    label: `TP ${tpPct}%`,
    parentId: entryId,
    createdAt: Date.now(),
  });

  // Replace open position tracker for this market with latest entry
  s.openPositions = s.openPositions.filter((p) => p.market !== market);
  s.openPositions.push({
    id: entryId,
    market,
    side: params.side,
    entryPrice: price,
    openedAt: Date.now(),
  });

  // Avoid double-push of close (already pushed in recordClose)
  const onlyNew = created.filter(
    (c) => c.type !== "close_long" && c.type !== "close_short",
  );
  // closes already in chartAnnotations via recordClose; push entry+sl+tp
  pushAnnotations(s, onlyNew);
  return created;
}

/**
 * Swap handling: USDC→asset ≈ long / close short; asset→USDC ≈ short / close long.
 */
function recordSwapAnnotation(
  sessionId: string,
  params: {
    market: string;
    price: number;
    label: string;
    from: string;
    to: string;
  },
): ChartTradeAnnotation[] {
  if (!(params.price > 0)) return [];
  const from = params.from.toUpperCase();
  const to = params.to.toUpperCase();
  const isStable = (a: string) =>
    a === "USDC" || a === "USDT" || a === "USDSUI" || a === "USD";

  // Directional intent from swap legs
  if (isStable(from) && !isStable(to)) {
    return recordEntryWithRisk(sessionId, {
      market: to,
      price: params.price,
      side: "long",
      label: params.label || `SWAP ${from}→${to}`,
    });
  }
  if (!isStable(from) && isStable(to)) {
    return recordEntryWithRisk(sessionId, {
      market: from,
      price: params.price,
      side: "short",
      label: params.label || `SWAP ${from}→${to}`,
    });
  }

  // Non-directional / exotic: plain swap marker
  const s = getOrCreateSession(sessionId);
  const ann: ChartTradeAnnotation = {
    id: annId(),
    sessionId,
    market: params.market.toUpperCase(),
    time: Math.floor(Date.now() / 1000),
    price: params.price,
    type: "swap",
    label: params.label,
    createdAt: Date.now(),
  };
  pushAnnotations(s, [ann]);
  return [ann];
}

/** All sessions' chart markers for a market (for the live chart UI). */
export function getChartAnnotationsForMarket(
  market: string,
): ChartTradeAnnotation[] {
  const m = market.toUpperCase().replace(/^DB:/, "").split("_")[0];
  const out: ChartTradeAnnotation[] = [];
  for (const s of sessions.values()) {
    for (const a of s.chartAnnotations) {
      if (a.market === m || a.market.includes(m) || m.includes(a.market)) {
        out.push(a);
      }
    }
  }
  return out.sort((a, b) => a.time - b.time || a.createdAt - b.createdAt);
}

export function setSessionMemory(
  sessionId: string,
  memory: SessionMemoryCred[],
  strategyId?: string | null,
) {
  const s = getOrCreateSession(sessionId);
  s.memory = memory;
  if (strategyId !== undefined) s.strategyId = strategyId;
}

function primaryMemory(session: TradingSessionState): SessionMemoryCred | null {
  return session.memory[0] ?? null;
}

function toWalrusCreds(m: SessionMemoryCred): WalrusCredentials {
  // Never fall back to "default" — strategy agent notes must stay isolated.
  const ns =
    m.namespace && m.namespace !== "default"
      ? m.namespace
      : `strategy-${m.entryId || "agent"}`.slice(0, 64);
  return {
    accountId: m.accountId,
    delegateKey: m.delegateKey,
    network: m.network,
    namespace: ns,
  };
}

type RememberResultMeta = {
  ok: boolean;
  error?: string;
  blob_id?: string;
  storage?: "walrus" | "pending_onchain";
  walrusPaused?: boolean;
  flush?: { uploaded: number; remaining: number };
};

/**
 * Always target Walrus on-chain first. If upload is paused/fails, queue for
 * flushPendingToWalrus so notes go on-chain as soon as the service accepts.
 */
async function rememberWithFallback(
  mem: SessionMemoryCred,
  stamped: string,
  kind?: string,
): Promise<RememberResultMeta> {
  const creds = toWalrusCreds(mem);
  creds.accountId = creds.accountId.trim();
  creds.delegateKey = creds.delegateKey.trim();

  // Drain any older pending notes first (same namespace)
  const flush = await flushPendingToWalrus({
    namespace: creds.namespace,
    maxBatch: 5,
  });

  try {
    const result = await walrusRemember(creds, stamped);
    return {
      ok: true,
      blob_id: result.blob_id,
      storage: "walrus",
      flush: { uploaded: flush.uploaded, remaining: flush.remaining },
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const paused = isWalrusUploadPausedError(err);
    const note = enqueuePendingOnchain({
      namespace: creds.namespace || mem.namespace,
      accountId: creds.accountId,
      network: creds.network || mem.network,
      delegateKey: creds.delegateKey,
      text: stamped,
      kind,
    });
    console.warn(
      "[trading-agent] Walrus remember failed; queued for on-chain flush:",
      error,
    );
    return {
      ok: true,
      blob_id: note.id,
      storage: "pending_onchain",
      walrusPaused: paused,
      error: paused
        ? "Walrus uploads paused (security upgrade). Note queued and will auto-upload on-chain when the relayer accepts again."
        : `Walrus upload failed (${error}). Note queued for on-chain retry.`,
      flush: {
        uploaded: flush.uploaded,
        remaining: pendingOnchainCount(creds.namespace),
      },
    };
  }
}

/** Best-effort auto-save so fills are remembered even if the LLM skips trade_remember. */
async function autoRememberTrade(
  session: TradingSessionState,
  kind: string,
  text: string,
): Promise<RememberResultMeta> {
  const mem = primaryMemory(session);
  if (!mem) return { ok: false, error: "no_memory_linked" };
  const stamped = [
    `[strategy-agent][${kind}]`,
    session.strategyId ? `strategy=${session.strategyId}` : "",
    session.demoMode ? "mode=demo" : "mode=live",
    new Date().toISOString(),
    text,
  ]
    .filter(Boolean)
    .join("\n");
  return rememberWithFallback(mem, stamped, kind);
}

export function clearTradingSession(sessionId: string) {
  sessions.delete(sessionId);
}

/** Start / reset a virtual 100 SUI (default) account at current Pyth spot. */
export async function startDemoAccount(
  sessionId: string,
  initialSui = 100,
): Promise<DemoAccount> {
  const session = getOrCreateSession(sessionId);
  const feed = await resolveFeed("SUI");
  const spot = feed ? (await fetchSpot(feed.priceId)) ?? 0 : 0;
  const demo: DemoAccount = {
    balances: { SUI: initialSui, USDC: 0 },
    startingSui: initialSui,
    startingSpotUsd: spot,
    startingEquityUsd: initialSui * (spot || 0),
    startedAt: Date.now(),
    trades: [],
  };
  session.demoMode = true;
  session.demo = demo;
  session.stopped = false;
  session.nextTickSeconds = null;
  session.plan = "";
  session.lastAction = null;
  session.thoughts = [];
  session.chartAnnotations = [];
  session.openPositions = [];
  // keep memory links across demo restarts on same sessionId
  return demo;
}

export async function getDemoSnapshot(sessionId: string) {
  const session = getOrCreateSession(sessionId);
  if (!session.demo) return null;
  return markDemoToMarket(session.demo);
}

export async function buildDemoSummary(sessionId: string) {
  const session = getOrCreateSession(sessionId);
  const demo = session.demo;
  if (!demo) {
    return {
      ok: false as const,
      error: "No demo account on this session",
    };
  }
  const marked = await markDemoToMarket(demo);
  const durationMs = Date.now() - demo.startedAt;
  const durationMin = Math.round(durationMs / 60000);
  const pnl = marked.equityUsd - demo.startingEquityUsd;
  const pnlPct =
    demo.startingEquityUsd > 0 ? (pnl / demo.startingEquityUsd) * 100 : 0;

  const wins = demo.trades.filter((t) => t.action === "long" || t.action === "short");
  // Simple: count profitable swap legs by comparing sequential equity is hard;
  // report trade count and long vs short count.
  const longCount = demo.trades.filter((t) => t.action === "long").length;
  const shortCount = demo.trades.filter((t) => t.action === "short").length;
  const swapCount = demo.trades.filter((t) => t.action === "swap").length;

  return {
    ok: true as const,
    summary: {
      durationMin,
      durationMs,
      startingSui: demo.startingSui,
      startingSpotUsd: demo.startingSpotUsd,
      startingEquityUsd: demo.startingEquityUsd,
      endingBalances: { ...demo.balances },
      endingEquityUsd: marked.equityUsd,
      pnlUsd: Number(pnl.toFixed(4)),
      pnlPct: Number(pnlPct.toFixed(3)),
      tradeCount: demo.trades.length,
      longCount,
      shortCount,
      swapCount,
      trades: demo.trades,
      marks: marked.marks,
    },
  };
}

async function markDemoToMarket(demo: DemoAccount) {
  const marks: Record<string, number> = { USDC: 1 };
  let equityUsd = 0;
  for (const [asset, qty] of Object.entries(demo.balances)) {
    if (qty === 0) continue;
    if (asset === "USDC" || asset === "USDsui" || asset === "USDT") {
      marks[asset] = 1;
      equityUsd += qty;
      continue;
    }
    const feed = await resolveFeed(asset);
    const spot = feed ? await fetchSpot(feed.priceId) : null;
    marks[asset] = spot ?? 0;
    equityUsd += qty * (spot ?? 0);
  }
  return { equityUsd: Number(equityUsd.toFixed(4)), marks, balances: { ...demo.balances } };
}

export const TRADING_AGENT_TOOLS: BelugaToolDefinition[] = [
  {
    name: "trade_think",
    description:
      "Record your reasoning / thought process for the user-visible agent log. Call this frequently before acting.",
    inputSchema: {
      type: "object",
      required: ["thought"],
      properties: {
        thought: {
          type: "string",
          description: "Clear explanation of what you observe and why",
        },
      },
    },
  },
  {
    name: "trade_remember",
    description:
      "Save a lasting observation to the strategy's linked Walrus Memory (improvements, mistakes, what happened, lessons). Call after trades, failed setups, demo end, or meaningful insights. Requires memory linked to the strategy.",
    inputSchema: {
      type: "object",
      required: ["text"],
      properties: {
        text: {
          type: "string",
          description:
            "What to remember — structured note: context, action, result, lesson",
        },
        kind: {
          type: "string",
          enum: [
            "observation",
            "improvement",
            "mistake",
            "outcome",
            "setup",
            "risk",
          ],
          description: "Category tag for the note",
        },
      },
    },
  },
  {
    name: "trade_recall",
    description:
      "Semantic search in the strategy's linked Walrus Memory for past notes (lessons, mistakes, similar setups). Call at session start and before major decisions.",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: {
          type: "string",
          description: "Natural language query, e.g. 'failed long scalps SUI'",
        },
        limit: {
          type: "number",
          description: "Max results (default 5)",
        },
      },
    },
  },
  {
    name: "trade_update_plan",
    description:
      "Update your multi-step plan that persists across autonomous ticks. Use for forward planning.",
    inputSchema: {
      type: "object",
      required: ["plan"],
      properties: {
        plan: {
          type: "string",
          description: "Bullet plan: goals, conditions, next checks, risk limits",
        },
      },
    },
  },
  {
    name: "trade_analyze_market",
    description:
      "Fetch recent OHLCV from Pyth benchmarks + structure signals (OB, FVG, BOS, swings).",
    inputSchema: {
      type: "object",
      required: ["market"],
      properties: {
        market: { type: "string", description: "e.g. SUI, WAL, DEEP" },
        timeframe: {
          type: "string",
          description: "1m,5m,15m,1h,4h,1D (default 1h)",
        },
      },
    },
  },
  {
    name: "trade_get_price",
    description: "Latest Pyth Hermes spot for a crypto market vs USD.",
    inputSchema: {
      type: "object",
      required: ["market"],
      properties: {
        market: { type: "string" },
      },
    },
  },
  {
    name: "trade_get_quote",
    description:
      "Swap quote. DEMO: Pyth spot ± fee. LIVE: Cetus via T2000.",
    inputSchema: {
      type: "object",
      required: ["from", "to", "amount"],
      properties: {
        from: { type: "string" },
        to: { type: "string" },
        amount: { type: "number" },
      },
    },
  },
  {
    name: "trade_get_demo_account",
    description:
      "DEMO only: virtual balances, mark-to-market equity, trade history. Call after fills.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "trade_open_long",
    description:
      "Open long: spend USDC to buy market. DEMO simulates fill at live Pyth price. LIVE uses T2000/NAVI.",
    inputSchema: {
      type: "object",
      required: ["market", "amount"],
      properties: {
        market: { type: "string" },
        amount: { type: "number", description: "USDC to spend at 1x" },
        leverage: { type: "number", description: "1–5, default 1 (demo ignores >1)" },
        slippage: { type: "number", description: "percent, default 0.3 demo / 1 live" },
      },
    },
  },
  {
    name: "trade_open_short",
    description:
      "Open short: sell market for USDC. DEMO: sells from virtual balance at live price. LIVE: T2000/NAVI.",
    inputSchema: {
      type: "object",
      required: ["market", "amount"],
      properties: {
        market: { type: "string" },
        amount: { type: "number", description: "Market size to sell at 1x" },
        leverage: { type: "number" },
        slippage: { type: "number" },
      },
    },
  },
  {
    name: "trade_swap",
    description: "Swap assets. DEMO virtual; LIVE Cetus via T2000.",
    inputSchema: {
      type: "object",
      required: ["from", "to", "amount"],
      properties: {
        from: { type: "string" },
        to: { type: "string" },
        amount: { type: "number" },
        slippage: { type: "number" },
      },
    },
  },
  {
    name: "trade_get_positions",
    description:
      "DEMO: virtual balances/equity. LIVE: NAVI save/borrow + health.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "trade_deposit_collateral",
    description: "Deposit USDC into NAVI as collateral for leverage.",
    inputSchema: {
      type: "object",
      required: ["amount"],
      properties: {
        amount: { type: "number" },
      },
    },
  },
  {
    name: "trade_repay",
    description: "Repay NAVI debt for an asset (or amount 'all').",
    inputSchema: {
      type: "object",
      required: ["asset"],
      properties: {
        asset: { type: "string" },
        amount: {
          description: "Number or 'all'",
        },
      },
    },
  },
  {
    name: "trade_schedule_next",
    description:
      "Self-schedule the next autonomous agent tick in N seconds (15–900). Call at end of tick if you want to continue.",
    inputSchema: {
      type: "object",
      required: ["seconds", "reason"],
      properties: {
        seconds: { type: "number" },
        reason: { type: "string" },
      },
    },
  },
  {
    name: "trade_stop",
    description: "Stop the autonomous agent loop.",
    inputSchema: {
      type: "object",
      properties: {
        reason: { type: "string" },
      },
    },
  },
  {
    name: "market_get_news",
    description:
      "Pull latest crypto news (CoinDesk, Cointelegraph, Decrypt, The Block) with impact hints and related assets.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max headlines (default 20)" },
      },
    },
  },
  {
    name: "market_get_calendar",
    description:
      "Economic calendar (Forex Factory style): FOMC, CPI, NFP, etc. with minutesUntil and crypto market impact hints.",
    inputSchema: {
      type: "object",
      properties: {
        hours: {
          type: "number",
          description: "Lookahead window in hours (default 72)",
        },
        highImpactOnly: { type: "boolean" },
      },
    },
  },
  {
    name: "market_assess_headline",
    description:
      "Assess a news headline for likely market impact, assets touched, and trading notes. Pass body + assetHint when available for better scores.",
    inputSchema: {
      type: "object",
      required: ["headline"],
      properties: {
        headline: { type: "string" },
        body: { type: "string", description: "Optional article body / context" },
        assetHint: {
          type: "string",
          description: "Focus asset e.g. SUI, BTC, ETH",
        },
      },
    },
  },
];

const PYTH_STATIC: Record<string, { priceId: string; history: string }> = {
  SUI: {
    priceId: "0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744",
    history: "Crypto.SUI/USD",
  },
  CETUS: {
    priceId: "0xe5b274b2611143df055d6e7cd8d93fe1961716bcd4dca1cad87a83bc1e78c1ef",
    history: "Crypto.CETUS/USD",
  },
  DEEP: {
    priceId: "0x29bdd5248234e33bd93d3b81100b5fa32eaa5997843847e2c2cb16d7c6d9f7ff",
    history: "Crypto.DEEP/USD",
  },
  WAL: {
    priceId: "0xeba0732395fae9dec4bae12e52760b35fc1c5671e2da8b449c9af4efe5d54341",
    history: "Crypto.WAL/USD",
  },
  IKA: {
    priceId: "0x2b529621fa6e2c8429f623ba705572aa64175d7768365ef829df6a12c9f365f4",
    history: "Crypto.IKA/USD",
  },
  NAVX: {
    priceId: "0x88250f854c019ef4f88a5c073d52a18bb1c6ac437033f5932cd017d24917ab46",
    history: "Crypto.NAVX/USD",
  },
};

const TF_RES: Record<string, { res: string; days: number }> = {
  "1m": { res: "1", days: 1 },
  "5m": { res: "5", days: 2 },
  "15m": { res: "15", days: 3 },
  "1h": { res: "60", days: 7 },
  "4h": { res: "240", days: 30 },
  "1D": { res: "D", days: 180 },
  "1d": { res: "D", days: 180 },
};

async function resolveFeed(market: string) {
  const key = market.toUpperCase();
  if (PYTH_STATIC[key]) return PYTH_STATIC[key];
  try {
    const url = new URL("https://hermes.pyth.network/v2/price_feeds");
    url.searchParams.set("query", key);
    url.searchParams.set("asset_type", "crypto");
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const feeds = (await res.json()) as Array<{
      id: string;
      attributes?: { base?: string; symbol?: string; quote_currency?: string };
    }>;
    const exact =
      feeds.find(
        (f) =>
          f.attributes?.base?.toUpperCase() === key &&
          f.attributes?.quote_currency === "USD",
      ) || feeds.find((f) => f.attributes?.base?.toUpperCase() === key);
    if (!exact?.id) return null;
    const priceId = exact.id.startsWith("0x") ? exact.id : `0x${exact.id}`;
    return {
      priceId,
      history: exact.attributes?.symbol || `Crypto.${key}/USD`,
    };
  } catch {
    return null;
  }
}

async function fetchSpot(priceId: string): Promise<number | null> {
  try {
    const url = new URL("https://hermes.pyth.network/v2/updates/price/latest");
    url.searchParams.append("ids[]", priceId);
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    const p = data?.parsed?.[0]?.price;
    if (!p) return null;
    return Number(p.price) * Math.pow(10, p.expo);
  } catch {
    return null;
  }
}

async function fetchHistory(
  historySymbol: string,
  res: string,
  days: number,
): Promise<StructureCandle[]> {
  const to = Math.floor(Date.now() / 1000);
  const from = to - Math.min(days, 364) * 86400;
  const url = new URL(
    "https://benchmarks.pyth.network/v1/shims/tradingview/history",
  );
  url.searchParams.set("symbol", historySymbol);
  url.searchParams.set("resolution", res);
  url.searchParams.set("from", String(from));
  url.searchParams.set("to", String(to));
  const r = await fetch(url.toString());
  if (!r.ok) return [];
  const data = await r.json();
  if (data?.s !== "ok" || !Array.isArray(data.t)) return [];
  const out: StructureCandle[] = [];
  for (let i = 0; i < data.t.length; i++) {
    const open = Number(data.o[i]);
    const high = Number(data.h[i]);
    const low = Number(data.l[i]);
    const close = Number(data.c[i]);
    if (![open, high, low, close].every((n) => Number.isFinite(n) && n > 0)) {
      continue;
    }
    out.push({ time: data.t[i], open, high, low, close });
  }
  return out;
}

function summarizeCandles(candles: StructureCandle[]) {
  if (!candles.length) return { count: 0 };
  const last = candles[candles.length - 1];
  const first = candles[0];
  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const changePct = ((last.close - first.open) / first.open) * 100;
  // simple RSI-ish momentum last 14
  let gains = 0;
  let losses = 0;
  const n = Math.min(14, candles.length - 1);
  for (let i = candles.length - n; i < candles.length; i++) {
    const d = candles[i].close - candles[i - 1].close;
    if (d >= 0) gains += d;
    else losses -= d;
  }
  const rs = losses === 0 ? 100 : gains / losses;
  const rsi = 100 - 100 / (1 + rs);

  return {
    count: candles.length,
    open: first.open,
    last: last.close,
    high: Math.max(...highs),
    low: Math.min(...lows),
    changePct: Number(changePct.toFixed(3)),
    rsiApprox: Number(rsi.toFixed(1)),
    last5: candles.slice(-5).map((c) => ({
      t: c.time,
      o: c.open,
      h: c.high,
      l: c.low,
      c: c.close,
    })),
  };
}

function ok(data: unknown) {
  return { text: JSON.stringify({ ok: true, data }, null, 0) };
}
function fail(message: string) {
  return { text: JSON.stringify({ ok: false, error: message }) };
}

async function demoQuote(
  from: string,
  to: string,
  amount: number,
  slipPct = 0.3,
): Promise<{ price: number; amountOut: number; feePct: number } | { error: string }> {
  const f = from.toUpperCase();
  const t = to.toUpperCase();
  if (!(amount > 0)) return { error: "amount must be > 0" };

  const fee = slipPct / 100;
  // USDC <-> asset
  if (f === "USDC" || f === "USDT" || f === "USDSUI") {
    const feed = await resolveFeed(t);
    if (!feed) return { error: `No price for ${t}` };
    const spot = await fetchSpot(feed.priceId);
    if (!spot || spot <= 0) return { error: `No spot for ${t}` };
    const exec = spot * (1 + fee); // buy asset: worse price
    const amountOut = amount / exec;
    return { price: exec, amountOut, feePct: slipPct };
  }
  if (t === "USDC" || t === "USDT" || t === "USDSUI") {
    const feed = await resolveFeed(f);
    if (!feed) return { error: `No price for ${f}` };
    const spot = await fetchSpot(feed.priceId);
    if (!spot || spot <= 0) return { error: `No spot for ${f}` };
    const exec = spot * (1 - fee); // sell asset
    const amountOut = amount * exec;
    return { price: exec, amountOut, feePct: slipPct };
  }
  // asset -> asset via USDC mid
  const feedA = await resolveFeed(f);
  const feedB = await resolveFeed(t);
  if (!feedA || !feedB) return { error: `No price for ${f}/${t}` };
  const pa = await fetchSpot(feedA.priceId);
  const pb = await fetchSpot(feedB.priceId);
  if (!pa || !pb) return { error: "Missing spots" };
  const usd = amount * pa * (1 - fee);
  const amountOut = (usd / pb) * (1 - fee);
  return { price: pa / pb, amountOut, feePct: slipPct * 2 };
}

function demoBal(demo: DemoAccount, asset: string) {
  return demo.balances[asset.toUpperCase()] ?? 0;
}

function demoDebit(demo: DemoAccount, asset: string, amount: number) {
  const a = asset.toUpperCase();
  const cur = demo.balances[a] ?? 0;
  if (cur + 1e-12 < amount) return false;
  demo.balances[a] = Number((cur - amount).toFixed(8));
  return true;
}

function demoCredit(demo: DemoAccount, asset: string, amount: number) {
  const a = asset.toUpperCase();
  demo.balances[a] = Number(((demo.balances[a] ?? 0) + amount).toFixed(8));
}

export async function executeTradingAgentTool(
  sessionId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<{ text: string }> {
  const session = getOrCreateSession(sessionId);
  const demo = session.demoMode && session.demo ? session.demo : null;

  try {
    switch (name) {
      case "trade_think": {
        const thought = String(args.thought || "").trim();
        if (!thought) return fail("thought required");
        session.thoughts.push(thought);
        if (session.thoughts.length > 40) session.thoughts.shift();
        return ok({
          logged: true,
          thought,
          demo: Boolean(demo),
          memoryLinked: session.memory.length > 0,
        });
      }
      case "trade_remember": {
        const mem = primaryMemory(session);
        if (!mem) {
          return fail(
            "No Walrus memory linked to this strategy. Link exactly one memory on Strategy → Link memory, then restart the agent tick.",
          );
        }
        const text = String(args.text || "").trim();
        if (!text) return fail("text required");
        const kind = String(args.kind || "observation");
        const stamped = [
          `[strategy-agent][${kind}]`,
          session.strategyId ? `strategy=${session.strategyId}` : "",
          demo ? "mode=demo" : "mode=live/analysis",
          new Date().toISOString(),
          text,
        ]
          .filter(Boolean)
          .join("\n");
        {
          const saved = await rememberWithFallback(mem, stamped, kind);
          if (!saved.ok) {
            return fail(saved.error || "remember failed");
          }
          return ok({
            saved: true,
            onchain: saved.storage === "walrus",
            blob_id: saved.blob_id,
            memory: mem.label,
            namespace: toWalrusCreds(mem).namespace,
            kind,
            storage: saved.storage,
            walrusPaused: saved.walrusPaused || false,
            pendingOnchain: saved.flush?.remaining ?? pendingOnchainCount(toWalrusCreds(mem).namespace),
            message:
              saved.storage === "walrus"
                ? "Saved on-chain (Walrus)."
                : saved.error ||
                  "Queued for on-chain upload; will retry automatically.",
            flush: saved.flush,
          });
        }
      }
      case "trade_recall": {
        const mem = primaryMemory(session);
        if (!mem) {
          return fail(
            "No Walrus memory linked. Link a memory on the Strategy page first.",
          );
        }
        const query = String(args.query || "").trim();
        if (!query) return fail("query required");
        const limit = Math.min(Math.max(Number(args.limit) || 5, 1), 15);
        const creds = toWalrusCreds(mem);
        const ns = creds.namespace;

        // Try to push pending notes on-chain before recall
        const flush = await flushPendingToWalrus({ namespace: ns, maxBatch: 8 });

        const local = localRecall({
          namespace: ns,
          accountId: creds.accountId.trim(),
          query,
          limit,
        });

        let remote: Array<{
          relevance: number;
          text: string;
          blob_id: string;
          source?: string;
        }> = [];
        let remoteError: string | null = null;
        try {
          creds.accountId = creds.accountId.trim();
          creds.delegateKey = creds.delegateKey.trim();
          const result = await walrusRecall(creds, query, { limit });
          remote = result.results.map((r) => ({
            relevance: r.relevance,
            text: r.text,
            blob_id: r.blob_id,
            source: "walrus",
          }));
        } catch (err) {
          remoteError = err instanceof Error ? err.message : String(err);
        }

        const merged = [
          ...local.map((r) => ({ ...r, source: "local" as const })),
          ...remote,
        ];
        merged.sort((a, b) => b.relevance - a.relevance);
        const seen = new Set<string>();
        const results = [];
        for (const r of merged) {
          const key = r.text.slice(0, 120);
          if (seen.has(key)) continue;
          seen.add(key);
          results.push(r);
          if (results.length >= limit) break;
        }

        return ok({
          memory: mem.label,
          namespace: ns,
          total: results.length,
          results,
          localCount: localNoteCount(ns),
          pendingOnchain: pendingOnchainCount(ns),
          flush,
          remoteError,
          note: remoteError
            ? "Walrus recall failed; showing queued/local notes. Flush will retry on-chain."
            : flush.uploaded > 0
              ? `Flushed ${flush.uploaded} pending note(s) on-chain; merged results.`
              : "Merged on-chain Walrus + any pending local notes.",
        });
      }
      case "trade_update_plan": {
        session.plan = String(args.plan || "").trim();
        return ok({ plan: session.plan });
      }
      case "trade_analyze_market": {
        const market = String(args.market || "SUI").toUpperCase();
        const tf = String(args.timeframe || "1h");
        const feed = await resolveFeed(market);
        if (!feed) return fail(`No Pyth feed for ${market}`);
        const conf = TF_RES[tf] || TF_RES["1h"];
        const candles = await fetchHistory(feed.history, conf.res, conf.days);
        const spot = await fetchSpot(feed.priceId);
        const structure = analyzeStructure(candles, [
          "ob",
          "bos",
          "fvg",
          "swings",
        ]).slice(-20);
        return ok({
          market,
          timeframe: tf,
          spot,
          summary: summarizeCandles(candles),
          structure,
          demo: Boolean(demo),
        });
      }
      case "trade_get_price": {
        const market = String(args.market || "SUI").toUpperCase();
        const feed = await resolveFeed(market);
        if (!feed) return fail(`No feed for ${market}`);
        const spot = await fetchSpot(feed.priceId);
        return ok({ market, spot });
      }
      case "trade_get_demo_account": {
        if (!demo) return fail("Not in demo mode");
        const marked = await markDemoToMarket(demo);
        return ok({
          mode: "demo",
          balances: demo.balances,
          equityUsd: marked.equityUsd,
          startingEquityUsd: demo.startingEquityUsd,
          pnlUsd: Number((marked.equityUsd - demo.startingEquityUsd).toFixed(4)),
          trades: demo.trades.slice(-20),
          marks: marked.marks,
        });
      }
      case "trade_get_quote": {
        const from = String(args.from);
        const to = String(args.to);
        const amount = Number(args.amount);
        if (demo) {
          const q = await demoQuote(from, to, amount, 0.3);
          if ("error" in q) return fail(q.error);
          return ok({
            mode: "demo",
            fromToken: from,
            toToken: to,
            fromAmount: amount,
            toAmount: q.amountOut,
            price: q.price,
            priceImpact: q.feePct / 100,
            route: "DEMO/Pyth",
          });
        }
        const agent = (await getAgent()) as {
          swapQuote: (o: {
            from: string;
            to: string;
            amount: number;
          }) => Promise<unknown>;
        };
        const quote = await agent.swapQuote({ from, to, amount });
        return ok(quote);
      }
      case "trade_open_long":
      case "trade_open_short": {
        const market = String(args.market).toUpperCase();
        const size = Number(args.amount);
        const lev = Math.min(Math.max(Number(args.leverage) || 1, 1), 5);
        const slip = Number(args.slippage);
        const side = name === "trade_open_long" ? "long" : "short";

        if (demo) {
          const slipPct = Number.isFinite(slip) ? slip : 0.3;
          if (!(size > 0)) return fail("Invalid amount");

          if (side === "long") {
            // amount = USDC to spend
            const usdcSpend = size * (lev > 1 ? 1 : 1); // demo: no borrow leverage
            if (demoBal(demo, "USDC") < usdcSpend) {
              return fail(
                `Insufficient USDC (have ${demoBal(demo, "USDC")}, need ${usdcSpend}). Short/sell SUI first or swap to USDC.`,
              );
            }
            const q = await demoQuote("USDC", market, usdcSpend, slipPct);
            if ("error" in q) return fail(q.error);
            demoDebit(demo, "USDC", usdcSpend);
            demoCredit(demo, market, q.amountOut);
            const rec: DemoTradeRecord = {
              id: `dt-${Date.now()}`,
              ts: Date.now(),
              action: "long",
              market,
              fromAsset: "USDC",
              toAsset: market,
              amountIn: usdcSpend,
              amountOut: q.amountOut,
              price: q.price,
              note: "demo long",
            };
            demo.trades.push(rec);
            session.lastAction = `DEMO long ${market} $${usdcSpend}`;
            const chart = recordEntryWithRisk(sessionId, {
              market,
              price: q.price,
              side: "long",
            });
            const marked = await markDemoToMarket(demo);
            const remembered = await autoRememberTrade(
              session,
              "outcome",
              `LONG ${market}: spent ${usdcSpend} USDC → got ${q.amountOut.toPrecision(6)} ${market} @ ${q.price}. Equity ~$${marked.equityUsd}.`,
            );
            return ok({
              mode: "demo",
              side,
              market,
              filled: rec,
              balances: demo.balances,
              equityUsd: marked.equityUsd,
              remembered,
              chartAnnotations: chart,
            });
          }

          // short = sell market size for USDC
          const sell = size;
          if (demoBal(demo, market) < sell) {
            return fail(
              `Insufficient ${market} (have ${demoBal(demo, market)}, need ${sell})`,
            );
          }
          const q = await demoQuote(market, "USDC", sell, slipPct);
          if ("error" in q) return fail(q.error);
          demoDebit(demo, market, sell);
          demoCredit(demo, "USDC", q.amountOut);
          const rec: DemoTradeRecord = {
            id: `dt-${Date.now()}`,
            ts: Date.now(),
            action: "short",
            market,
            fromAsset: market,
            toAsset: "USDC",
            amountIn: sell,
            amountOut: q.amountOut,
            price: q.price,
            note: "demo short/sell",
          };
          demo.trades.push(rec);
          session.lastAction = `DEMO short ${sell} ${market}`;
          const chart = recordEntryWithRisk(sessionId, {
            market,
            price: q.price,
            side: "short",
          });
          const marked = await markDemoToMarket(demo);
          const remembered = await autoRememberTrade(
            session,
            "outcome",
            `SHORT/SELL ${market}: sold ${sell} → ${q.amountOut.toPrecision(6)} USDC @ ${q.price}. Equity ~$${marked.equityUsd}.`,
          );
          return ok({
            mode: "demo",
            side,
            market,
            filled: rec,
            balances: demo.balances,
            equityUsd: marked.equityUsd,
            remembered,
            chartAnnotations: chart,
          });
        }

        // LIVE
        const agent = (await getAgent()) as {
          borrow: (o: { amount: number; asset?: string }) => Promise<unknown>;
          swap: (o: {
            from: string;
            to: string;
            amount: number;
            slippage?: number;
          }) => Promise<unknown>;
        };
        const slippage = Number.isFinite(slip) ? slip : 1;
        const steps: unknown[] = [];
        if (side === "long") {
          let spend = size;
          if (lev > 1) {
            steps.push(
              await agent.borrow({ amount: size * (lev - 1), asset: "USDC" }),
            );
            spend = size * lev;
          }
          steps.push(
            await agent.swap({
              from: "USDC",
              to: market,
              amount: spend,
              slippage,
            }),
          );
        } else {
          let sell = size;
          if (lev > 1) {
            steps.push(
              await agent.borrow({ amount: size * (lev - 1), asset: market }),
            );
            sell = size * lev;
          }
          steps.push(
            await agent.swap({
              from: market,
              to: "USDC",
              amount: sell,
              slippage,
            }),
          );
        }
        session.lastAction = `${side} ${market} size=${size} lev=${lev}`;
        // Chart markers at latest Pyth spot (fill price not always returned)
        let livePrice: number | null = null;
        try {
          const feed = await resolveFeed(market);
          if (feed) livePrice = await fetchSpot(feed.priceId);
        } catch {
          /* ignore */
        }
        const chart =
          livePrice != null
            ? recordEntryWithRisk(sessionId, {
                market,
                price: livePrice,
                side,
              })
            : [];
        return ok({ side, market, leverage: lev, steps, chartAnnotations: chart });
      }
      case "trade_swap": {
        const from = String(args.from).toUpperCase();
        const to = String(args.to).toUpperCase();
        const amount = Number(args.amount);
        const slip = Number(args.slippage);

        if (demo) {
          const slipPct = Number.isFinite(slip) ? slip : 0.3;
          if (demoBal(demo, from) < amount) {
            return fail(`Insufficient ${from} (have ${demoBal(demo, from)})`);
          }
          const q = await demoQuote(from, to, amount, slipPct);
          if ("error" in q) return fail(q.error);
          demoDebit(demo, from, amount);
          demoCredit(demo, to, q.amountOut);
          const rec: DemoTradeRecord = {
            id: `dt-${Date.now()}`,
            ts: Date.now(),
            action: "swap",
            market: `${from}/${to}`,
            fromAsset: from,
            toAsset: to,
            amountIn: amount,
            amountOut: q.amountOut,
            price: q.price,
          };
          demo.trades.push(rec);
          session.lastAction = `DEMO swap ${from}->${to}`;
          // Chart market = non-stable side
          const chartMarket =
            from === "USDC" || from === "USDT" || from === "USDSUI" ? to : from;
          const swapAnns = recordSwapAnnotation(sessionId, {
            market: chartMarket,
            price: q.price,
            label: `SWAP ${from}→${to}`,
            from,
            to,
          });
          const marked = await markDemoToMarket(demo);
          const remembered = await autoRememberTrade(
            session,
            "outcome",
            `SWAP ${from}→${to}: in ${amount} → out ${q.amountOut.toPrecision(6)}. Equity ~$${marked.equityUsd}.`,
          );
          return ok({
            mode: "demo",
            filled: rec,
            balances: demo.balances,
            equityUsd: marked.equityUsd,
            remembered,
            chartAnnotations: swapAnns,
          });
        }

        const agent = (await getAgent()) as {
          swap: (o: {
            from: string;
            to: string;
            amount: number;
            slippage?: number;
          }) => Promise<unknown>;
        };
        const result = await agent.swap({
          from,
          to,
          amount,
          slippage: Number.isFinite(slip) ? slip : 1,
        });
        session.lastAction = `swap ${from}->${to}`;
        const chartMarket =
          from === "USDC" || from === "USDT" || from === "USDSUI" ? to : from;
        let livePrice: number | null = null;
        try {
          const feed = await resolveFeed(chartMarket);
          if (feed) livePrice = await fetchSpot(feed.priceId);
        } catch {
          /* ignore */
        }
        const swapAnns =
          livePrice != null
            ? recordSwapAnnotation(sessionId, {
                market: chartMarket,
                price: livePrice,
                label: `SWAP ${from}→${to}`,
                from,
                to,
              })
            : [];
        return ok({
          result,
          chartAnnotations: swapAnns,
        });
      }
      case "trade_get_positions": {
        if (demo) {
          const marked = await markDemoToMarket(demo);
          return ok({
            mode: "demo",
            balances: demo.balances,
            equityUsd: marked.equityUsd,
            startingEquityUsd: demo.startingEquityUsd,
            pnlUsd: Number(
              (marked.equityUsd - demo.startingEquityUsd).toFixed(4),
            ),
            trades: demo.trades,
          });
        }
        const agent = (await getAgent()) as {
          positions: () => Promise<unknown>;
          healthFactor: () => Promise<unknown>;
        };
        const [positions, health] = await Promise.all([
          agent.positions(),
          agent.healthFactor().catch(() => null),
        ]);
        return ok({ positions, health });
      }
      case "trade_deposit_collateral": {
        if (demo) {
          return fail("NAVI deposit not used in demo — trade spot only");
        }
        const agent = (await getAgent()) as {
          save: (o: { amount: number; asset?: string }) => Promise<unknown>;
        };
        const result = await agent.save({
          amount: Number(args.amount),
          asset: "USDC",
        });
        return ok(result);
      }
      case "trade_repay": {
        if (demo) {
          return fail("NAVI repay not used in demo");
        }
        const agent = (await getAgent()) as {
          repay: (o: {
            amount: number | "all";
            asset?: string;
          }) => Promise<unknown>;
        };
        const amt =
          args.amount === "all" || args.amount == null
            ? "all"
            : Number(args.amount);
        const result = await agent.repay({
          amount: amt as number | "all",
          asset: String(args.asset || "USDC"),
        });
        return ok(result);
      }
      case "trade_schedule_next": {
        const sec = Math.min(
          Math.max(Math.floor(Number(args.seconds) || 60), 15),
          900,
        );
        session.nextTickSeconds = sec;
        session.stopped = false;
        return ok({
          scheduledIn: sec,
          reason: String(args.reason || ""),
        });
      }
      case "trade_stop": {
        session.stopped = true;
        session.nextTickSeconds = null;
        return ok({ stopped: true, reason: String(args.reason || "") });
      }
      case "market_get_news": {
        const limit = Math.min(Math.max(Number(args.limit) || 20, 5), 40);
        const snap = await getMarketFeedSnapshot({ newsLimit: 8 });
        return ok({
          fetchedAt: snap.fetchedAt,
          errors: snap.newsErrors,
          items: snap.news.slice(0, limit).map((n) => ({
            title: n.title,
            source: n.source,
            publishedAt: n.publishedAt,
            impact: n.impactHint,
            assets: n.assets,
            link: n.link,
            summary: n.summary,
          })),
        });
      }
      case "market_get_calendar": {
        const hours = Math.min(Math.max(Number(args.hours) || 72, 6), 168);
        const highOnly = Boolean(args.highImpactOnly);
        const snap = await getMarketFeedSnapshot({ calendarHours: hours });
        let events = snap.calendar;
        if (highOnly) {
          events = events.filter((e) => /high/i.test(e.impact));
        }
        return ok({
          fetchedAt: snap.fetchedAt,
          error: snap.calendarError,
          upcomingHighImpact: snap.upcomingHighImpact.slice(0, 20),
          events: events.slice(0, 40).map((e) => ({
            title: e.title,
            country: e.country,
            date: e.date,
            impact: e.impact,
            forecast: e.forecast,
            previous: e.previous,
            minutesUntil: e.minutesUntil,
            marketHint: e.marketHint,
          })),
          xWatchlist: snap.xWatchlist.map((x) => ({
            handle: x.handle,
            focus: x.focus,
            relevance: x.relevance,
          })),
        });
      }
      case "market_assess_headline": {
        const headline = String(args.headline || "").trim();
        if (!headline) return fail("headline required");
        return ok(
          assessHeadlineImpact({
            headline,
            body: args.body != null ? String(args.body) : undefined,
            assetHint:
              args.assetHint != null
                ? String(args.assetHint)
                : args.asset != null
                  ? String(args.asset)
                  : undefined,
          }),
        );
      }
      default:
        return fail(`Unknown tool: ${name}`);
    }
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  }
}
