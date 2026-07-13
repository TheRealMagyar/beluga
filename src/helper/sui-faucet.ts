import http from "node:http";
import { getFaucetHost, requestSuiFromFaucetV2 } from "@mysten/sui/faucet";

export type FaucetNetwork = "testnet" | "devnet" | "localnet";

export type LocalFaucetProbeStatus =
  | "ready"
  | "not_listening"
  | "warming_up"
  | "misconfigured";

const FAUCET_PROBE_ADDRESS =
  "0x0000000000000000000000000000000000000000000000000000000000000001";

const DEFAULT_FAUCET_PROBE_HOSTS = [
  "http://127.0.0.1:9123",
  "http://localhost:9123",
];

type HttpResult = {
  statusCode: number;
  body: string;
};

function httpRequest(
  host: string,
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: string;
    timeoutMs?: number;
  } = {},
): Promise<HttpResult | null> {
  return new Promise((resolve) => {
    let url: URL;
    try {
      url = new URL(path, host);
    } catch {
      resolve(null);
      return;
    }

    const method = options.method ?? "GET";
    const body = options.body;
    const timeoutMs = options.timeoutMs ?? 5_000;

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method,
        headers: body
          ? {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(body),
            }
          : undefined,
        family: 4,
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          resolve({ statusCode: res.statusCode ?? 0, body: data });
        });
      },
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(null);
    });
    req.on("error", () => resolve(null));
    if (body) req.write(body);
    req.end();
  });
}

function isSuccessfulDispense(result: HttpResult): boolean {
  if (result.statusCode === 429) return true;
  if (result.statusCode < 200 || result.statusCode >= 300) return false;
  try {
    const payload = JSON.parse(result.body) as {
      status?: string | { Failure?: { internal?: string } };
      coins_sent?: unknown[];
    };
    if (payload.status === "Success") return true;
    if (Array.isArray(payload.coins_sent) && payload.coins_sent.length > 0) {
      return true;
    }
    return typeof payload.status === "object" && payload.status != null;
  } catch {
    return false;
  }
}

/** True when the faucet HTTP server responds on /. */
export async function probeLocalFaucetHealth(
  host = "http://127.0.0.1:9123",
): Promise<boolean> {
  const result = await httpRequest(host, "/", {
    method: "GET",
    timeoutMs: 3_000,
  });
  return result?.statusCode === 200 && result.body.trim() === "OK";
}

async function probeLocalFaucetStatusOnHost(
  host: string,
): Promise<LocalFaucetProbeStatus> {
  const health = await probeLocalFaucetHealth(host);
  const body = JSON.stringify({
    FixedAmountRequest: { recipient: FAUCET_PROBE_ADDRESS },
  });

  for (const path of ["/v2/gas", "/v1/gas", "/gas"]) {
    const result = await httpRequest(host, path, {
      method: "POST",
      body,
      timeoutMs: 8_000,
    });
    if (!result) continue;
    if (isSuccessfulDispense(result)) return "ready";
    if (result.statusCode === 500 && health) return "misconfigured";
  }

  if (health) return "warming_up";
  return "not_listening";
}

/** Detailed faucet readiness for startup diagnostics. */
export async function probeLocalFaucetStatus(
  host = "http://127.0.0.1:9123",
): Promise<LocalFaucetProbeStatus> {
  const hosts =
    host === "http://127.0.0.1:9123"
      ? DEFAULT_FAUCET_PROBE_HOSTS
      : [host];

  let sawWarming = false;
  let sawMisconfigured = false;
  for (const candidate of hosts) {
    const status = await probeLocalFaucetStatusOnHost(candidate);
    if (status === "ready") return "ready";
    if (status === "misconfigured") sawMisconfigured = true;
    if (status === "warming_up") sawWarming = true;
  }

  if (sawMisconfigured) return "misconfigured";
  if (sawWarming) return "warming_up";
  return "not_listening";
}

/** True when the local Sui faucet HTTP service accepts fund requests. */
export async function probeLocalFaucetReady(
  host = "http://127.0.0.1:9123",
): Promise<boolean> {
  return (await probeLocalFaucetStatus(host)) === "ready";
}

export async function requestFaucetCoins(
  network: FaucetNetwork,
  recipient: string,
) {
  if (network === "localnet") {
    return requestLocalFaucetCoins(recipient);
  }

  const host = getFaucetHost(network);
  const response = await requestSuiFromFaucetV2({ host, recipient });
  const amount =
    response.coins_sent?.reduce((sum, coin) => sum + coin.amount, 0) ?? 0;
  const digest = response.coins_sent?.[0]?.transferTxDigest ?? null;

  return {
    amountSui: amount / 1_000_000_000,
    digest,
    coinsSent: response.coins_sent?.length ?? 0,
  };
}

export async function requestLocalFaucetCoins(
  recipient: string,
  host = "http://127.0.0.1:9123",
) {
  const response = await requestSuiFromFaucetV2({ host, recipient });
  const amount =
    response.coins_sent?.reduce((sum, coin) => sum + coin.amount, 0) ?? 0;
  const digest = response.coins_sent?.[0]?.transferTxDigest ?? null;

  return {
    amountSui: amount / 1_000_000_000,
    digest,
    coinsSent: response.coins_sent?.length ?? 0,
    message:
      response.coins_sent?.length
        ? `Received ${(amount / 1_000_000_000).toFixed(2)} SUI on localnet.`
        : "Faucet request submitted.",
  };
}