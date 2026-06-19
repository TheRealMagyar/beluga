import type { MemoryEntry } from "./types";

export const ENTRIES_KEY = "memwal-entries-v1";

export function loadEntries(): MemoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ENTRIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveEntries(entries: MemoryEntry[]) {
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function shortHex(s: string, head = 8, tail = 6) {
  if (!s) return "";
  if (s.length <= head + tail + 3) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

/** Deterministic accent hue derived from an entry id string. */
export function hueFromString(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

export async function findExistingAccount(
  ownerAddress: string,
  rpc: string,
  packageId: string,
): Promise<string | null> {
  try {
    const res = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "suix_queryEvents",
        params: [
          { MoveEventType: `${packageId}::account::AccountCreated` },
          null,
          50,
          false,
        ],
      }),
    });
    const data = await res.json();
    const events = data?.result?.data ?? [];
    for (const ev of events) {
      const parsed = ev?.parsedJson;
      if (
        parsed?.owner === ownerAddress ||
        parsed?.owner_address === ownerAddress
      ) {
        return parsed?.account_id ?? parsed?.account ?? null;
      }
    }
    return null;
  } catch {
    return null;
  }
}
