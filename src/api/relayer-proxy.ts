import http from "node:http";

const PROXIES = {
  mainnet: {
    target: "https://relayer.memory.walrus.xyz",
    port: 47821,
  },
  testnet: {
    target: "https://relayer-staging.memory.walrus.xyz",
    port: 47822,
  },
} as const;

const FORWARDED_HEADERS = [
  "content-type",
  "x-public-key",
  "x-signature",
  "x-timestamp",
  "x-nonce",
  "x-delegate-key",
  "x-seal-session",
  "authorization",
  "x-account-id",
];

const servers: Map<string, http.Server> = new Map();

function createProxy(target: string, port: number): void {
  const server = http.createServer(async (req, res) => {
    const url = `${target}${req.url}`;
    console.log(`[Proxy:${port}] ${req.method} → ${url}`);

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": FORWARDED_HEADERS.join(", "),
      });
      res.end();
      return;
    }

    const headers: Record<string, string> = {};
    for (const key of FORWARDED_HEADERS) {
      const val = req.headers[key];
      if (val) headers[key] = val as string;
    }

    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", async () => {
      try {
        const body = ["GET", "HEAD"].includes(req.method ?? "")
          ? undefined
          : Buffer.concat(chunks);

        const upstream = await fetch(url, {
          method: req.method,
          headers,
          body,
        });
        const text = await upstream.text();
        console.log(
          `[Proxy:${port}] ${upstream.status}: ${text.slice(0, 200)}`,
        );

        res.writeHead(upstream.status, {
          "Content-Type":
            upstream.headers.get("content-type") ?? "application/json",
          "Access-Control-Allow-Origin": "*",
        });
        res.end(text);
      } catch (e: any) {
        console.error(`[Proxy:${port}] Hiba:`, e);
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`[Proxy] ${target} → http://127.0.0.1:${port}`);
  });

  servers.set(String(port), server);
}

export function startRelayerProxy(): void {
  createProxy(PROXIES.mainnet.target, PROXIES.mainnet.port);
  createProxy(PROXIES.testnet.target, PROXIES.testnet.port);
}

export function stopRelayerProxy(): void {
  servers.forEach((server, port) => {
    server.close(() => console.log(`[Proxy:${port}] Leállítva`));
  });
  servers.clear();
}

export const RELAYER_URLS = {
  mainnet: `http://127.0.0.1:${PROXIES.mainnet.port}`,
  testnet: `http://127.0.0.1:${PROXIES.testnet.port}`,
} as const;
