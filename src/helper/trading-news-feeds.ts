/**
 * Market news, economic calendar (Forex Factory style), and impact hints.
 * Used by Feeds UI + trading agent tools.
 */

export type NewsItem = {
  id: string;
  title: string;
  link: string;
  source: string;
  publishedAt: string | null;
  summary: string;
  tags: string[];
  impactHint: "high" | "medium" | "low" | "unknown";
  assets: string[];
};

export type CalendarEvent = {
  id: string;
  title: string;
  country: string;
  date: string;
  impact: "High" | "Medium" | "Low" | string;
  forecast: string;
  previous: string;
  actual?: string;
  /** minutes until event (negative if past) */
  minutesUntil: number;
  marketHint: string;
};

export type XWatchAccount = {
  handle: string;
  name: string;
  focus: string;
  relevance: "high" | "medium";
  url: string;
};

const UA = "BelugaTrading/1.0 (+desktop; market-feeds)";

const CRYPTO_RSS: { source: string; url: string }[] = [
  { source: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
  { source: "Cointelegraph", url: "https://cointelegraph.com/rss" },
  { source: "Decrypt", url: "https://decrypt.co/feed" },
  { source: "The Block", url: "https://www.theblock.co/rss.xml" },
];

/** Curated X accounts — no API key required; open profile / watch for narrative. */
export const DEFAULT_X_WATCHLIST: XWatchAccount[] = [
  {
    handle: "federalreserve",
    name: "Federal Reserve",
    focus: "Rates, FOMC, policy",
    relevance: "high",
    url: "https://x.com/federalreserve",
  },
  {
    handle: "newyorkfed",
    name: "NY Fed",
    focus: "Liquidity, markets",
    relevance: "high",
    url: "https://x.com/newyorkfed",
  },
  {
    handle: "POTUS",
    name: "US President",
    focus: "Macro / regulatory narrative",
    relevance: "high",
    url: "https://x.com/POTUS",
  },
  {
    handle: "SECGov",
    name: "SEC",
    focus: "Crypto regulation, ETFs",
    relevance: "high",
    url: "https://x.com/SECGov",
  },
  {
    handle: "VitalikButerin",
    name: "Vitalik Buterin",
    focus: "Ethereum / crypto tech",
    relevance: "medium",
    url: "https://x.com/VitalikButerin",
  },
  {
    handle: "cz_binance",
    name: "CZ",
    focus: "Exchange / market structure",
    relevance: "medium",
    url: "https://x.com/cz_binance",
  },
  {
    handle: "sundarpichai",
    name: "Sundar Pichai",
    focus: "Tech mega-cap risk-on",
    relevance: "medium",
    url: "https://x.com/sundarpichai",
  },
  {
    handle: "WatcherGuru",
    name: "Watcher.Guru",
    focus: "Breaking crypto / macro",
    relevance: "high",
    url: "https://x.com/WatcherGuru",
  },
  {
    handle: "whale_alert",
    name: "Whale Alert",
    focus: "Large on-chain transfers",
    relevance: "medium",
    url: "https://x.com/whale_alert",
  },
  {
    handle: "DocumentingBTC",
    name: "Documenting Bitcoin",
    focus: "BTC headlines",
    relevance: "medium",
    url: "https://x.com/DocumentingBTC",
  },
];

const ASSET_KEYWORDS: Record<string, string[]> = {
  BTC: ["bitcoin", "btc", "satoshi", "ordinal", "lightning network"],
  ETH: ["ethereum", " eth", "ether", "vitalik", "eip-", "l2 ", "layer 2"],
  SUI: ["sui", "mysten", "deepbook", "walrus"],
  SOL: ["solana", " sol", "jupiter exchange"],
  CRYPTO: [
    "crypto",
    "defi",
    "stablecoin",
    "token",
    "blockchain",
    "web3",
    "altcoin",
    "memecoin",
    "exchange",
    "binance",
    "coinbase",
  ],
  USD: [
    "fed ",
    "fomc",
    "powell",
    "interest rate",
    "rate cut",
    "rate hike",
    "cpi",
    "inflation",
    "dollar",
    "treasury",
    "nfp",
    "non-farm",
    "pce",
    "jobs report",
  ],
};

/** Weighted catalyst patterns: [regex, score delta, direction bias, label] */
const CATALYST_PATTERNS: Array<{
  re: RegExp;
  score: number;
  dir: number; // -1 bearish, +1 bullish, 0 neutral/vol
  label: string;
}> = [
  { re: /\b(hack|exploit|breach|drained|stolen)\b/i, score: 35, dir: -1, label: "security incident" },
  { re: /\b(bankrupt|insolvency|collapse|halted withdrawals)\b/i, score: 40, dir: -1, label: "solvency stress" },
  { re: /\b(sec|doj|cftc)\b.*\b(sue|lawsuit|charges|enforcement|crackdown)\b/i, score: 32, dir: -1, label: "regulatory action" },
  { re: /\b(ban|outlaw|prohibit)\b.*\b(crypto|bitcoin|trading)\b/i, score: 38, dir: -1, label: "ban risk" },
  { re: /\b(etf)\b.*\b(approv\w*|green.?light|launch(?:es|ed)?)\b/i, score: 34, dir: 1, label: "ETF approval" },
  { re: /\b(approv\w*|green.?light)\b.*\b(etf)\b/i, score: 34, dir: 1, label: "ETF approval" },
  { re: /\b(etf)\b.*\b(reject\w*|delay\w*|den(?:y|ies|ied))\b/i, score: 30, dir: -1, label: "ETF setback" },
  { re: /\b(fomc|fed decision|rate decision|interest rate decision)\b/i, score: 36, dir: 0, label: "Fed decision" },
  { re: /\b(rate cut|dovish)\b/i, score: 28, dir: 1, label: "dovish / cut" },
  { re: /\b(rate hike|hawkish|higher for longer)\b/i, score: 28, dir: -1, label: "hawkish / hike" },
  { re: /\b(cpi|inflation print|pce|ppi)\b/i, score: 32, dir: 0, label: "inflation data" },
  { re: /\b(nfp|non-?farm|jobs report|unemployment)\b/i, score: 30, dir: 0, label: "labor data" },
  { re: /\b(war|missile|invasion|sanction|geopolitic)\b/i, score: 30, dir: -1, label: "geopolitics" },
  { re: /\b(listing|lists|listed on)\b/i, score: 18, dir: 1, label: "exchange listing" },
  { re: /\b(delist|delisting)\b/i, score: 26, dir: -1, label: "delisting" },
  { re: /\b(partnership|integrat|adopt)\b/i, score: 14, dir: 1, label: "adoption/partnership" },
  { re: /\b(mainnet|upgrade|hard fork|launch)\b/i, score: 16, dir: 1, label: "protocol upgrade" },
  { re: /\b(token unlock|cliff unlock|vesting unlock)\b/i, score: 22, dir: -1, label: "token unlock" },
  { re: /\b(airdrop)\b/i, score: 12, dir: 1, label: "airdrop" },
  { re: /\b(funding rate|liquidat|short squeeze|long squeeze)\b/i, score: 24, dir: 0, label: "derivatives stress" },
  { re: /\b(whale|\$[0-9]+m|million.*transfer)\b/i, score: 12, dir: 0, label: "whale flow" },
  { re: /\b(stablecoin|usdt|usdc|depeg)\b/i, score: 26, dir: -1, label: "stablecoin risk" },
  { re: /\b(record high|ath|all-time high)\b/i, score: 15, dir: 1, label: "ATH narrative" },
  { re: /\b(crash|plunge|sell-?off|flash crash)\b/i, score: 28, dir: -1, label: "crash narrative" },
  { re: /\b(rally|surge|breakout|soar)\b/i, score: 16, dir: 1, label: "rally narrative" },
  { re: /\b(sec)\b.*\b(approv\w*|green.?light|clarity)\b/i, score: 26, dir: 1, label: "regulatory green light" },
  { re: /\b(approv\w*|green.?light)\b.*\b(sec|cftc|regulator)\b/i, score: 22, dir: 1, label: "regulatory green light" },
  { re: /\b(spot etf|bitcoin etf|ether etf|eth etf)\b/i, score: 30, dir: 0, label: "spot ETF" },
  { re: /\b(outflow|inflow).*(etf|fund)\b/i, score: 20, dir: 0, label: "ETF flows" },
  { re: /\b(etf).*(outflow|inflow)\b/i, score: 20, dir: 0, label: "ETF flows" },
  { re: /\b(tariff|trade war|recession|stagflation)\b/i, score: 26, dir: -1, label: "macro stress" },
  { re: /\b(stimulus|qe|liquidity injection)\b/i, score: 22, dir: 1, label: "liquidity boost" },
  { re: /\b(secures?|raises?)\b.*\$[\d,.]+/i, score: 14, dir: 1, label: "fundraising" },
  { re: /\b(tvl|total value locked)\b/i, score: 12, dir: 0, label: "DeFi TVL" },
  { re: /\b(bridge).*(hack|exploit|drain)\b/i, score: 38, dir: -1, label: "bridge exploit" },
  { re: /\b(circuit breaker|trading halt|paused trading)\b/i, score: 28, dir: -1, label: "trading halt" },
  { re: /\b(sui|deepbook|mysten)\b/i, score: 8, dir: 0, label: "Sui ecosystem" },
];

export type CustomFeedEndpoint = {
  id: string;
  name: string;
  url: string;
  type: "rss" | "json";
  /** JSON path to array of items, e.g. "data.items" or "" for root array */
  jsonPath?: string;
  titleKey?: string;
  linkKey?: string;
  summaryKey?: string;
  dateKey?: string;
  enabled?: boolean;
};

export type ImpactAssessment = {
  impact: NewsItem["impactHint"];
  score: number;
  direction: "bullish" | "bearish" | "mixed" | "neutral";
  confidence: number;
  assets: string[];
  catalysts: string[];
  timeHorizon: "minutes" | "hours" | "days";
  volatility: "spike" | "elevated" | "normal";
  summary: string;
  tradingNotes: string[];
  mode: "heuristic" | "ai";
};

function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = block.match(re);
  if (!m) {
    // self-closing link href=
    if (tag === "link") {
      const href = block.match(/<link[^>]+href=["']([^"']+)["']/i);
      if (href) return href[1];
    }
    return "";
  }
  return decodeXml(m[1]);
}

function detectAssets(text: string): string[] {
  const lower = ` ${text.toLowerCase()} `;
  const found: string[] = [];
  for (const [asset, kws] of Object.entries(ASSET_KEYWORDS)) {
    if (kws.some((k) => lower.includes(k.toLowerCase()))) found.push(asset);
  }
  // token tickers like $SUI $BTC
  const tickers = text.match(/\$([A-Z]{2,10})\b/g);
  if (tickers) {
    for (const t of tickers) {
      const sym = t.slice(1);
      if (!found.includes(sym)) found.push(sym);
    }
  }
  return found.length ? found : ["CRYPTO"];
}

function scoreToImpact(score: number): NewsItem["impactHint"] {
  if (score >= 55) return "high";
  if (score >= 28) return "medium";
  if (score >= 10) return "low";
  return "unknown";
}

function newsImpactHint(title: string, summary: string): NewsItem["impactHint"] {
  return assessHeadlineImpact(`${title}. ${summary}`).impact;
}

function getByPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  const parts = path.split(".").filter(Boolean);
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/rss+xml, application/xml, application/json, text/xml, */*",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function parseRssItems(xml: string, source: string, max = 15): NewsItem[] {
  const items: NewsItem[] = [];
  const blocks = xml.split(/<item[\s>]/i).slice(1);
  for (const raw of blocks.slice(0, max)) {
    const block = raw.split(/<\/item>/i)[0] || raw;
    const title = extractTag(block, "title");
    if (!title) continue;
    let link = extractTag(block, "link");
    if (!link) {
      const guid = extractTag(block, "guid");
      if (guid.startsWith("http")) link = guid;
    }
    const pub =
      extractTag(block, "pubDate") ||
      extractTag(block, "published") ||
      extractTag(block, "dc:date") ||
      null;
    const summary =
      extractTag(block, "description") ||
      extractTag(block, "content:encoded") ||
      "";
    const assets = detectAssets(`${title} ${summary}`);
    items.push({
      id: `${source}-${title.slice(0, 40).replace(/\W+/g, "_")}-${(pub || "").slice(0, 16)}`,
      title,
      link: link || "",
      source,
      publishedAt: pub,
      summary: summary.slice(0, 280),
      tags: assets,
      impactHint: newsImpactHint(title, summary),
      assets,
    });
  }
  return items;
}

export async function fetchCryptoNews(limitPerSource = 8): Promise<{
  items: NewsItem[];
  errors: string[];
  fetchedAt: number;
}> {
  const errors: string[] = [];
  const all: NewsItem[] = [];

  await Promise.all(
    CRYPTO_RSS.map(async ({ source, url }) => {
      try {
        const xml = await fetchText(url);
        all.push(...parseRssItems(xml, source, limitPerSource));
      } catch (e) {
        errors.push(
          `${source}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }),
  );

  // Sort high impact first, then by date if parseable
  all.sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2, unknown: 3 };
    const d = rank[a.impactHint] - rank[b.impactHint];
    if (d !== 0) return d;
    const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return tb - ta;
  });

  return { items: all, errors, fetchedAt: Date.now() };
}

function calendarMarketHint(ev: {
  title: string;
  country: string;
  impact: string;
}): string {
  const t = `${ev.title} ${ev.country}`.toLowerCase();
  if (t.includes("fomc") || t.includes("interest rate") || t.includes("fed")) {
    return "High crypto beta to USD liquidity / risk sentiment. Expect vol spike around release.";
  }
  if (t.includes("cpi") || t.includes("inflation") || t.includes("ppi")) {
    return "Inflation prints move rate odds → risk assets (BTC/ETH) often reprice quickly.";
  }
  if (t.includes("nfp") || t.includes("non-farm") || t.includes("employment")) {
    return "Labor data shifts Fed path; risk-on/off flip common within minutes.";
  }
  if (t.includes("gdp")) {
    return "Growth surprise can support or hit risk appetite; medium crypto correlation.";
  }
  if (ev.country === "USD" && /high/i.test(ev.impact)) {
    return "USD high-impact event — watch BTC dominance and funding/leverage flush risk.";
  }
  if (/high/i.test(ev.impact)) {
    return "High-impact macro print — elevated short-term volatility likely.";
  }
  if (/medium/i.test(ev.impact)) {
    return "Medium impact — secondary move unless surprise vs forecast is large.";
  }
  return "Low impact — usually noise for crypto unless clustered with other prints.";
}

/**
 * Forex Factory style weekly calendar via faireconomy CDN.
 * JSON is frequently 429'd; CSV is preferred. Aggressive disk+memory cache
 * so auto-refresh never spams the CDN.
 */
const CALENDAR_ENDPOINTS: { url: string; kind: "csv" | "json" }[] = [
  {
    url: "https://nfs.faireconomy.media/ff_calendar_thisweek.csv",
    kind: "csv",
  },
  {
    url: "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
    kind: "json",
  },
];

/** In-memory: avoid network for hours after a good pull. */
const CALENDAR_MEMORY_TTL_MS = 6 * 60 * 60 * 1000;
/** On disk: reuse across restarts for up to a week. */
const CALENDAR_DISK_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** After 429, do not touch the CDN again for a long time. */
const CALENDAR_RATE_LIMIT_COOLDOWN_MS = 2 * 60 * 60 * 1000;

type CalendarCachePayload = {
  events: CalendarEvent[];
  upcomingHighImpact: CalendarEvent[];
  fetchedAt: number;
};

let calendarCache: CalendarCachePayload | null = null;
let calendarRateLimitedUntil = 0;
let calendarDiskLoaded = false;

function calendarDiskPath(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("path") as typeof import("path");
  const os = require("os") as typeof import("os");
  return path.join(os.homedir(), ".beluga", "cache", "ff_calendar_week.json");
}

function loadCalendarDisk(): CalendarCachePayload | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs") as typeof import("fs");
    const p = calendarDiskPath();
    if (!fs.existsSync(p)) return null;
    const raw = JSON.parse(fs.readFileSync(p, "utf8")) as CalendarCachePayload & {
      fetchedAt?: number;
    };
    if (!raw?.events?.length || !raw.fetchedAt) return null;
    if (Date.now() - raw.fetchedAt > CALENDAR_DISK_TTL_MS) return null;
    return {
      events: raw.events,
      upcomingHighImpact: raw.upcomingHighImpact || [],
      fetchedAt: raw.fetchedAt,
    };
  } catch {
    return null;
  }
}

function saveCalendarDisk(payload: CalendarCachePayload): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs") as typeof import("fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("path") as typeof import("path");
    const p = calendarDiskPath();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(payload), "utf8");
  } catch {
    /* ignore disk errors */
  }
}

function ensureCalendarMemoryFromDisk(): void {
  if (calendarDiskLoaded) return;
  calendarDiskLoaded = true;
  if (calendarCache) return;
  const disk = loadCalendarDisk();
  if (disk) calendarCache = disk;
}

function recomputeCalendarMinutes(events: CalendarEvent[]): CalendarEvent[] {
  const now = Date.now();
  return events.map((e) => {
    const ts = e.date ? Date.parse(e.date) : NaN;
    const minutesUntil = Number.isFinite(ts)
      ? Math.round((ts - now) / 60000)
      : e.minutesUntil;
    return { ...e, minutesUntil };
  });
}

function withRecomputed(payload: CalendarCachePayload): CalendarCachePayload {
  const events = recomputeCalendarMinutes(payload.events);
  const upcomingHighImpact = events.filter(
    (e) =>
      e.minutesUntil >= -30 &&
      e.minutesUntil <= 60 * 24 * 7 &&
      /high/i.test(e.impact),
  );
  return { events, upcomingHighImpact, fetchedAt: payload.fetchedAt };
}

function serveCalendarCache(): {
  events: CalendarEvent[];
  upcomingHighImpact: CalendarEvent[];
  fetchedAt: number;
  error?: string;
  fromCache?: boolean;
} {
  ensureCalendarMemoryFromDisk();
  if (!calendarCache?.events?.length) {
    return {
      events: [],
      upcomingHighImpact: [],
      fetchedAt: Date.now(),
      fromCache: true,
      // Never spam UI with 429 — empty state is enough
      error: undefined,
    };
  }
  const recomputed = withRecomputed(calendarCache);
  return {
    ...recomputed,
    fromCache: true,
    // Have data → no yellow warning, even if CDN is rate-limited
    error: undefined,
  };
}

/** Parse FF "07-20-2026" + "12:30pm" into ISO-ish local parseable string. */
function parseFfDateTime(dateStr: string, timeStr: string): string {
  const m = dateStr.trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!m) return dateStr;
  const month = Number(m[1]);
  const day = Number(m[2]);
  const year = Number(m[3]);
  let hours = 0;
  let minutes = 0;
  const t = (timeStr || "").trim().toLowerCase();
  const tm = t.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (tm) {
    hours = Number(tm[1]);
    minutes = Number(tm[2]);
    const ap = (tm[3] || "").toLowerCase();
    if (ap === "pm" && hours < 12) hours += 12;
    if (ap === "am" && hours === 12) hours = 0;
  }
  // FF times are typically US/Eastern — store as local wall without TZ (UI displays as-is)
  const d = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return Number.isNaN(d.getTime()) ? dateStr : d.toISOString();
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
      continue;
    }
    if (ch === "," && !inQ) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function finalizeCalendarEvents(
  rows: Array<{
    title: string;
    country: string;
    date: string;
    impact: string;
    forecast: string;
    previous: string;
    actual?: string;
  }>,
): CalendarCachePayload {
  const now = Date.now();
  const events: CalendarEvent[] = rows.map((e, i) => {
    const ts = e.date ? Date.parse(e.date) : NaN;
    const minutesUntil = Number.isFinite(ts)
      ? Math.round((ts - now) / 60000)
      : 0;
    const base = {
      title: e.title || "Event",
      country: e.country || "",
      impact: e.impact || "Low",
    };
    return {
      id: `cal-${i}-${e.date}-${e.title}`,
      title: base.title,
      country: base.country,
      date: e.date,
      impact: base.impact,
      forecast: e.forecast || "",
      previous: e.previous || "",
      actual: e.actual,
      minutesUntil,
      marketHint: calendarMarketHint(base),
    };
  });

  events.sort((a, b) => a.minutesUntil - b.minutesUntil);

  const upcomingHighImpact = events.filter(
    (e) =>
      e.minutesUntil >= -30 &&
      e.minutesUntil <= 60 * 24 * 7 &&
      /high/i.test(e.impact),
  );

  return { events, upcomingHighImpact, fetchedAt: Date.now() };
}

function parseCalendarJson(text: string): CalendarCachePayload {
  const raw = JSON.parse(text) as Array<{
    title?: string;
    country?: string;
    date?: string;
    impact?: string;
    forecast?: string;
    previous?: string;
    actual?: string;
  }>;
  return finalizeCalendarEvents(
    (raw || []).map((e) => ({
      title: e.title || "Event",
      country: e.country || "",
      date: e.date || "",
      impact: e.impact || "Low",
      forecast: e.forecast || "",
      previous: e.previous || "",
      actual: e.actual,
    })),
  );
}

function parseCalendarCsv(text: string): CalendarCachePayload {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) throw new Error("Empty calendar CSV");
  // Title,Country,Date,Time,Impact,Forecast,Previous,URL
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  if (!header.includes("title") || !header.includes("date")) {
    throw new Error("Unexpected calendar CSV header");
  }
  const idx = (name: string) => header.indexOf(name);

  const rows: Array<{
    title: string;
    country: string;
    date: string;
    impact: string;
    forecast: string;
    previous: string;
  }> = [];

  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line);
    const title = (cols[idx("title")] || "").trim();
    if (!title) continue;
    const impact = (cols[idx("impact")] || "Low").trim() || "Low";
    // Skip pure holidays in high-noise view? Keep them — useful context
    const dateRaw = (cols[idx("date")] || "").trim();
    const timeRaw = idx("time") >= 0 ? cols[idx("time")] || "" : "";
    const date = parseFfDateTime(dateRaw, timeRaw);
    rows.push({
      title,
      country: (cols[idx("country")] || "").trim(),
      date,
      impact,
      forecast: (cols[idx("forecast")] || "").trim(),
      previous: (cols[idx("previous")] || "").trim(),
    });
  }
  if (!rows.length) throw new Error("No events in calendar CSV");
  return finalizeCalendarEvents(rows);
}

async function fetchCalendarFromNetwork(): Promise<CalendarCachePayload> {
  let lastErr: Error | null = null;
  let rateLimited = false;
  let waitMs = CALENDAR_RATE_LIMIT_COOLDOWN_MS;

  for (const ep of CALENDAR_ENDPOINTS) {
    try {
      const res = await fetch(ep.url, {
        headers: {
          "User-Agent": UA,
          Accept:
            ep.kind === "csv"
              ? "text/csv, text/plain, */*"
              : "application/json, */*",
        },
      });
      if (res.status === 429) {
        rateLimited = true;
        const retryAfter = Number(res.headers.get("retry-after"));
        if (Number.isFinite(retryAfter) && retryAfter > 0) {
          waitMs = Math.max(waitMs, retryAfter * 1000);
        }
        lastErr = new Error(`HTTP 429 for ${ep.url}`);
        continue;
      }
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status} for ${ep.url}`);
        continue;
      }
      const text = await res.text();
      if (/^\s*</.test(text) || /too many requests|rate limit/i.test(text)) {
        rateLimited = true;
        lastErr = new Error(`Rate-limited HTML body from ${ep.url}`);
        continue;
      }
      if (ep.kind === "csv") return parseCalendarCsv(text);
      return parseCalendarJson(text);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }

  if (rateLimited) {
    calendarRateLimitedUntil = Date.now() + waitMs;
    throw new Error("HTTP 429 rate limited");
  }
  throw lastErr || new Error("Calendar fetch failed");
}

export async function fetchEconomicCalendar(opts?: {
  /** Force network fetch (still respects rate-limit cooldown). */
  force?: boolean;
}): Promise<{
  events: CalendarEvent[];
  upcomingHighImpact: CalendarEvent[];
  fetchedAt: number;
  error?: string;
  fromCache?: boolean;
}> {
  ensureCalendarMemoryFromDisk();
  const now = Date.now();

  // Warm memory/disk — never hit CDN on auto-refresh
  if (
    !opts?.force &&
    calendarCache &&
    now - calendarCache.fetchedAt < CALENDAR_MEMORY_TTL_MS
  ) {
    return serveCalendarCache();
  }

  // Cooldown after 429: silent cache
  if (now < calendarRateLimitedUntil) {
    return serveCalendarCache();
  }

  try {
    const parsed = await fetchCalendarFromNetwork();
    calendarCache = parsed;
    calendarRateLimitedUntil = 0;
    saveCalendarDisk(parsed);
    return { ...withRecomputed(parsed) };
  } catch {
    // Network failed (usually 429) — silent fallback to last good data
    return serveCalendarCache();
  }
}

export type AssessImpactInput = {
  headline: string;
  body?: string;
  assetHint?: string;
};

export function assessHeadlineImpact(
  headlineOrInput: string | AssessImpactInput,
): ImpactAssessment {
  const input: AssessImpactInput =
    typeof headlineOrInput === "string"
      ? { headline: headlineOrInput }
      : headlineOrInput;

  const headline = (input.headline || "").trim();
  const body = (input.body || "").trim();
  const assetHint = (input.assetHint || "").trim().toUpperCase();
  // Headline weighs more; body adds secondary signals
  const text = body ? `${headline}\n\n${body.slice(0, 1200)}` : headline;
  const headlineOnly = headline;

  let assets = detectAssets(`${headline} ${body} ${assetHint}`);
  if (assetHint && !assets.includes(assetHint) && assetHint !== "CRYPTO") {
    assets = [assetHint, ...assets.filter((a) => a !== "CRYPTO")];
  }
  if (!assets.length) assets = ["CRYPTO"];

  let score = 6;
  let dirSum = 0;
  const catalysts: string[] = [];
  const seenLabels = new Set<string>();

  for (const p of CATALYST_PATTERNS) {
    if (seenLabels.has(p.label)) continue;
    // Prefer headline matches (full weight); body at 55%
    const inHead = p.re.test(headlineOnly);
    const inBody = !inHead && body ? p.re.test(body) : false;
    if (!inHead && !inBody) continue;
    const w = inHead ? 1 : 0.55;
    score += Math.round(p.score * w);
    dirSum += p.dir * p.score * w;
    seenLabels.add(p.label);
    catalysts.push(p.label);
  }

  // Asset-specific boosts (user focus + detected)
  if (assets.includes("USD") && score < 45) score += 12;
  if (assets.includes("BTC") || assets.includes("ETH")) score += 5;
  if (assets.includes("SUI")) score += 4;
  if (assetHint && assets.includes(assetHint)) score += 6;

  if (/\b(breaking|just in|urgent|flash)\b/i.test(text)) score += 10;
  if (/\b(exclusive|confirmed|official)\b/i.test(headlineOnly)) score += 5;
  if (/\b(rumour|rumor|unconfirmed|allegedly|sources say)\b/i.test(text)) score -= 14;
  if (/\b(opinion|editorial|how to|guide|what is)\b/i.test(headlineOnly)) score -= 10;

  // Magnitude cues in body
  if (/\$[\d,.]+(\s)?(b|bn|billion)/i.test(text)) score += 8;
  if (/\b(percent|%)\b.*\b(drop|surge|rally|crash)\b/i.test(text)) score += 6;

  score = Math.max(0, Math.min(100, Math.round(score)));
  const impact = scoreToImpact(score);

  let direction: ImpactAssessment["direction"] = "neutral";
  if (Math.abs(dirSum) < 10) {
    direction = score >= 40 ? "mixed" : "neutral";
  } else if (dirSum > 0) direction = "bullish";
  else direction = "bearish";

  const volatility: ImpactAssessment["volatility"] =
    score >= 55 ? "spike" : score >= 28 ? "elevated" : "normal";

  const timeHorizon: ImpactAssessment["timeHorizon"] =
    /fomc|cpi|nfp|rate decision|breaking|hack|exploit|flash/i.test(text)
      ? "minutes"
      : /etf|regulation|bill|lawsuit|unlock/i.test(text)
        ? "hours"
        : "days";

  const confidence = Math.min(
    94,
    30 +
      catalysts.length * 11 +
      (assets[0] !== "CRYPTO" ? 12 : 0) +
      (body.length > 40 ? 8 : 0) +
      (assetHint ? 6 : 0),
  );

  const notes: string[] = [];
  if (volatility === "spike") {
    notes.push("Expect short-term volatility spike — cut leverage or widen stops if scalping.");
    notes.push("Avoid opening fresh positions in the first 5–15 minutes after release.");
  } else if (volatility === "elevated") {
    notes.push("Elevated noise risk — size down; wait for structure confirmation on your TF.");
  } else {
    notes.push("Limited immediate vol edge — use as narrative context, not a forced trade.");
  }

  if (direction === "bullish") {
    notes.push("Bias lean: bullish catalysts present — longs favored only with confirmation.");
  } else if (direction === "bearish") {
    notes.push("Bias lean: bearish catalysts present — respect downside / de-risk longs.");
  } else if (direction === "mixed") {
    notes.push("Mixed catalysts — direction unclear; trade the reaction, not the headline.");
  }

  if (assets.includes("USD") || catalysts.some((c) => /Fed|inflation|labor/i.test(c))) {
    notes.push("Macro/USD channel: crypto often tracks risk-on beta around these prints.");
  }
  if (catalysts.some((c) => c.includes("security") || c.includes("solvency"))) {
    notes.push("Idiosyncratic risk — watch venue/token-specific liquidity and contagion.");
  }
  if (assetHint) {
    notes.push(`User focus: ${assetHint} — weight this pair/book first when scanning reaction.`);
  }
  if (assets.length && assets[0] !== "CRYPTO") {
    notes.push(
      `Focus pairs: ${assets.filter((a) => a !== "CRYPTO").join(", ") || assets.join(", ")}.`,
    );
  }

  const summary = [
    `Impact ${impact.toUpperCase()} (score ${score}/100, conf ${confidence}%).`,
    `Direction: ${direction}; vol: ${volatility}; horizon: ${timeHorizon}.`,
    catalysts.length
      ? `Catalysts: ${catalysts.slice(0, 5).join(", ")}.`
      : "No strong catalysts matched — low specificity; AI refine recommended.",
    `Assets: ${assets.join(", ")}.`,
  ].join(" ");

  return {
    impact,
    score,
    direction,
    confidence,
    assets,
    catalysts: catalysts.slice(0, 8),
    timeHorizon,
    volatility,
    summary,
    tradingNotes: notes,
    mode: "heuristic",
  };
}

/** Parse AI JSON blob into ImpactAssessment; merge with heuristic as base. */
export function mergeAiAssessment(
  base: ImpactAssessment,
  aiText: string,
): ImpactAssessment {
  try {
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        ...base,
        summary: aiText.trim().slice(0, 600) || base.summary,
        mode: "ai",
        tradingNotes: [
          ...base.tradingNotes.slice(0, 2),
          ...(aiText
            .split("\n")
            .map((l) => l.replace(/^[-*•]\s*/, "").trim())
            .filter((l) => l.length > 20)
            .slice(0, 4) || []),
        ].slice(0, 6),
      };
    }
    const j = JSON.parse(jsonMatch[0]) as Partial<ImpactAssessment> & {
      notes?: string[];
    };
    const impact =
      j.impact === "high" || j.impact === "medium" || j.impact === "low"
        ? j.impact
        : base.impact;
    return {
      impact,
      score:
        typeof j.score === "number"
          ? Math.max(0, Math.min(100, j.score))
          : base.score,
      direction:
        j.direction === "bullish" ||
        j.direction === "bearish" ||
        j.direction === "mixed" ||
        j.direction === "neutral"
          ? j.direction
          : base.direction,
      confidence:
        typeof j.confidence === "number"
          ? Math.max(0, Math.min(100, j.confidence))
          : Math.min(95, base.confidence + 8),
      assets: Array.isArray(j.assets) && j.assets.length ? j.assets : base.assets,
      catalysts: Array.isArray(j.catalysts) ? j.catalysts : base.catalysts,
      timeHorizon:
        j.timeHorizon === "minutes" ||
        j.timeHorizon === "hours" ||
        j.timeHorizon === "days"
          ? j.timeHorizon
          : base.timeHorizon,
      volatility:
        j.volatility === "spike" ||
        j.volatility === "elevated" ||
        j.volatility === "normal"
          ? j.volatility
          : base.volatility,
      summary:
        typeof j.summary === "string" && j.summary.trim()
          ? j.summary.trim()
          : base.summary,
      tradingNotes:
        Array.isArray(j.tradingNotes) && j.tradingNotes.length
          ? j.tradingNotes.map(String)
          : Array.isArray(j.notes) && j.notes.length
            ? j.notes.map(String)
            : base.tradingNotes,
      mode: "ai",
    };
  } catch {
    return {
      ...base,
      mode: "ai",
      summary: (aiText || base.summary).slice(0, 600),
    };
  }
}

export function impactAssessmentPrompt(
  input: AssessImpactInput,
  heuristic: ImpactAssessment,
): string {
  const body = (input.body || "").trim().slice(0, 1500);
  const focus = (input.assetHint || "").trim();
  return `You are a crypto market desk analyst. Assess this news for short-term trading impact.

HEADLINE:
"""
${input.headline.trim()}
"""
${body ? `\nBODY / CONTEXT:\n"""\n${body}\n"""\n` : ""}
${focus ? `TRADER ASSET FOCUS: ${focus.toUpperCase()}\n` : ""}

Heuristic baseline (override if wrong — do not rubber-stamp weak scores):
${JSON.stringify(heuristic, null, 2)}

Scoring guide:
- 70–100 high: major macro print, ETF binary, hack/insolvency, ban, large liquidations
- 45–69 medium: listings, unlocks, material regulatory, notable protocol events
- 25–44 low: partnerships, narrative, mild flow news
- 0–24 noise: opinion, recycled, no price path

Respond with ONLY valid JSON (no markdown fences):
{
  "impact": "high"|"medium"|"low",
  "score": 0-100,
  "direction": "bullish"|"bearish"|"mixed"|"neutral",
  "confidence": 0-100,
  "assets": ["BTC","ETH",...],
  "catalysts": ["..."],
  "timeHorizon": "minutes"|"hours"|"days",
  "volatility": "spike"|"elevated"|"normal",
  "summary": "2-3 sentence desk summary",
  "tradingNotes": ["actionable note 1", "note 2", "note 3"]
}`;
}

export async function fetchCustomEndpoints(
  endpoints: CustomFeedEndpoint[],
  maxPer = 10,
): Promise<{ items: NewsItem[]; errors: string[] }> {
  const errors: string[] = [];
  const items: NewsItem[] = [];

  await Promise.all(
    endpoints
      .filter((e) => e.enabled !== false && e.url?.startsWith("http"))
      .map(async (ep) => {
        try {
          const raw = await fetchText(ep.url);
          if (ep.type === "rss" || /\.(rss|xml)(\?|$)/i.test(ep.url) || raw.trim().startsWith("<")) {
            items.push(...parseRssItems(raw, ep.name || "Custom", maxPer));
            return;
          }
          // JSON
          const data = JSON.parse(raw) as unknown;
          const arrRaw = getByPath(data, ep.jsonPath || "");
          const arr = Array.isArray(arrRaw)
            ? arrRaw
            : Array.isArray(data)
              ? data
              : null;
          if (!arr) {
            errors.push(`${ep.name}: JSON root is not an array (set jsonPath)`);
            return;
          }
          const titleKey = ep.titleKey || "title";
          const linkKey = ep.linkKey || "link";
          const summaryKey = ep.summaryKey || "summary";
          const dateKey = ep.dateKey || "publishedAt";
          for (const row of arr.slice(0, maxPer)) {
            if (!row || typeof row !== "object") continue;
            const o = row as Record<string, unknown>;
            const title = String(o[titleKey] ?? o.headline ?? o.name ?? "").trim();
            if (!title) continue;
            const link = String(o[linkKey] ?? o.url ?? o.href ?? "");
            const summary = String(o[summaryKey] ?? o.description ?? o.body ?? "").slice(0, 280);
            const publishedAt = o[dateKey]
              ? String(o[dateKey])
              : o.date
                ? String(o.date)
                : o.pubDate
                  ? String(o.pubDate)
                  : null;
            const assets = detectAssets(`${title} ${summary}`);
            items.push({
              id: `custom-${ep.id}-${title.slice(0, 32).replace(/\W+/g, "_")}`,
              title,
              link,
              source: ep.name || "Custom",
              publishedAt,
              summary,
              tags: assets,
              impactHint: assessHeadlineImpact(`${title}. ${summary}`).impact,
              assets,
            });
          }
        } catch (e) {
          errors.push(
            `${ep.name || ep.url}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }),
  );

  return { items, errors };
}

export async function getMarketFeedSnapshot(opts?: {
  newsLimit?: number;
  calendarHours?: number;
  customEndpoints?: CustomFeedEndpoint[];
}): Promise<{
  news: NewsItem[];
  newsErrors: string[];
  calendar: CalendarEvent[];
  upcomingHighImpact: CalendarEvent[];
  xWatchlist: XWatchAccount[];
  fetchedAt: number;
  calendarError?: string;
}> {
  const hours = opts?.calendarHours ?? 72;
  const [newsRes, calRes, customRes] = await Promise.all([
    fetchCryptoNews(opts?.newsLimit ?? 6),
    fetchEconomicCalendar(),
    opts?.customEndpoints?.length
      ? fetchCustomEndpoints(opts.customEndpoints, 12)
      : Promise.resolve({ items: [] as NewsItem[], errors: [] as string[] }),
  ]);

  const allNews = [...customRes.items, ...newsRes.items];
  allNews.sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2, unknown: 3 };
    const d = rank[a.impactHint] - rank[b.impactHint];
    if (d !== 0) return d;
    const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return tb - ta;
  });

  const upcomingWindow = calRes.events.filter(
    (e) => e.minutesUntil >= -15 && e.minutesUntil <= hours * 60,
  );

  return {
    news: allNews.slice(0, 50),
    newsErrors: [...customRes.errors, ...newsRes.errors],
    calendar: upcomingWindow,
    upcomingHighImpact: calRes.upcomingHighImpact.filter(
      (e) => e.minutesUntil >= -15 && e.minutesUntil <= hours * 60,
    ),
    xWatchlist: DEFAULT_X_WATCHLIST,
    fetchedAt: Date.now(),
    calendarError: calRes.error,
  };
}
