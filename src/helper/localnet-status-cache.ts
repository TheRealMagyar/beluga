import type {
  IkaChainReadiness,
  IkaLocalnetStatus,
} from "./ika-localnet/types";
import type { LocalNetworkStatus } from "./sui-localnet/types";

function platformTtl(win32Ms: number, defaultMs: number): number {
  return process.platform === "win32" ? win32Ms : defaultMs;
}

let networkStatusCache: {
  at: number;
  value: LocalNetworkStatus;
} | null = null;

export function invalidateLocalNetworkStatusCache() {
  networkStatusCache = null;
}

export function readCachedLocalNetworkStatus(): LocalNetworkStatus | null {
  const ttl = platformTtl(2_500, 1_200);
  if (!networkStatusCache || Date.now() - networkStatusCache.at >= ttl) {
    return null;
  }
  return networkStatusCache.value;
}

export function storeCachedLocalNetworkStatus(value: LocalNetworkStatus) {
  networkStatusCache = { at: Date.now(), value };
}

let ikaStatusCache: {
  at: number;
  value: IkaLocalnetStatus;
} | null = null;

export function invalidateIkaLocalnetStatusCache() {
  ikaStatusCache = null;
}

export function readCachedIkaLocalnetStatus(): IkaLocalnetStatus | null {
  const ttl = platformTtl(2_500, 1_200);
  if (!ikaStatusCache || Date.now() - ikaStatusCache.at >= ttl) {
    return null;
  }
  return ikaStatusCache.value;
}

export function storeCachedIkaLocalnetStatus(value: IkaLocalnetStatus) {
  ikaStatusCache = { at: Date.now(), value };
}

const readinessCache = new Map<
  string,
  { at: number; value: IkaChainReadiness }
>();

export function invalidateIkaReadinessCache() {
  readinessCache.clear();
}

export function readCachedIkaReadiness(
  key: string,
  dwalletReady: boolean,
): IkaChainReadiness | null {
  const entry = readinessCache.get(key);
  if (!entry) return null;
  const ttl = dwalletReady
    ? platformTtl(30_000, 15_000)
    : platformTtl(8_000, 4_000);
  if (Date.now() - entry.at >= ttl) return null;
  return entry.value;
}

export function storeCachedIkaReadiness(key: string, value: IkaChainReadiness) {
  readinessCache.set(key, { at: Date.now(), value });
}

let toolchainStatusCache: {
  at: number;
  value: unknown;
} | null = null;

export function invalidateToolchainStatusCache() {
  toolchainStatusCache = null;
}

export function readCachedToolchainStatus<T>(): T | null {
  const ttl = platformTtl(30_000, 15_000);
  if (!toolchainStatusCache || Date.now() - toolchainStatusCache.at >= ttl) {
    return null;
  }
  return toolchainStatusCache.value as T;
}

export function storeCachedToolchainStatus(value: unknown) {
  toolchainStatusCache = { at: Date.now(), value };
}