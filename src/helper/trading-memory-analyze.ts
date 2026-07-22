/**
 * Pull strategy-linked Walrus + local fallback memories and build a report.
 */
import { recall as walrusRecall, type WalrusCredentials } from "./walrus-memory";
import { localNoteCount, localRecall } from "./strategy-local-memory";
import type { SessionMemoryCred } from "./trading-agent-tools";

export type MemoryHit = {
  kind: string;
  relevance: number;
  text: string;
  blob_id: string;
  sourceQuery: string;
};

export type MemoryAnalyzeReport = {
  memoryLabel: string;
  namespace: string;
  network: string;
  totalUnique: number;
  byKind: Record<string, number>;
  hits: MemoryHit[];
  outcomes: MemoryHit[];
  mistakes: MemoryHit[];
  improvements: MemoryHit[];
  setups: MemoryHit[];
  risk: MemoryHit[];
  other: MemoryHit[];
  statsText: string;
};

const KIND_RE =
  /\[strategy-agent\]\[(observation|improvement|mistake|outcome|setup|risk)\]/i;

const QUERIES: { key: string; q: string }[] = [
  { key: "outcomes", q: "demo postmortem outcome PnL results equity trades" },
  { key: "mistakes", q: "mistake error failed wrong loss bad entry" },
  { key: "improvements", q: "improvement improve better next lesson change" },
  { key: "setups", q: "setup entry exit scalp BOS FVG structure confluence" },
  { key: "risk", q: "risk stop loss size overtrade leverage" },
  { key: "general", q: "strategy-agent trading SUI USDC lessons observations" },
];

function detectKind(text: string, fallback: string): string {
  const m = text.match(KIND_RE);
  if (m?.[1]) return m[1].toLowerCase();
  const lower = text.toLowerCase();
  if (lower.includes("postmortem") || lower.includes("pnl")) return "outcome";
  if (lower.includes("mistake") || lower.includes("failed")) return "mistake";
  if (lower.includes("improve") || lower.includes("lesson")) return "improvement";
  if (lower.includes("setup") || lower.includes("entry")) return "setup";
  if (lower.includes("risk") || lower.includes("stop")) return "risk";
  return fallback === "general" ? "observation" : fallback.replace(/s$/, "") || "observation";
}

function toCreds(m: SessionMemoryCred): WalrusCredentials {
  return {
    accountId: m.accountId,
    delegateKey: m.delegateKey,
    network: m.network,
    namespace: m.namespace,
  };
}

export async function gatherStrategyMemoryReport(
  memory: SessionMemoryCred,
): Promise<MemoryAnalyzeReport> {
  const byBlob = new Map<string, MemoryHit>();
  const ns = memory.namespace;

  // Local fallback notes first (works while Walrus uploads are paused)
  try {
    const local = localRecall({
      namespace: ns,
      accountId: memory.accountId,
      query: "strategy agent outcome mistake improvement setup risk trade",
      limit: 40,
    });
    for (const r of local) {
      byBlob.set(r.blob_id, {
        kind: detectKind(r.text, "general"),
        relevance: r.relevance,
        text: r.text,
        blob_id: r.blob_id,
        sourceQuery: "local",
      });
    }
  } catch {
    /* ignore */
  }

  for (const { key, q } of QUERIES) {
    try {
      const res = await walrusRecall(toCreds(memory), q, { limit: 8 });
      for (const r of res.results) {
        const id = r.blob_id || `${r.text.slice(0, 40)}-${r.relevance}`;
        if (byBlob.has(id)) {
          const prev = byBlob.get(id)!;
          if (r.relevance > prev.relevance) {
            prev.relevance = r.relevance;
          }
          continue;
        }
        byBlob.set(id, {
          kind: detectKind(r.text, key),
          relevance: r.relevance,
          text: r.text,
          blob_id: r.blob_id,
          sourceQuery: key,
        });
      }
    } catch {
      // continue other queries (Walrus may be paused)
    }
  }

  const hits = [...byBlob.values()].sort((a, b) => b.relevance - a.relevance);
  const byKind: Record<string, number> = {};
  for (const h of hits) {
    byKind[h.kind] = (byKind[h.kind] || 0) + 1;
  }

  const bucket = (k: string) => hits.filter((h) => h.kind === k);
  const outcomes = bucket("outcome");
  const mistakes = bucket("mistake");
  const improvements = bucket("improvement");
  const setups = bucket("setup");
  const risk = bucket("risk");
  const other = hits.filter(
    (h) =>
      !["outcome", "mistake", "improvement", "setup", "risk"].includes(h.kind),
  );

  const statsText = [
    `Memory: ${memory.label} (${memory.network}) · ns=${memory.namespace}`,
    `Unique notes: ${hits.length} (local store: ${localNoteCount(ns)})`,
    `By kind: ${Object.entries(byKind)
      .map(([k, n]) => `${k}=${n}`)
      .join(", ") || "none"}`,
    `Outcomes: ${outcomes.length} · Mistakes: ${mistakes.length} · Improvements: ${improvements.length}`,
    `Note: if Walrus uploads are paused (503), new notes are kept in local strategy store.`,
  ].join("\n");

  return {
    memoryLabel: memory.label,
    namespace: memory.namespace,
    network: memory.network,
    totalUnique: hits.length,
    byKind,
    hits,
    outcomes,
    mistakes,
    improvements,
    setups,
    risk,
    other,
    statsText,
  };
}

/** Compact text for the AI synthesizer. */
export function reportToPromptContext(report: MemoryAnalyzeReport): string {
  const section = (title: string, list: MemoryHit[], max = 6) => {
    if (!list.length) return `${title}: (none)\n`;
    return (
      `${title} (${list.length}):\n` +
      list
        .slice(0, max)
        .map(
          (h, i) =>
            `  ${i + 1}. [${h.relevance}%] ${h.text.slice(0, 350).replace(/\n/g, " ")}`,
        )
        .join("\n") +
      "\n"
    );
  };

  return [
    report.statsText,
    "",
    section("OUTCOMES / POSTMORTEMS", report.outcomes),
    section("MISTAKES", report.mistakes),
    section("IMPROVEMENTS", report.improvements),
    section("SETUPS", report.setups),
    section("RISK NOTES", report.risk),
    section("OTHER", report.other, 4),
  ].join("\n");
}

export function buildMemoryAnalysisSystemPrompt(strategyBlock: string): string {
  return `You are a trading strategy memory analyst for Beluga.
Given recalled Walrus Memory notes from past agent runs (demo/live), produce a clear Hungarian-friendly but technical English report for the trader.

## Strategy
${strategyBlock || "(unknown)"}

## Output structure (markdown, concise)
1. **Executive summary** — 2–4 sentences on overall performance themes
2. **What worked** — bullet list from outcomes/improvements
3. **What failed** — mistakes, bad setups, risk issues
4. **Concrete improvements** — actionable rule tweaks for the strategy (entry/exit/size/timing)
5. **Patterns** — recurring motifs (e.g. late entries, overtrading 1s scalps)
6. **Next session checklist** — 3–5 items the agent should follow next run

Only use the provided memory excerpts. If empty, say so and suggest what the agent should start remembering.`;
}
