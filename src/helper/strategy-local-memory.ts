/**
 * Strategy-agent notes: prefer Walrus on-chain; queue locally only while uploads fail
 * (e.g. 503 pause), then flush to chain when the relayer accepts again.
 */
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import {
  remember as walrusRemember,
  type WalrusCredentials,
} from "./walrus-memory";

export type LocalMemoryNote = {
  id: string;
  namespace: string;
  accountId: string;
  /** network needed to flush */
  network: "mainnet" | "testnet";
  /** delegate key needed to flush (stored only for pending queue) */
  delegateKey: string;
  text: string;
  createdAt: number;
  kind?: string;
  /** pending_onchain = waiting for Walrus; synced = on Walrus */
  status: "pending_onchain" | "synced";
  blob_id?: string;
};

type StoreFile = {
  notes: LocalMemoryNote[];
};

function storePath(): string {
  return path.join(app.getPath("userData"), "strategy-agent-memory.json");
}

function readStore(): StoreFile {
  try {
    const p = storePath();
    if (!fs.existsSync(p)) return { notes: [] };
    const raw = fs.readFileSync(p, "utf8");
    const parsed = JSON.parse(raw) as StoreFile;
    if (!parsed || !Array.isArray(parsed.notes)) return { notes: [] };
    return parsed;
  } catch {
    return { notes: [] };
  }
}

function writeStore(store: StoreFile) {
  const p = storePath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (store.notes.length > 3000) {
    // Keep pending forever priority; trim oldest synced first
    const pending = store.notes.filter((n) => n.status === "pending_onchain");
    const synced = store.notes
      .filter((n) => n.status === "synced")
      .slice(-1500);
    store.notes = [...pending, ...synced];
  }
  fs.writeFileSync(p, JSON.stringify(store, null, 2), "utf8");
}

export function isWalrusUploadPausedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  return (
    lower.includes("paused") ||
    lower.includes("security upgrade") ||
    lower.includes("new uploads") ||
    lower.includes("503") ||
    lower.includes("service unavailable")
  );
}

/** Queue a note that still needs on-chain upload. */
export function enqueuePendingOnchain(params: {
  namespace: string;
  accountId: string;
  network: "mainnet" | "testnet";
  delegateKey: string;
  text: string;
  kind?: string;
}): LocalMemoryNote {
  const store = readStore();
  const note: LocalMemoryNote = {
    id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    namespace: params.namespace,
    accountId: params.accountId,
    network: params.network,
    delegateKey: params.delegateKey,
    text: params.text,
    createdAt: Date.now(),
    kind: params.kind,
    status: "pending_onchain",
  };
  store.notes.push(note);
  writeStore(store);
  return note;
}

/** Mark note as successfully on Walrus. */
export function markNoteSynced(localId: string, blobId: string) {
  const store = readStore();
  const n = store.notes.find((x) => x.id === localId);
  if (!n) return;
  n.status = "synced";
  n.blob_id = blobId;
  // Drop sensitive key once synced
  n.delegateKey = "";
  writeStore(store);
}

export function pendingOnchainCount(namespace?: string): number {
  return readStore().notes.filter(
    (n) =>
      n.status === "pending_onchain" &&
      (!namespace || n.namespace === namespace),
  ).length;
}

export function localNoteCount(namespace: string): number {
  return readStore().notes.filter((n) => n.namespace === namespace).length;
}

/**
 * Push all pending notes to Walrus. Returns how many uploaded / failed.
 * Call on every remember/recall/agent tick so notes go on-chain as soon as service allows.
 */
export async function flushPendingToWalrus(opts?: {
  namespace?: string;
  maxBatch?: number;
}): Promise<{
  uploaded: number;
  failed: number;
  remaining: number;
  lastError?: string;
  paused?: boolean;
}> {
  const maxBatch = opts?.maxBatch ?? 10;
  const store = readStore();
  const pending = store.notes.filter(
    (n) =>
      n.status === "pending_onchain" &&
      n.delegateKey &&
      (!opts?.namespace || n.namespace === opts.namespace),
  );

  let uploaded = 0;
  let failed = 0;
  let lastError: string | undefined;
  let paused = false;

  for (const note of pending.slice(0, maxBatch)) {
    try {
      const creds: WalrusCredentials = {
        accountId: note.accountId,
        delegateKey: note.delegateKey,
        network: note.network,
        namespace: note.namespace,
      };
      const result = await walrusRemember(creds, note.text);
      markNoteSynced(note.id, result.blob_id);
      uploaded += 1;
    } catch (err) {
      failed += 1;
      lastError = err instanceof Error ? err.message : String(err);
      if (isWalrusUploadPausedError(err)) {
        paused = true;
        // No point hammering during pause
        break;
      }
    }
  }

  return {
    uploaded,
    failed,
    remaining: pendingOnchainCount(opts?.namespace),
    lastError,
    paused,
  };
}

/** Keyword recall over local (pending + synced copy) notes. */
export function localRecall(params: {
  namespace: string;
  accountId?: string;
  query: string;
  limit?: number;
}): Array<{ text: string; relevance: number; blob_id: string; source: "local" }> {
  const limit = Math.min(Math.max(params.limit ?? 5, 1), 30);
  const store = readStore();
  const tokens = params.query
    .toLowerCase()
    .split(/[^a-z0-9áéíóöőúüű]+/i)
    .filter((t) => t.length > 2);

  const scored = store.notes
    .filter((n) => n.namespace === params.namespace)
    .filter((n) => !params.accountId || n.accountId === params.accountId)
    .map((n) => {
      const hay = n.text.toLowerCase();
      let hits = 0;
      for (const t of tokens) {
        if (hay.includes(t)) hits += 1;
      }
      const ageBoost = Math.max(
        0,
        10 - (Date.now() - n.createdAt) / (1000 * 60 * 60 * 24),
      );
      const relevance =
        tokens.length === 0
          ? 50 + ageBoost
          : Math.min(99, Math.round((hits / tokens.length) * 80 + ageBoost));
      return {
        text: n.text,
        relevance,
        blob_id: n.blob_id || n.id,
        source: "local" as const,
        createdAt: n.createdAt,
        status: n.status,
      };
    })
    .filter((n) => tokens.length === 0 || n.relevance > 15)
    .sort((a, b) => b.relevance - a.relevance || b.createdAt - a.createdAt)
    .slice(0, limit);

  return scored.map(({ text, relevance, blob_id, source }) => ({
    text,
    relevance,
    blob_id,
    source,
  }));
}

/** @deprecated name — use enqueuePendingOnchain */
export function localRemember(params: {
  namespace: string;
  accountId: string;
  text: string;
  kind?: string;
  network?: "mainnet" | "testnet";
  delegateKey?: string;
}): LocalMemoryNote {
  return enqueuePendingOnchain({
    namespace: params.namespace,
    accountId: params.accountId,
    network: params.network || "mainnet",
    delegateKey: params.delegateKey || "",
    text: params.text,
    kind: params.kind,
  });
}
