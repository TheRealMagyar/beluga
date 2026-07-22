/**
 * Market Feeds — live news, calendar, X watchlist, impact check, custom endpoints.
 * Visual language matches Strategy / Charts trading pages.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Newspaper,
  AtSign,
  Sparkles,
  Rss,
  RefreshCw,
  ExternalLink,
  Plus,
  X,
  Trash2,
  AlertTriangle,
} from "lucide-react";

type Tab = "news" | "calendar" | "x" | "impact" | "custom";

type ImpactAssessment = {
  impact: "high" | "medium" | "low" | "unknown" | string;
  score: number;
  direction: "bullish" | "bearish" | "mixed" | "neutral" | string;
  confidence: number;
  assets: string[];
  catalysts: string[];
  timeHorizon: string;
  volatility: string;
  summary: string;
  tradingNotes: string[];
  mode: "heuristic" | "ai" | string;
};

type CustomEndpoint = {
  id: string;
  name: string;
  url: string;
  type: "rss" | "json";
  enabled: boolean;
  jsonPath?: string;
  titleKey?: string;
  linkKey?: string;
  dateKey?: string;
  summaryKey?: string;
};

type NewsItem = {
  id: string;
  source: string;
  title: string;
  summary?: string;
  link?: string;
  publishedAt?: string | null;
  tags?: string[];
  impactHint?: string;
  assets?: string[];
};

type CalEvent = {
  id: string;
  title: string;
  country?: string;
  impact?: string;
  date?: string;
  time?: string;
  forecast?: string;
  previous?: string;
  actual?: string;
  marketHint?: string;
};

const CUSTOM_KEY = "beluga-custom-feeds-v1";
const X_KEY = "beluga-feeds-x-watchlist-v1";

const inputCls =
  "w-full rounded-lg border border-[#2a2a3c] bg-[#0a0a0f] px-3 py-2.5 text-[13px] text-[#f0f0f5] placeholder:text-[#66667a] focus:border-[#6c63ff] focus:outline-none";
const labelCls = "mb-1 text-[11px] uppercase tracking-[0.5px] text-[#66667a]";
const cardCls = "rounded-2xl border border-white/[0.08] bg-[#111114]";
const btnPrimary =
  "rounded-xl border border-[#4ca3ff] bg-[#4ca3ff]/10 px-4 py-2 text-sm font-medium text-[#4ca3ff] hover:bg-[#4ca3ff]/15 disabled:opacity-40 disabled:cursor-not-allowed transition-colors";
const btnGhost =
  "rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-[#a0a0b8] hover:bg-white/[0.06] hover:text-[#e8e8f0] disabled:opacity-40 transition-colors";

function loadCustom(): CustomEndpoint[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

function loadX(): string[] {
  try {
    const raw = localStorage.getItem(X_KEY);
    if (!raw) {
      return [
        "elonmusk",
        "VitalikButerin",
        "SuiNetwork",
        "DeepBook_on_Sui",
        "cz_binance",
        "saylor",
      ];
    }
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p.map(String) : [];
  } catch {
    return [];
  }
}

function normalizeAssessment(
  raw: Record<string, unknown> | ImpactAssessment | null | undefined,
): ImpactAssessment | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const score = typeof r.score === "number" ? r.score : Number(r.score);
  if (!Number.isFinite(score)) return null;
  const notes = Array.isArray(r.tradingNotes)
    ? r.tradingNotes.map(String)
    : typeof r.tradingNotes === "string"
      ? [r.tradingNotes]
      : [];
  return {
    impact: String(r.impact || "unknown"),
    score,
    direction: String(r.direction || "neutral"),
    confidence: typeof r.confidence === "number" ? r.confidence : 0,
    assets: Array.isArray(r.assets) ? r.assets.map(String) : [],
    catalysts: Array.isArray(r.catalysts) ? r.catalysts.map(String) : [],
    timeHorizon: String(r.timeHorizon || "—"),
    volatility: String(r.volatility || "—"),
    summary: String(r.summary || ""),
    tradingNotes: notes,
    mode: String(r.mode || "heuristic"),
  };
}

function impactTone(level: string): string {
  const l = level.toLowerCase();
  if (l === "high") return "text-[#ff6b7a] border-[#ff6b7a]/30 bg-[#ff6b7a]/10";
  if (l === "medium") return "text-[#f0b429] border-[#f0b429]/30 bg-[#f0b429]/10";
  if (l === "low") return "text-[#4ca3ff] border-[#4ca3ff]/30 bg-[#4ca3ff]/10";
  return "text-[#66667a] border-white/[0.08] bg-white/[0.03]";
}

function dirTone(d: string): string {
  if (d === "bullish") return "text-[#3dd68c]";
  if (d === "bearish") return "text-[#ff6b7a]";
  if (d === "mixed") return "text-[#f0b429]";
  return "text-[#8888a0]";
}

function scoreColor(score: number): string {
  if (score >= 70) return "#ff6b7a";
  if (score >= 45) return "#f0b429";
  if (score >= 25) return "#4ca3ff";
  return "#66667a";
}

function formatWhen(iso?: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function TradingFeedsPage() {
  const [tab, setTab] = useState<Tab>("news");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calendarWarning, setCalendarWarning] = useState<string | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsErrors, setNewsErrors] = useState<string[]>([]);
  const [calendar, setCalendar] = useState<CalEvent[]>([]);
  const [xHandles, setXHandles] = useState(loadX);
  const [xInput, setXInput] = useState("");
  const [custom, setCustom] = useState<CustomEndpoint[]>(loadCustom);
  const [customForm, setCustomForm] = useState<Partial<CustomEndpoint>>({
    name: "",
    url: "",
    type: "rss",
    enabled: true,
    jsonPath: "items",
    titleKey: "title",
    linkKey: "url",
    dateKey: "published_at",
    summaryKey: "summary",
  });
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [assetHint, setAssetHint] = useState("SUI");
  const [assessment, setAssessment] = useState<ImpactAssessment | null>(null);
  const [assessLoading, setAssessLoading] = useState(false);
  const [assessPhase, setAssessPhase] = useState<"idle" | "heuristic" | "ai">(
    "idle",
  );
  const [aiSkipped, setAiSkipped] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const pendingRequestId = useRef<string | null>(null);

  const enabledCustom = useMemo(
    () =>
      custom
        .filter((c) => c.enabled && c.url.trim())
        .map((c) => ({
          id: c.id,
          name: c.name,
          url: c.url,
          type: c.type,
          enabled: true,
          jsonPath: c.jsonPath,
          titleKey: c.titleKey,
          linkKey: c.linkKey,
          dateKey: c.dateKey,
          summaryKey: c.summaryKey,
        })),
    [custom],
  );

  const enabledCustomCount = custom.filter((c) => c.enabled).length;

  const refresh = useCallback(async () => {
    if (!window.tradingFeeds?.snapshot) {
      setError("Feeds API unavailable — restart the app after update");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const snap = await window.tradingFeeds.snapshot({
        newsLimit: 8,
        calendarHours: 168,
        customEndpoints: enabledCustom,
      });
      if (!snap.ok) {
        setError(snap.error || "Failed to load feeds");
        return;
      }
      setNews((snap.news || []) as NewsItem[]);
      setNewsErrors(snap.newsErrors || []);
      setCalendar(snap.calendar || []);
      setLastUpdated(
        snap.fetchedAt
          ? new Date(
              typeof snap.fetchedAt === "number"
                ? snap.fetchedAt
                : Date.parse(String(snap.fetchedAt)),
            ).toISOString()
          : new Date().toISOString(),
      );
      // Only show calendar note when there's a real error AND no events
      const cal = snap.calendar || [];
      if (snap.calendarError && cal.length === 0) {
        setCalendarWarning(snap.calendarError);
      } else {
        setCalendarWarning(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [enabledCustom]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = window.setInterval(() => void refresh(), 90_000);
    return () => clearInterval(t);
  }, [autoRefresh, refresh]);

  useEffect(() => {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom));
  }, [custom]);

  useEffect(() => {
    localStorage.setItem(X_KEY, JSON.stringify(xHandles));
  }, [xHandles]);

  useEffect(() => {
    const offDone = window.belugaAi?.onStreamDone?.((payload) => {
      if (
        !pendingRequestId.current ||
        payload?.requestId !== pendingRequestId.current
      )
        return;
      pendingRequestId.current = null;
      const ia = normalizeAssessment(
        payload?.impactAssessment as ImpactAssessment | undefined,
      );
      if (ia) setAssessment(ia);
      setAssessPhase("idle");
      setAssessLoading(false);
    });
    const offErr = window.belugaAi?.onStreamError?.((payload) => {
      if (
        !pendingRequestId.current ||
        payload?.requestId !== pendingRequestId.current
      )
        return;
      pendingRequestId.current = null;
      const ia = normalizeAssessment(
        (payload as { impactAssessment?: ImpactAssessment })?.impactAssessment,
      );
      if (ia) setAssessment(ia);
      setAssessPhase("idle");
      setAssessLoading(false);
      if (payload?.message) setError(`AI refine: ${payload.message}`);
    });
    return () => {
      offDone?.();
      offErr?.();
    };
  }, []);

  const runImpact = async () => {
    if (!headline.trim() || !window.tradingFeeds?.assessImpact) return;
    setAssessLoading(true);
    setAssessPhase("heuristic");
    setError(null);
    setAiSkipped(null);
    setAssessment(null);
    pendingRequestId.current = null;

    const params = {
      headline: headline.trim(),
      body: body.trim() || undefined,
      assetHint: assetHint.trim() || undefined,
    };

    try {
      const h = await window.tradingFeeds.assessImpact(params);
      if (h.ok) {
        const ia = normalizeAssessment(h as unknown as ImpactAssessment);
        if (ia) setAssessment(ia);
      }

      setAssessPhase("ai");
      const requestId = `impact_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const ai = await window.tradingFeeds.assessImpactAi({
        ...params,
        requestId,
      });

      if (!ai.ok) {
        setAssessPhase("idle");
        setAssessLoading(false);
        if (!h.ok) setError(ai.error || "Impact check failed");
        return;
      }

      if (ai.assessment || typeof ai.score === "number") {
        const ia = normalizeAssessment(
          (ai.assessment || ai) as ImpactAssessment,
        );
        if (ia) setAssessment(ia);
      }

      if (ai.aiStreaming) {
        pendingRequestId.current = requestId;
        return;
      }

      if (ai.aiSkipped) setAiSkipped(ai.aiSkipped);
      setAssessPhase("idle");
      setAssessLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setAssessPhase("idle");
      setAssessLoading(false);
    }
  };

  const openImpactFromNews = (n: NewsItem) => {
    setHeadline(n.title);
    setBody(n.summary || "");
    if (n.assets?.[0] && n.assets[0] !== "CRYPTO") setAssetHint(n.assets[0]);
    setTab("impact");
  };

  const addCustom = () => {
    const name = (customForm.name || "").trim();
    const url = (customForm.url || "").trim();
    if (!name || !url) {
      setError("Custom feed needs name and URL");
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      setError("URL must start with http:// or https://");
      return;
    }
    const ep: CustomEndpoint = {
      id: `cf_${Date.now().toString(36)}`,
      name,
      url,
      type: customForm.type === "json" ? "json" : "rss",
      enabled: customForm.enabled !== false,
      jsonPath: customForm.jsonPath || "items",
      titleKey: customForm.titleKey || "title",
      linkKey: customForm.linkKey || "url",
      dateKey: customForm.dateKey || "published_at",
      summaryKey: customForm.summaryKey || "summary",
    };
    setCustom((prev) => [...prev, ep]);
    setCustomForm({
      name: "",
      url: "",
      type: "rss",
      enabled: true,
      jsonPath: "items",
      titleKey: "title",
      linkKey: "url",
      dateKey: "published_at",
      summaryKey: "summary",
    });
    setError(null);
  };

  const addXHandle = () => {
    const h = xInput.replace(/^@/, "").trim();
    if (h && !xHandles.includes(h)) setXHandles((p) => [...p, h]);
    setXInput("");
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: string }[] =
    [
      { id: "news", label: "News", icon: <Newspaper className="h-3.5 w-3.5" /> },
      {
        id: "calendar",
        label: "Calendar",
        icon: <CalendarDays className="h-3.5 w-3.5" />,
      },
      { id: "x", label: "X watchlist", icon: <AtSign className="h-3.5 w-3.5" /> },
      {
        id: "impact",
        label: "AI impact",
        icon: <Sparkles className="h-3.5 w-3.5" />,
      },
      {
        id: "custom",
        label: "Custom",
        icon: <Rss className="h-3.5 w-3.5" />,
        badge: enabledCustomCount > 0 ? String(enabledCustomCount) : undefined,
      },
    ];

  return (
    <div className="flex h-full flex-col bg-[#0a0a0f] text-[#e8e8f0]">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">Feeds</div>
            <div className="text-sm text-[#8888a0]">
              News · macro calendar · X · custom endpoints · impact desk
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-[#8888a0]">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-[#2a2a3c] bg-[#0a0a0f]"
              />
              Auto 90s
            </label>
            {lastUpdated && (
              <span className="text-[11px] text-[#55556a]">
                {formatWhen(lastUpdated)}
              </span>
            )}
            <button
              type="button"
              className={btnPrimary}
              disabled={loading}
              onClick={() => void refresh()}
            >
              <span className="inline-flex items-center gap-1.5">
                <RefreshCw
                  className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                />
                {loading ? "Loading…" : "Refresh"}
              </span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "border border-[#4ca3ff]/40 bg-[#4ca3ff]/12 text-[#4ca3ff]"
                    : "border border-transparent text-[#8888a0] hover:bg-white/[0.04] hover:text-[#c8c8d8]"
                }`}
              >
                {t.icon}
                {t.label}
                {t.badge && (
                  <span className="ml-0.5 rounded-full bg-[#4ca3ff]/20 px-1.5 py-0.5 text-[10px] tabular-nums">
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-6">
        {error && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-[#ff6b7a]/25 bg-[#ff6b7a]/08 px-4 py-3 text-sm text-[#ff9aa4]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">{error}</div>
            <button
              type="button"
              className="shrink-0 text-xs text-[#ff9aa4]/80 hover:text-[#ff9aa4]"
              onClick={() => setError(null)}
            >
              dismiss
            </button>
          </div>
        )}

        {tab === "news" && (
          <div className="space-y-3">
            {newsErrors.length > 0 && (
              <div className="rounded-xl border border-[#f0b429]/20 bg-[#f0b429]/08 px-4 py-2.5 text-xs text-[#f0b429]/90">
                Some sources failed: {newsErrors.slice(0, 3).join(" · ")}
                {newsErrors.length > 3 ? ` (+${newsErrors.length - 3})` : ""}
              </div>
            )}

            {news.length === 0 && !loading && (
              <EmptyState
                title="No headlines yet"
                hint="Add custom feeds or hit Refresh."
              />
            )}

            <div className={`${cardCls} overflow-hidden divide-y divide-white/[0.05]`}>
              {news.map((n) => (
                <article
                  key={n.id}
                  className="group px-5 py-4 transition-colors hover:bg-white/[0.02]"
                >
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#4ca3ff]">
                      {n.source}
                    </span>
                    {n.impactHint && n.impactHint !== "unknown" && (
                      <span
                        className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${impactTone(n.impactHint)}`}
                      >
                        {n.impactHint}
                      </span>
                    )}
                    {n.assets
                      ?.filter((a) => a !== "CRYPTO")
                      .slice(0, 3)
                      .map((a) => (
                        <span
                          key={a}
                          className="rounded-md border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 text-[10px] font-medium text-[#8888a0]"
                        >
                          {a}
                        </span>
                      ))}
                    {n.publishedAt && (
                      <span className="text-[11px] text-[#55556a]">
                        {formatWhen(n.publishedAt)}
                      </span>
                    )}
                    <div className="ml-auto flex items-center gap-1.5 opacity-70 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        className={btnGhost}
                        onClick={() => openImpactFromNews(n)}
                      >
                        <Sparkles className="mr-1 inline h-3 w-3" />
                        Impact
                      </button>
                      {n.link && (
                        <a
                          href={n.link}
                          target="_blank"
                          rel="noreferrer"
                          className={btnGhost}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                  {n.link ? (
                    <a
                      href={n.link}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-[14px] font-semibold leading-snug text-[#f0f0f5] hover:text-[#4ca3ff]"
                    >
                      {n.title}
                    </a>
                  ) : (
                    <div className="text-[14px] font-semibold leading-snug text-[#f0f0f5]">
                      {n.title}
                    </div>
                  )}
                  {n.summary && (
                    <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-[#8888a0]">
                      {n.summary}
                    </p>
                  )}
                </article>
              ))}
            </div>
          </div>
        )}

        {tab === "calendar" && (
          <div className="space-y-3">
            {calendarWarning && (
              <div className="rounded-xl border border-[#f0b429]/20 bg-[#f0b429]/08 px-4 py-2.5 text-xs text-[#f0b429]/90">
                {calendarWarning}
                {calendar.length > 0
                  ? " · Showing last successful fetch."
                  : ""}
              </div>
            )}
            <div className={`${cardCls} overflow-hidden`}>
            {calendar.length === 0 && !loading ? (
              <EmptyState
                title="No events in window"
                hint={
                  calendarWarning
                    ? "Calendar CDN is rate-limited — retry automatically in a while."
                    : "Calendar feed may be temporarily unavailable."
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-[11px] uppercase tracking-[0.5px] text-[#66667a]">
                      <th className="px-4 py-3 font-medium">When</th>
                      <th className="px-4 py-3 font-medium">Ccy</th>
                      <th className="px-4 py-3 font-medium">Impact</th>
                      <th className="px-4 py-3 font-medium">Event</th>
                      <th className="px-4 py-3 font-medium">Fcst</th>
                      <th className="px-4 py-3 font-medium">Prev</th>
                      <th className="px-4 py-3 font-medium">Act</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {calendar.map((e) => {
                      const imp = (e.impact || "").toLowerCase();
                      return (
                        <tr
                          key={e.id}
                          className="hover:bg-white/[0.02]"
                        >
                          <td className="whitespace-nowrap px-4 py-3 text-[#a0a0b8]">
                            {e.date} {e.time || ""}
                          </td>
                          <td className="px-4 py-3 font-medium text-[#c8c8d8]">
                            {e.country || "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase ${impactTone(imp)}`}
                            >
                              {e.impact || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-[#e8e8f0]">
                            {e.title}
                          </td>
                          <td className="px-4 py-3 text-[#66667a]">
                            {e.forecast || "—"}
                          </td>
                          <td className="px-4 py-3 text-[#66667a]">
                            {e.previous || "—"}
                          </td>
                          <td className="px-4 py-3 text-[#c8c8d8]">
                            {e.actual || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            </div>
          </div>
        )}

        {tab === "x" && (
          <div className="mx-auto max-w-2xl space-y-4">
            <div className={`${cardCls} p-5`}>
              <div className="mb-1 text-sm font-medium text-[#f4f4fa]">
                X watchlist
              </div>
              <p className="mb-4 text-xs leading-relaxed text-[#66667a]">
                Profiles open on x.com. Handles are stored locally and can feed
                agent context.
              </p>
              <div className="flex flex-wrap gap-2">
                <input
                  className={`${inputCls} min-w-[180px] flex-1`}
                  placeholder="@handle"
                  value={xInput}
                  onChange={(e) => setXInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addXHandle();
                  }}
                />
                <button type="button" className={btnPrimary} onClick={addXHandle}>
                  <Plus className="mr-1 inline h-3.5 w-3.5" />
                  Add
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {xHandles.map((h) => (
                <span
                  key={h}
                  className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-[#111114] py-1.5 pl-3 pr-1.5 text-[13px]"
                >
                  <a
                    href={`https://x.com/${h}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#4ca3ff] hover:underline"
                  >
                    @{h}
                  </a>
                  <button
                    type="button"
                    className="rounded-full p-1 text-[#66667a] hover:bg-white/[0.06] hover:text-[#ff6b7a]"
                    onClick={() =>
                      setXHandles((p) => p.filter((x) => x !== h))
                    }
                    aria-label={`Remove @${h}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
              {xHandles.length === 0 && (
                <EmptyState title="Empty watchlist" hint="Add a handle above." />
              )}
            </div>
          </div>
        )}

        {tab === "impact" && (
          <div className="mx-auto grid max-w-3xl gap-4 lg:grid-cols-[1fr_1fr]">
            <div className={`${cardCls} space-y-4 p-5 lg:col-span-2`}>
              <div>
                <div className="text-sm font-medium text-[#f4f4fa]">
                  Impact desk
                </div>
                <p className="mt-1 text-xs text-[#66667a]">
                  Keyword score first, then AI refine when signed in.
                </p>
              </div>
              <div>
                <div className={labelCls}>Headline</div>
                <input
                  className={inputCls}
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Paste headline or news title"
                />
              </div>
              <div>
                <div className={labelCls}>Body / context</div>
                <textarea
                  className={`${inputCls} min-h-[96px] resize-y`}
                  rows={4}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Extra context improves scoring"
                />
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-36">
                  <div className={labelCls}>Asset focus</div>
                  <input
                    className={inputCls}
                    value={assetHint}
                    onChange={(e) => setAssetHint(e.target.value)}
                    placeholder="SUI"
                  />
                </div>
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={assessLoading || !headline.trim()}
                  onClick={() => void runImpact()}
                >
                  {assessLoading
                    ? assessPhase === "ai"
                      ? "AI refining…"
                      : "Scoring…"
                    : "Run impact check"}
                </button>
              </div>
              {aiSkipped && (
                <p className="text-xs text-[#f0b429]">{aiSkipped}</p>
              )}
            </div>

            {assessment && (
              <div className={`${cardCls} space-y-5 p-5 lg:col-span-2`}>
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`rounded-lg border px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${impactTone(assessment.impact)}`}
                  >
                    {assessment.impact}
                  </span>
                  <span
                    className={`text-sm font-bold uppercase tracking-wide ${dirTone(assessment.direction)}`}
                  >
                    {assessment.direction}
                  </span>
                  <span className="text-[11px] text-[#55556a]">
                    {assessment.mode}
                    {assessPhase === "ai" ? " · refining…" : ""}
                  </span>
                </div>

                <div>
                  <div className="mb-2 flex items-end justify-between">
                    <span className="text-xs font-medium text-[#8888a0]">
                      Impact score
                    </span>
                    <span
                      className="text-xl font-bold tabular-nums"
                      style={{ color: scoreColor(assessment.score) }}
                    >
                      {assessment.score}
                      <span className="text-sm font-medium text-[#55556a]">
                        /100
                      </span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.max(0, assessment.score))}%`,
                        background: scoreColor(assessment.score),
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Metric
                    label="Confidence"
                    value={`${assessment.confidence ?? 0}%`}
                  />
                  <Metric
                    label="Horizon"
                    value={assessment.timeHorizon || "—"}
                  />
                  <Metric
                    label="Volatility"
                    value={assessment.volatility || "—"}
                  />
                </div>

                {assessment.assets?.length > 0 && (
                  <ChipRow label="Assets" items={assessment.assets} strong />
                )}
                {assessment.catalysts?.length > 0 && (
                  <ChipRow label="Catalysts" items={assessment.catalysts} />
                )}

                {assessment.summary && (
                  <p className="text-[13px] leading-relaxed text-[#c8c8d8]">
                    {assessment.summary}
                  </p>
                )}

                {assessment.tradingNotes?.length > 0 && (
                  <div className="rounded-xl border border-white/[0.06] bg-[#0a0a0f] px-4 py-3">
                    <div className={labelCls}>Trading notes</div>
                    <ul className="mt-1 space-y-1.5 text-[13px] leading-relaxed text-[#c8c8d8]">
                      {assessment.tradingNotes.map((n, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#4ca3ff]" />
                          <span>{n}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {!assessment && !assessLoading && (
              <div className="lg:col-span-2">
                <EmptyState
                  title="No assessment yet"
                  hint="Paste a headline or open Impact from a news item."
                />
              </div>
            )}
          </div>
        )}

        {tab === "custom" && (
          <div className="mx-auto max-w-2xl space-y-4">
            <div className={`${cardCls} space-y-4 p-5`}>
              <div>
                <div className="text-sm font-medium text-[#f4f4fa]">
                  Add custom endpoint
                </div>
                <p className="mt-1 text-xs text-[#66667a]">
                  RSS/Atom or JSON array API — merged into News on refresh.
                </p>
              </div>

              <div>
                <div className={labelCls}>Name</div>
                <input
                  className={inputCls}
                  value={customForm.name || ""}
                  onChange={(e) =>
                    setCustomForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="My alpha feed"
                />
              </div>
              <div>
                <div className={labelCls}>URL</div>
                <input
                  className={inputCls}
                  value={customForm.url || ""}
                  onChange={(e) =>
                    setCustomForm((f) => ({ ...f, url: e.target.value }))
                  }
                  placeholder="https://…/feed.xml"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className={labelCls}>Type</div>
                  <select
                    className={inputCls}
                    value={customForm.type || "rss"}
                    onChange={(e) =>
                      setCustomForm((f) => ({
                        ...f,
                        type: e.target.value as "rss" | "json",
                      }))
                    }
                  >
                    <option value="rss">RSS / Atom</option>
                    <option value="json">JSON API</option>
                  </select>
                </div>
                <label className="flex items-end gap-2 pb-2.5 text-xs text-[#8888a0]">
                  <input
                    type="checkbox"
                    checked={customForm.enabled !== false}
                    onChange={(e) =>
                      setCustomForm((f) => ({
                        ...f,
                        enabled: e.target.checked,
                      }))
                    }
                  />
                  Enabled after add
                </label>
              </div>

              {customForm.type === "json" && (
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-white/[0.06] bg-[#0a0a0f] p-3">
                  {(
                    [
                      ["jsonPath", "Array path", "items"],
                      ["titleKey", "Title key", "title"],
                      ["linkKey", "Link key", "url"],
                      ["dateKey", "Time key", "published_at"],
                      ["summaryKey", "Summary key", "summary"],
                    ] as const
                  ).map(([key, label, ph]) => (
                    <div key={key} className={key === "jsonPath" ? "col-span-2" : ""}>
                      <div className={labelCls}>{label}</div>
                      <input
                        className={inputCls}
                        value={
                          ((customForm as Record<string, string | boolean | undefined>)[
                            key
                          ] as string) || ""
                        }
                        onChange={(e) =>
                          setCustomForm((f) => ({
                            ...f,
                            [key]: e.target.value,
                          }))
                        }
                        placeholder={ph}
                      />
                    </div>
                  ))}
                </div>
              )}

              <button type="button" className={btnPrimary} onClick={addCustom}>
                <Plus className="mr-1 inline h-3.5 w-3.5" />
                Add feed
              </button>
            </div>

            <div className={`${cardCls} overflow-hidden divide-y divide-white/[0.05]`}>
              {custom.length === 0 ? (
                <EmptyState
                  title="No custom feeds"
                  hint="e.g. project blog Atom, CoinDesk RSS, your JSON list."
                />
              ) : (
                custom.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-start gap-3 px-4 py-3.5"
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={c.enabled}
                      onChange={(e) =>
                        setCustom((prev) =>
                          prev.map((x) =>
                            x.id === c.id
                              ? { ...x, enabled: e.target.checked }
                              : x,
                          ),
                        )
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-[#f0f0f5]">
                          {c.name}
                        </span>
                        <span className="rounded-md border border-white/[0.06] px-1.5 py-0.5 text-[10px] uppercase text-[#66667a]">
                          {c.type}
                        </span>
                      </div>
                      <code className="mt-0.5 block truncate text-[11px] text-[#55556a]">
                        {c.url}
                      </code>
                    </div>
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-[#66667a] hover:bg-[#ff6b7a]/10 hover:text-[#ff6b7a]"
                      onClick={() =>
                        setCustom((prev) => prev.filter((x) => x.id !== c.id))
                      }
                      aria-label="Remove feed"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {custom.length > 0 && (
              <button
                type="button"
                className={btnGhost}
                onClick={() => void refresh()}
              >
                <RefreshCw className="mr-1.5 inline h-3.5 w-3.5" />
                Refresh news with custom feeds
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="px-6 py-14 text-center">
      <div className="text-sm font-medium text-[#8888a0]">{title}</div>
      <div className="mt-1 text-xs text-[#55556a]">{hint}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0a0a0f] px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.5px] text-[#66667a]">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold capitalize text-[#e8e8f0]">
        {value}
      </div>
    </div>
  );
}

function ChipRow({
  label,
  items,
  strong,
}: {
  label: string;
  items: string[];
  strong?: boolean;
}) {
  return (
    <div>
      <div className={labelCls}>{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            className={`rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[11px] ${
              strong ? "font-semibold text-[#c8c8d8]" : "text-[#a0a0b8]"
            }`}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

