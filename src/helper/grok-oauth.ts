import { createHash, randomBytes } from "crypto";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "http";
import { promises as fs } from "fs";
import * as path from "path";
import * as os from "os";
import { app, shell } from "electron";

export const GROK_OAUTH_CLIENT_ID = "b1a00492-073a-47ea-816f-4c329264a828";
export const GROK_OAUTH_ISSUER = "https://auth.x.ai";
export const GROK_OAUTH_REDIRECT_URI = "http://127.0.0.1:56121/callback";
export const GROK_CLI_AUTH_KEY = `${GROK_OAUTH_ISSUER}::${GROK_OAUTH_CLIENT_ID}`;
export const GROK_OAUTH_SCOPES =
  "openid profile email offline_access grok-cli:access api:access";

const TOKEN_ENDPOINT = `${GROK_OAUTH_ISSUER}/oauth2/token`;
const AUTHORIZE_ENDPOINT = `${GROK_OAUTH_ISSUER}/oauth2/authorize`;
const CALLBACK_PORT = 56121;
const EXPIRY_BUFFER_MS = 60_000;
const PENDING_TTL_MS = 10 * 60_000;

export interface GrokOAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  email?: string;
  source: "beluga" | "grok-cli";
}

export interface GrokOAuthStatus {
  connected: boolean;
  email: string | null;
  expiresAt: string | null;
  source: "beluga" | "grok-cli" | null;
}

interface PendingOAuth {
  state: string;
  codeVerifier: string;
  createdAt: number;
}

interface GrokCliAuthEntry {
  key?: string;
  refresh_token?: string;
  expires_at?: string;
  email?: string;
}

let callbackServer: Server | null = null;
let loginCompleteHandler: ((ok: boolean, message: string) => void) | null =
  null;

function belugaConfigDir(): string {
  return path.join(app.getPath("userData"), "grok-oauth");
}

function belugaTokensPath(): string {
  return path.join(belugaConfigDir(), "tokens.json");
}

function pendingOAuthPath(): string {
  return path.join(belugaConfigDir(), "pending.json");
}

function grokCliAuthPath(): string {
  return path.join(os.homedir(), ".grok", "auth.json");
}

function base64Url(bytes: Buffer): string {
  return bytes
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function generateCodeVerifier(): string {
  return base64Url(randomBytes(32));
}

function generateCodeChallenge(verifier: string): string {
  return base64Url(createHash("sha256").update(verifier).digest());
}

function isExpired(expiresAt: string | undefined): boolean {
  if (!expiresAt) return true;
  const ts = Date.parse(expiresAt);
  if (Number.isNaN(ts)) return true;
  return Date.now() >= ts - EXPIRY_BUFFER_MS;
}

function expiresAtFromSeconds(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

async function ensureConfigDir(): Promise<void> {
  await fs.mkdir(belugaConfigDir(), { recursive: true });
}

async function readBelugaTokens(): Promise<GrokOAuthTokens | null> {
  try {
    const raw = await fs.readFile(belugaTokensPath(), "utf8");
    const parsed = JSON.parse(raw) as GrokOAuthTokens;
    if (!parsed.accessToken || !parsed.refreshToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeBelugaTokens(tokens: GrokOAuthTokens): Promise<void> {
  await ensureConfigDir();
  await fs.writeFile(belugaTokensPath(), JSON.stringify(tokens, null, 2), {
    mode: 0o600,
  });
}

async function readGrokCliTokens(): Promise<GrokOAuthTokens | null> {
  try {
    const raw = await fs.readFile(grokCliAuthPath(), "utf8");
    const parsed = JSON.parse(raw) as Record<string, GrokCliAuthEntry>;
    const entry = parsed[GROK_CLI_AUTH_KEY];
    if (!entry?.key || !entry.refresh_token) return null;
    return {
      accessToken: entry.key,
      refreshToken: entry.refresh_token,
      expiresAt: entry.expires_at ?? "",
      email: entry.email,
      source: "grok-cli",
    };
  } catch {
    return null;
  }
}

async function savePendingOAuth(pending: PendingOAuth): Promise<void> {
  await ensureConfigDir();
  await fs.writeFile(pendingOAuthPath(), JSON.stringify(pending), { mode: 0o600 });
}

async function readPendingOAuth(): Promise<PendingOAuth | null> {
  try {
    const raw = await fs.readFile(pendingOAuthPath(), "utf8");
    const pending = JSON.parse(raw) as PendingOAuth;
    if (Date.now() - pending.createdAt > PENDING_TTL_MS) return null;
    return pending;
  } catch {
    return null;
  }
}

async function clearPendingOAuth(): Promise<void> {
  try {
    await fs.unlink(pendingOAuthPath());
  } catch {
    // ignore
  }
}

async function refreshTokens(
  refreshToken: string,
): Promise<Omit<GrokOAuthTokens, "source">> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: GROK_OAUTH_CLIENT_ID,
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      extractOAuthError(text) ??
        `Token refresh failed (${res.status}). Sign in again.`,
    );
  }

  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!data.access_token) {
    throw new Error("Token refresh returned no access token.");
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: expiresAtFromSeconds(data.expires_in ?? 3600),
  };
}

function extractOAuthError(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as {
      error?: string;
      error_description?: string;
      message?: string;
    };
    return (
      parsed.error_description ??
      parsed.message ??
      (parsed.error ? `OAuth error: ${parsed.error}` : null)
    );
  } catch {
    return null;
  }
}

async function exchangeAuthorizationCode(
  code: string,
  codeVerifier: string,
): Promise<GrokOAuthTokens> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: GROK_OAUTH_REDIRECT_URI,
    client_id: GROK_OAUTH_CLIENT_ID,
    code_verifier: codeVerifier,
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      extractOAuthError(text) ??
        `Login failed (${res.status}). Try signing in again.`,
    );
  }

  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!data.access_token || !data.refresh_token) {
    throw new Error("Login succeeded but tokens were missing.");
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: expiresAtFromSeconds(data.expires_in ?? 3600),
    source: "beluga",
  };
}

function decodeJwtEmail(token: string): string | undefined {
  try {
    const payload = token.split(".")[1];
    if (!payload) return undefined;
    const json = JSON.parse(
      Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
        "utf8",
      ),
    ) as { email?: string };
    return json.email;
  } catch {
    return undefined;
  }
}

async function resolveValidTokens(): Promise<GrokOAuthTokens | null> {
  const beluga = await readBelugaTokens();
  if (beluga) {
    if (!isExpired(beluga.expiresAt)) return beluga;
    try {
      const refreshed = await refreshTokens(beluga.refreshToken);
      const next: GrokOAuthTokens = {
        ...refreshed,
        email: beluga.email ?? decodeJwtEmail(refreshed.accessToken),
        source: "beluga",
      };
      await writeBelugaTokens(next);
      return next;
    } catch {
      // fall through to grok-cli
    }
  }

  const cli = await readGrokCliTokens();
  if (!cli) return null;

  if (!isExpired(cli.expiresAt)) return cli;

  try {
    const refreshed = await refreshTokens(cli.refreshToken);
    const next: GrokOAuthTokens = {
      ...refreshed,
      email: cli.email ?? decodeJwtEmail(refreshed.accessToken),
      source: "beluga",
    };
    await writeBelugaTokens(next);
    return next;
  } catch {
    return null;
  }
}

export async function getGrokOAuthStatus(): Promise<GrokOAuthStatus> {
  const tokens = await resolveValidTokens();
  if (!tokens) {
    return {
      connected: false,
      email: null,
      expiresAt: null,
      source: null,
    };
  }

  return {
    connected: true,
    email: tokens.email ?? decodeJwtEmail(tokens.accessToken) ?? null,
    expiresAt: tokens.expiresAt || null,
    source: tokens.source,
  };
}

export async function getGrokOAuthAccessToken(): Promise<string | null> {
  const tokens = await resolveValidTokens();
  return tokens?.accessToken ?? null;
}

function buildAuthorizeUrl(state: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    client_id: GROK_OAUTH_CLIENT_ID,
    redirect_uri: GROK_OAUTH_REDIRECT_URI,
    response_type: "code",
    scope: GROK_OAUTH_SCOPES,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    plan: "generic",
    referrer: "beluga",
  });
  return `${AUTHORIZE_ENDPOINT}?${params.toString()}`;
}

function stopCallbackServer(): void {
  if (callbackServer) {
    callbackServer.close();
    callbackServer = null;
  }
}

function sendHtml(res: ServerResponse, title: string, body: string): void {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body style="font-family:system-ui;padding:2rem;background:#111;color:#eee">${body}</body></html>`,
  );
}

async function completeLoginFromCode(code: string): Promise<{
  ok: boolean;
  message: string;
}> {
  const pending = await readPendingOAuth();
  if (!pending) {
    return {
      ok: false,
      message: "No pending login. Click Sign in with Grok again.",
    };
  }

  try {
    const tokens = await exchangeAuthorizationCode(code, pending.codeVerifier);
    tokens.email = decodeJwtEmail(tokens.accessToken);
    await writeBelugaTokens(tokens);
    await clearPendingOAuth();
    stopCallbackServer();
    loginCompleteHandler?.(true, "Signed in with Grok Build.");
    return { ok: true, message: "Signed in with Grok Build." };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Login failed.";
    loginCompleteHandler?.(false, message);
    return { ok: false, message };
  }
}

function startCallbackServer(): void {
  stopCallbackServer();

  callbackServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", GROK_OAUTH_REDIRECT_URI);

    if (url.pathname !== "/callback") {
      res.writeHead(404);
      res.end();
      return;
    }

    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error) {
      const desc = url.searchParams.get("error_description") ?? error;
      sendHtml(res, "Beluga", `<h2>Sign-in failed</h2><p>${desc}</p>`);
      loginCompleteHandler?.(false, desc);
      stopCallbackServer();
      return;
    }

    if (!code) {
      sendHtml(
        res,
        "Beluga",
        "<h2>Missing authorization code</h2><p>Close this tab and try again from Beluga.</p>",
      );
      return;
    }

    const result = await completeLoginFromCode(code);
    if (result.ok) {
      sendHtml(
        res,
        "Beluga",
        "<h2>Signed in</h2><p>You can close this tab and return to Beluga.</p>",
      );
    } else {
      sendHtml(res, "Beluga", `<h2>Sign-in failed</h2><p>${result.message}</p>`);
    }
  });

  callbackServer.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      loginCompleteHandler?.(
        false,
        `Port ${CALLBACK_PORT} is in use. Paste the Grok Build code in Settings instead.`,
      );
    }
  });

  callbackServer.listen(CALLBACK_PORT, "127.0.0.1");
}

export function onGrokOAuthLoginComplete(
  handler: ((ok: boolean, message: string) => void) | null,
): void {
  loginCompleteHandler = handler;
}

export async function startGrokOAuthLogin(): Promise<{
  ok: boolean;
  authUrl?: string;
  message?: string;
}> {
  const state = base64Url(randomBytes(16));
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  await savePendingOAuth({
    state,
    codeVerifier,
    createdAt: Date.now(),
  });

  startCallbackServer();
  const authUrl = buildAuthorizeUrl(state, codeChallenge);
  await shell.openExternal(authUrl);

  return {
    ok: true,
    authUrl,
    message: "Browser opened. Sign in with your Grok / X account.",
  };
}

export async function exchangeGrokOAuthCode(code: string): Promise<{
  ok: boolean;
  message: string;
}> {
  const trimmed = code.trim();
  if (!trimmed) {
    return { ok: false, message: "Paste the Grok Build sign-in code." };
  }

  let authCode = trimmed;
  if (trimmed.includes("code=")) {
    try {
      const url = new URL(trimmed);
      const fromUrl = url.searchParams.get("code");
      if (fromUrl) authCode = fromUrl;
    } catch {
      const match = trimmed.match(/[?&]code=([^&]+)/);
      if (match?.[1]) authCode = decodeURIComponent(match[1]);
    }
  }

  return completeLoginFromCode(authCode);
}

export async function logoutGrokOAuth(): Promise<void> {
  stopCallbackServer();
  await clearPendingOAuth();
  try {
    await fs.unlink(belugaTokensPath());
  } catch {
    // ignore
  }
}

export async function testGrokOAuthConnection(model: string): Promise<{
  ok: boolean;
  message: string;
}> {
  const token = await getGrokOAuthAccessToken();
  if (!token) {
    const cliExists = await fs
      .access(grokCliAuthPath())
      .then(() => true)
      .catch(() => false);
    return {
      ok: false,
      message: cliExists
        ? "Grok CLI session found but token is expired. Run `grok` once to refresh, or sign in below."
        : "Not signed in. Use Sign in with Grok or run `grok` in a terminal first.",
    };
  }

  const res = await fetch("https://api.x.ai/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model,
      input: [{ role: "user", content: "ping" }],
      store: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    const detail = extractOAuthError(text) ?? text.slice(0, 180);
    if (res.status === 403) {
      return {
        ok: false,
        message:
          "Grok subscription does not include API access for this account. Try SuperGrok / X Premium+, or switch to API key mode.",
      };
    }
    return { ok: false, message: detail };
  }

  return { ok: true, message: `Connected via Grok Build (${model}).` };
}