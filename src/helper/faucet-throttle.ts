/** Prevents accidental double-clicks — does NOT rate-limit testnet (Mysten does that). */
const DEBOUNCE_MS = 3_000;
const STORAGE_KEY = "beluga-faucet-throttle-v1";

type FaucetThrottleState = {
  lastRequestAt: number;
};

function loadState(): FaucetThrottleState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { lastRequestAt: 0 };
    const parsed = JSON.parse(raw) as Partial<FaucetThrottleState>;
    return { lastRequestAt: parsed.lastRequestAt ?? 0 };
  } catch {
    return { lastRequestAt: 0 };
  }
}

function saveState(state: FaucetThrottleState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function isFaucetRateLimitError(message: string): boolean {
  return /too many requests/i.test(message);
}

export function formatFaucetRateLimitMessage(network: string): string {
  return (
    `Mysten's official ${network} faucet rejected the request (IP rate limit — not Beluga). ` +
    `Wait ~1 minute, or use Localnet for unlimited faucet SUI during sandbox testing.`
  );
}

export function checkFaucetThrottle(): {
  allowed: boolean;
  waitSeconds?: number;
} {
  const now = Date.now();
  const state = loadState();
  const elapsed = now - state.lastRequestAt;

  if (state.lastRequestAt > 0 && elapsed < DEBOUNCE_MS) {
    return {
      allowed: false,
      waitSeconds: Math.ceil((DEBOUNCE_MS - elapsed) / 1000),
    };
  }

  return { allowed: true };
}

export function markFaucetRequested() {
  saveState({ lastRequestAt: Date.now() });
}

export function faucetDebounceMessage(
  waitSeconds: number,
  networkLabel: string,
): string {
  return `Faucet request already sent — wait ${waitSeconds}s before retrying ${networkLabel}.`;
}