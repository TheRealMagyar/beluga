/** Shared trading strategy model + localStorage (Charts + Strategy pages). */

export interface TradingStrategy {
  id: string;
  name: string;
  description: string;
  symbols: string[];
  timeframe: string;
  entryRules: string;
  exitRules: string;
  stopLoss: number;
  takeProfit: number;
  /** Free-form agent instructions / personality */
  agentPrompt?: string;
  /**
   * Exactly one Walrus Memory fragment ID (Memory Manager), or null/undefined.
   * Legacy `memoryIds` arrays are migrated to this single id.
   */
  memoryId?: string | null;
  /** @deprecated use memoryId — kept for migration only */
  memoryIds?: string[];
  /** Built-in strategies cannot be deleted */
  isDefault?: boolean;
  createdAt: number;
  updatedAt?: number;
}

/** Credentials resolved for the trading agent (renderer → main). */
export interface StrategyMemoryCredential {
  entryId: string;
  label: string;
  accountId: string;
  delegateKey: string;
  network: "mainnet" | "testnet";
  /** Walrus namespace used for this strategy's notes */
  namespace: string;
}

export const STRATEGIES_STORAGE_KEY = "beluga-trading-strategies";
/** Dedicated durable map: strategyId → memory fragment id (survives strategy template refresh). */
export const STRATEGY_MEMORY_LINKS_KEY = "beluga-strategy-memory-links-v1";
export const ACTIVE_STRATEGY_KEY = "beluga-charts-active-strategy";
export const MEMORY_ENTRIES_KEY = "memwal-entries-v1";

export const DEFAULT_SUI_USDC_STRATEGY_ID = "default-sui-usdc";

/** Built-in SUI/USDC strategy for the chart agent + demo — 1s scalp, 1–2 min holds. */
export const DEFAULT_SUI_USDC_STRATEGY: TradingStrategy = {
  id: DEFAULT_SUI_USDC_STRATEGY_ID,
  name: "SUI/USDC 1s Scalp",
  description:
    "Ultra-short SUI/USDC scalps on the 1-second chart. Target hold time 1–2 minutes max; in-and-out micro trades.",
  symbols: ["SUI"],
  timeframe: "1s",
  entryRules: [
    "Market: SUI only (quote USDC). Chart timeframe: 1s.",
    "This is SCALPING only — every position should aim for a 1–2 minute hold, never multi-hour swings.",
    "Long: brief bullish micro-momentum (uptick bursts, bullish micro BOS/FVG on 1s/1m structure if available) without chasing extended spikes.",
    "Short: brief bearish bursts / failed pop — sell SUI into strength for a quick fade.",
    "Size: small — demo ~3–10% of equity per idea so you can re-enter often.",
    "Prefer 1–3 quick trades per few minutes over one large bag hold.",
  ].join("\n"),
  exitRules: [
    "HARD TIME EXIT: close or reverse within 60–120 seconds of entry. Do not hold longer than 2 minutes.",
    "Take profit quickly (~takeProfit % or first micro swing / opposite tick burst).",
    "Stop loss tight (~stopLoss %). If flat after 30s with no edge, scratch/exit.",
    "After exit, re-read 1s tape and wait for the next micro setup — do not sit in dead positions.",
  ].join("\n"),
  stopLoss: 0.4,
  takeProfit: 0.6,
  agentPrompt: [
    "You scalp SUI/USDC on a 1-second chart only.",
    "Max hold: 1–2 minutes per trade. If a trade is still open past ~90s, exit immediately (swap back).",
    "Use trade_analyze_market with timeframe 1s or 1m for context; trade_get_price every tick for live spot.",
    "Self-schedule trade_schedule_next every 15–30 seconds while demo runs so you can manage open scalps.",
    "In DEMO: fills are virtual on real Pyth prices. trade_think before each entry/exit. trade_get_demo_account after fills.",
    "Stay active: many small scalps, not long holds.",
  ].join(" "),
  isDefault: true,
  memoryId: null,
  createdAt: 0,
  updatedAt: 0,
};

function loadMemoryLinksMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STRATEGY_MEMORY_LINKS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveMemoryLinksMap(map: Record<string, string>) {
  localStorage.setItem(STRATEGY_MEMORY_LINKS_KEY, JSON.stringify(map));
}

/** Normalize: at most one memory id; migrate legacy memoryIds. */
export function normalizeStrategyMemory(s: TradingStrategy): TradingStrategy {
  const fromLegacy =
    s.memoryId ||
    (Array.isArray(s.memoryIds) && s.memoryIds.length > 0
      ? s.memoryIds[0]
      : null) ||
    null;
  const { memoryIds: _drop, ...rest } = s;
  return {
    ...rest,
    memoryId: fromLegacy || null,
  };
}

export function getStrategyMemoryId(s: TradingStrategy): string | null {
  const n = normalizeStrategyMemory(s);
  return n.memoryId || null;
}

export function loadStrategies(): TradingStrategy[] {
  let list: TradingStrategy[] = [];
  try {
    const raw = localStorage.getItem(STRATEGIES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as TradingStrategy[];
      if (Array.isArray(parsed)) list = parsed.map(normalizeStrategyMemory);
    }
  } catch {
    list = [];
  }

  // Overlay durable memory links (source of truth for links across restarts)
  const links = loadMemoryLinksMap();
  list = list.map((s) => {
    const linked = links[s.id];
    if (linked) return { ...s, memoryId: linked };
    return s;
  });

  return ensureDefaultStrategy(list, { persist: false });
}

/**
 * Keep default strategy first. Optionally write strategies to localStorage.
 * Memory links always re-applied from STRATEGY_MEMORY_LINKS_KEY.
 */
export function ensureDefaultStrategy(
  strategies: TradingStrategy[],
  opts?: { persist?: boolean },
): TradingStrategy[] {
  const links = loadMemoryLinksMap();
  const withoutDefault = strategies
    .filter((s) => s.id !== DEFAULT_SUI_USDC_STRATEGY_ID)
    .map(normalizeStrategyMemory);

  const prev = strategies.find((s) => s.id === DEFAULT_SUI_USDC_STRATEGY_ID);
  const defaultMem =
    links[DEFAULT_SUI_USDC_STRATEGY_ID] ||
    prev?.memoryId ||
    (prev?.memoryIds && prev.memoryIds[0]) ||
    null;

  const defaultStrat: TradingStrategy = {
    ...DEFAULT_SUI_USDC_STRATEGY,
    memoryId: defaultMem,
  };

  const next = [
    defaultStrat,
    ...withoutDefault.map((s) => ({
      ...s,
      memoryId: links[s.id] || s.memoryId || null,
    })),
  ];

  if (opts?.persist !== false) {
    try {
      localStorage.setItem(STRATEGIES_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }
  return next;
}

export function strategyMemoryNamespace(strategyId: string): string {
  return `strategy-${strategyId}`.slice(0, 64);
}

/** Load Memory Manager entries and resolve credentials for a strategy (0 or 1). */
export function resolveStrategyMemoryCredentials(
  strategy: TradingStrategy | null | undefined,
): StrategyMemoryCredential[] {
  const memoryId = strategy ? getStrategyMemoryId(strategy) : null;
  if (!memoryId) return [];
  try {
    const raw = localStorage.getItem(MEMORY_ENTRIES_KEY);
    if (!raw) return [];
    const entries = JSON.parse(raw) as Array<{
      id: string;
      label: string;
      accountId: string;
      delegateKey: string;
      network?: "mainnet" | "testnet";
      namespace?: string;
    }>;
    if (!Array.isArray(entries)) return [];
    const e = entries.find((x) => x.id === memoryId);
    if (!e?.accountId || !e?.delegateKey) return [];
    // Dedicated namespace per strategy — never "default", so notes stay isolated
    // from general Memory Manager traffic on the same account.
    const ns = strategyMemoryNamespace(strategy!.id);
    return [
      {
        entryId: e.id,
        label: e.label || memoryId,
        accountId: e.accountId,
        delegateKey: e.delegateKey,
        network: e.network === "testnet" ? "testnet" : "mainnet",
        namespace: ns,
      },
    ];
  } catch {
    return [];
  }
}

export function loadMemoryFragmentOptions(): Array<{
  id: string;
  label: string;
  network: string;
}> {
  try {
    const raw = localStorage.getItem(MEMORY_ENTRIES_KEY);
    if (!raw) return [];
    const entries = JSON.parse(raw) as Array<{
      id: string;
      label: string;
      network?: string;
    }>;
    if (!Array.isArray(entries)) return [];
    return entries.map((e) => ({
      id: e.id,
      label: e.label || e.id,
      network: e.network || "mainnet",
    }));
  } catch {
    return [];
  }
}

/** Link exactly one memory (or null to unlink). Persists across restarts. */
export function setStrategyMemoryId(
  strategyId: string,
  memoryId: string | null,
): TradingStrategy[] {
  const links = loadMemoryLinksMap();
  if (memoryId) links[strategyId] = memoryId;
  else delete links[strategyId];
  saveMemoryLinksMap(links);

  const list = loadStrategies().map((s) =>
    s.id === strategyId
      ? {
          ...normalizeStrategyMemory(s),
          memoryId,
          updatedAt: Date.now(),
        }
      : normalizeStrategyMemory(s),
  );
  saveStrategies(list);
  return list;
}

/** @deprecated use setStrategyMemoryId */
export function setStrategyMemoryIds(
  strategyId: string,
  memoryIds: string[],
): TradingStrategy[] {
  return setStrategyMemoryId(
    strategyId,
    memoryIds.length > 0 ? memoryIds[0] : null,
  );
}

export function saveStrategies(strategies: TradingStrategy[]) {
  // Merge memory links into list, never drop durable links
  const links = loadMemoryLinksMap();
  const merged = strategies.map((s) => {
    const n = normalizeStrategyMemory(s);
    const linked = links[n.id];
    return {
      ...n,
      memoryId: linked || n.memoryId || null,
    };
  });
  // Sync links from strategies that have memoryId set
  for (const s of merged) {
    if (s.memoryId) links[s.id] = s.memoryId;
  }
  saveMemoryLinksMap(links);
  localStorage.setItem(
    STRATEGIES_STORAGE_KEY,
    JSON.stringify(ensureDefaultStrategy(merged, { persist: false })),
  );
}

export function loadActiveStrategyId(): string | null {
  try {
    return (
      localStorage.getItem(ACTIVE_STRATEGY_KEY) || DEFAULT_SUI_USDC_STRATEGY_ID
    );
  } catch {
    return DEFAULT_SUI_USDC_STRATEGY_ID;
  }
}

export function saveActiveStrategyId(id: string | null) {
  if (!id) {
    localStorage.setItem(ACTIVE_STRATEGY_KEY, DEFAULT_SUI_USDC_STRATEGY_ID);
  } else {
    localStorage.setItem(ACTIVE_STRATEGY_KEY, id);
  }
}

export function getStrategyById(
  id: string | null | undefined,
): TradingStrategy | null {
  if (!id) return null;
  return loadStrategies().find((s) => s.id === id) ?? null;
}

export function strategyToPromptBlock(s: TradingStrategy): string {
  const mid = getStrategyMemoryId(s);
  const mem = mid
    ? `Walrus memory linked (1): use trade_recall / trade_remember.`
    : "No Walrus memory linked — observations stay in-session only unless user links memory.";
  return [
    `Strategy: ${s.name}${s.isDefault ? " (default)" : ""}`,
    s.description ? `Description: ${s.description}` : "",
    `Symbols: ${s.symbols.join(", ") || "(any)"}`,
    `Timeframe: ${s.timeframe}`,
    `Entry rules:\n${s.entryRules || "(none)"}`,
    `Exit rules:\n${s.exitRules || "(none)"}`,
    `Stop loss: ${s.stopLoss}% | Take profit: ${s.takeProfit}%`,
    s.agentPrompt ? `Agent notes:\n${s.agentPrompt}` : "",
    mem,
  ]
    .filter(Boolean)
    .join("\n");
}
