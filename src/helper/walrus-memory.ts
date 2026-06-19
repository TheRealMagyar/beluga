import { MemWal } from "@mysten-incubation/memwal";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Network = "mainnet" | "testnet";

export interface WalrusCredentials {
  accountId: string;        // YOUR_ACCOUNT_ID  (0x...)
  delegateKey: string;      // YOUR_DELEGATE_PRIVATE_KEY (hex)
  network?: Network;        // default: "mainnet"
  namespace?: string;       // default: "default"
}

// health()
export interface HealthResult {
  status: string;
  version?: string;
  relayerVersion?: string;
  apiVersion?: string;
  ok: boolean;
}

// remember()
export interface RememberAcceptedResult {
  job_id: string;
  status: string;
}

// rememberAndWait() / remember_bulk() egyes elemei
export interface RememberResult {
  id: string;
  job_id: string;
  blob_id: string;
  owner: string;
  namespace: string;
}

export interface ProjectCredentials extends WalrusCredentials {
  entryId: string;
  label: string;
}

// remember_bulk() visszatérési értéke (egy elem)
export interface BulkRememberItem {
  text: string;
  result?: RememberResult;
  error?: string;
}

// recall()
export interface RecallResult {
  blob_id: string;
  text: string;
  distance: number;
  relevance: number;  // számított: Math.round((1 - distance) * 100)
}

export interface RecallOptions {
  limit?: number;         // default: 10
  namespace?: string;     // felülírja a credentials.namespace értékét
  maxDistance?: number;   // gyenge találatok kiszűrése
}

// analyze()
export interface AnalyzedFact {
  text: string;
  id: string;
  job_id?: string;
}

export interface AnalyzeResult {
  facts: AnalyzedFact[];
  fact_count: number;
  job_ids: string[];
  status: string;
  owner: string;
}

// restore()
export interface RestoreResult {
  restored: number;   // újonnan re-indexelt bejegyzések
  skipped: number;    // már DB-ben lévők
  total: number;      // összes on-chain blob
  namespace: string;
  owner: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

// A walrus-relayer-proxy.ts által indított lokális proxy portok
const RELAYER_URLS: Record<Network, string> = {
  mainnet: "http://127.0.0.1:47821",
  testnet: "http://127.0.0.1:47822",
};

// ─── Internal: kliens gyártó ──────────────────────────────────────────────────

function createClient(creds: WalrusCredentials): MemWal {
  const network = creds.network ?? "mainnet";
  const namespace = creds.namespace ?? "default";
  return MemWal.create({
    key: creds.delegateKey,
    accountId: creds.accountId,
    serverUrl: RELAYER_URLS[network],
    namespace,
  });
}

// ─── Functions ────────────────────────────────────────────────────────────────

/**
 * Ellenőrzi a relayer kapcsolatot. Nem igényel autentikációt.
 */
export async function health(creds: WalrusCredentials): Promise<HealthResult> {
  const client = createClient(creds);
  const result = await client.health();
  return {
    status: result.status,
    version: result.version,
    relayerVersion: result.relayerVersion,
    apiVersion: result.apiVersion,
    ok: result.status === "ok",
  };
}

/**
 * Egyetlen szöveget ment el vektorként a Walrus hálózaton.
 * Megvárja, amíg a háttérjob teljesen lefut (rememberAndWait).
 */
export async function remember(
  creds: WalrusCredentials,
  text: string,
  namespace?: string,
): Promise<RememberResult> {
  const client = createClient(creds);
  const ns = namespace ?? creds.namespace ?? "default";
  const result = await client.rememberAndWait(text, ns);
  return result as RememberResult;
}

/**
 * Több szöveget ment el egyszerre a natív rememberBulkAndWait hívással.
 * Max 20 elem küldhető egy kérésben.
 * Visszaadja az összes eredményt (sikeres és hibás egyaránt jelölve).
 */
export async function remember_bulk(
  creds: WalrusCredentials,
  texts: string[],
  namespace?: string,
): Promise<BulkRememberItem[]> {
  const client = createClient(creds);
  const ns = namespace ?? creds.namespace ?? "default";

  const items = texts.map((text) => ({ text, namespace: ns }));
  const bulkResult = await client.rememberBulkAndWait(items);

  // A bulkResult.results egy per-job tömb, sorrendben megfelel az items tömbnek
  const results: any[] = (bulkResult as any).results ?? [];

  return texts.map((text, i) => {
    const r = results[i];
    if (!r || r.status === "failed") {
      return { text, error: r?.error ?? "unknown error" };
    }
    return { text, result: r as RememberResult };
  });
}

/**
 * Szemantikus keresés természetes nyelvű lekérdezéssel.
 * A `relevance` mező számított érték: Math.round((1 - distance) * 100).
 */
export async function recall(
  creds: WalrusCredentials,
  query: string,
  options?: RecallOptions,
): Promise<{ results: RecallResult[]; total: number }> {
  const client = createClient(creds);
  const ns = options?.namespace ?? creds.namespace ?? "default";
  const limit = options?.limit ?? 10;

  const raw = await client.recall({
    query,
    limit,
    namespace: ns,
    ...(options?.maxDistance !== undefined && { maxDistance: options.maxDistance }),
  });

  const results: RecallResult[] = (raw.results ?? []).map((r: any) => ({
    blob_id: r.blob_id,
    text: r.text,
    distance: r.distance,
    relevance: Math.round((1 - r.distance) * 100),
  }));

  return { results, total: raw.total ?? results.length };
}

/**
 * AI-alapú tény-kinyerés: az LLM kiszedi a tényeket a szövegből,
 * majd háttérben mindegyiket külön memóriaként menti.
 * (fire-and-forget jellegű — ha meg kell várni, használj analyzeAndWait-et)
 */
export async function analyze(
  creds: WalrusCredentials,
  text: string,
  namespace?: string,
): Promise<AnalyzeResult> {
  const client = createClient(creds);
  const ns = namespace ?? creds.namespace ?? "default";
  const result = await client.analyze(text, ns);

  const facts: AnalyzedFact[] = (result.facts ?? []).map((f: any) => ({
    text: f.text,
    id: f.id,
    job_id: f.job_id,
  }));

  return {
    facts,
    fact_count: result.fact_count ?? facts.length,
    job_ids: result.job_ids ?? [],
    status: result.status ?? "pending",
    owner: result.owner ?? "",
  };
}

/**
 * Visszaindexeli a hiányzó bejegyzéseket egy namespace-ben a Walrus hálózatról.
 * NEM blob_id alapján tölt vissza szöveget — arra a recall() való.
 * Inkrementális: csak a már nem DB-ben lévő blobokat indexeli újra.
 */
export async function restore(
  creds: WalrusCredentials,
  namespace?: string,
  limit?: number,
): Promise<RestoreResult> {
  const client = createClient(creds);
  const ns = namespace ?? creds.namespace ?? "default";
  const result = await client.restore(ns, limit);
  return result as RestoreResult;
}