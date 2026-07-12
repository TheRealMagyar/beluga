import { randomBytes, createHash } from "crypto";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "http";
import { promises as fs } from "fs";
import * as path from "path";
import { app, shell } from "electron";

export const GITHUB_OAUTH_REDIRECT_URI = "http://127.0.0.1:56122/callback";
const CALLBACK_PORT = 56122;
const GITHUB_AUTHORIZE = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN = "https://github.com/login/oauth/access_token";
const GITHUB_DEVICE_CODE = "https://github.com/login/device/code";
const DEFAULT_SCOPES = "repo read:user";

export interface GitHubTokens {
  accessToken: string;
  tokenType: string;
  scope: string;
  login?: string;
  source: "oauth" | "pat" | "device";
}

export interface GitHubAuthStatus {
  connected: boolean;
  login: string | null;
  scope: string | null;
  source: "oauth" | "pat" | "device" | null;
}

interface PendingOAuth {
  state: string;
  codeVerifier: string;
  clientId: string;
  clientSecret: string;
  createdAt: number;
}

interface PendingDevice {
  deviceCode: string;
  clientId: string;
  interval: number;
  expiresAt: number;
}

let callbackServer: Server | null = null;
let loginCompleteHandler: ((ok: boolean, message: string) => void) | null =
  null;

function githubConfigDir(): string {
  return path.join(app.getPath("userData"), "github-oauth");
}

function tokensPath(): string {
  return path.join(githubConfigDir(), "tokens.json");
}

function pendingOAuthPath(): string {
  return path.join(githubConfigDir(), "pending-oauth.json");
}

function pendingDevicePath(): string {
  return path.join(githubConfigDir(), "pending-device.json");
}

function base64Url(bytes: Buffer): string {
  return bytes
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function makePkce(): { verifier: string; challenge: string } {
  const verifier = base64Url(randomBytes(32));
  const challenge = base64Url(
    createHash("sha256").update(verifier).digest(),
  );
  return { verifier, challenge };
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

async function loadTokens(): Promise<GitHubTokens | null> {
  return readJson<GitHubTokens>(tokensPath());
}

async function saveTokens(tokens: GitHubTokens): Promise<void> {
  await writeJson(tokensPath(), tokens);
}

export async function getGitHubAccessToken(): Promise<string | null> {
  const tokens = await loadTokens();
  return tokens?.accessToken ?? null;
}

export async function getGitHubAuthStatus(): Promise<GitHubAuthStatus> {
  const tokens = await loadTokens();
  if (!tokens?.accessToken) {
    return {
      connected: false,
      login: null,
      scope: null,
      source: null,
    };
  }
  return {
    connected: true,
    login: tokens.login ?? null,
    scope: tokens.scope ?? null,
    source: tokens.source,
  };
}

export async function logoutGitHub(): Promise<void> {
  try {
    await fs.unlink(tokensPath());
  } catch {
    // ignore
  }
  try {
    await fs.unlink(pendingOAuthPath());
  } catch {
    // ignore
  }
  try {
    await fs.unlink(pendingDevicePath());
  } catch {
    // ignore
  }
}

export async function saveGitHubPat(
  token: string,
  login?: string,
): Promise<{ ok: boolean; message: string }> {
  const trimmed = token.trim();
  if (!trimmed) {
    return { ok: false, message: "Token is empty." };
  }
  await saveTokens({
    accessToken: trimmed,
    tokenType: "bearer",
    scope: "repo",
    login,
    source: "pat",
  });
  return { ok: true, message: "GitHub token saved." };
}

async function fetchGitHubUser(
  accessToken: string,
): Promise<{ login: string } | null> {
  try {
    const res = await fetch("https://api.github.com/user", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { login?: string };
    return data.login ? { login: data.login } : null;
  } catch {
    return null;
  }
}

async function exchangeOAuthCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  codeVerifier: string;
}): Promise<GitHubTokens> {
  const body = new URLSearchParams({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    code: params.code,
    redirect_uri: GITHUB_OAUTH_REDIRECT_URI,
    code_verifier: params.codeVerifier,
  });

  const res = await fetch(GITHUB_TOKEN, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = (await res.json()) as {
    access_token?: string;
    token_type?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_description ?? data.error ?? "GitHub token exchange failed.",
    );
  }

  const user = await fetchGitHubUser(data.access_token);
  return {
    accessToken: data.access_token,
    tokenType: data.token_type ?? "bearer",
    scope: data.scope ?? DEFAULT_SCOPES,
    login: user?.login,
    source: "oauth",
  };
}

function stopCallbackServer() {
  if (callbackServer) {
    callbackServer.close();
    callbackServer = null;
  }
}

function sendHtml(res: ServerResponse, title: string, body: string) {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>body{font-family:system-ui,sans-serif;background:#0d0d14;color:#e8e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
    .card{background:#1a1a26;border:1px solid #2a2a3c;border-radius:16px;padding:32px;max-width:420px;text-align:center}
    h1{font-size:20px;margin:0 0 12px}p{color:#8888a0;line-height:1.5}</style></head>
    <body><div class="card"><h1>${title}</h1><p>${body}</p></div></body></html>`,
  );
}

async function handleOAuthCallback(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${CALLBACK_PORT}`);
  if (url.pathname !== "/callback") {
    res.writeHead(404);
    res.end();
    return;
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    sendHtml(res, "Sign-in cancelled", "You can close this tab and return to Beluga.");
    loginCompleteHandler?.(false, `GitHub sign-in cancelled: ${error}`);
    stopCallbackServer();
    return;
  }

  const pending = await readJson<PendingOAuth>(pendingOAuthPath());
  if (!code || !state || !pending || pending.state !== state) {
    sendHtml(res, "Sign-in failed", "Invalid OAuth state. Try again from Beluga Settings.");
    loginCompleteHandler?.(false, "Invalid OAuth state.");
    stopCallbackServer();
    return;
  }

  try {
    const tokens = await exchangeOAuthCode({
      code,
      clientId: pending.clientId,
      clientSecret: pending.clientSecret,
      codeVerifier: pending.codeVerifier,
    });
    await saveTokens(tokens);
    await fs.unlink(pendingOAuthPath()).catch(() => undefined);
    sendHtml(
      res,
      "Connected to GitHub",
      `Signed in as <strong>${tokens.login ?? "GitHub user"}</strong>. You can close this tab.`,
    );
    loginCompleteHandler?.(
      true,
      `Connected to GitHub${tokens.login ? ` as ${tokens.login}` : ""}.`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Token exchange failed.";
    sendHtml(res, "Sign-in failed", msg);
    loginCompleteHandler?.(false, msg);
  } finally {
    stopCallbackServer();
  }
}

function ensureCallbackServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (callbackServer) {
      resolve();
      return;
    }
    callbackServer = createServer((req, res) => {
      void handleOAuthCallback(req, res);
    });
    callbackServer.on("error", (err: NodeJS.ErrnoException) => {
      callbackServer = null;
      reject(err);
    });
    callbackServer.listen(CALLBACK_PORT, "127.0.0.1", () => resolve());
  });
}

export function onGitHubOAuthLoginComplete(
  handler: (ok: boolean, message: string) => void,
) {
  loginCompleteHandler = handler;
}

export async function startGitHubOAuthLogin(params: {
  clientId: string;
  clientSecret: string;
}): Promise<{ ok: boolean; message?: string }> {
  const clientId = params.clientId.trim();
  const clientSecret = params.clientSecret.trim();
  if (!clientId || !clientSecret) {
    return {
      ok: false,
      message:
        "Add GitHub OAuth Client ID and Client Secret in Settings → GitHub first.",
    };
  }

  try {
    await ensureCallbackServer();
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Could not start callback server.";
    return { ok: false, message: msg };
  }

  const state = base64Url(randomBytes(16));
  const { verifier, challenge } = makePkce();
  const pending: PendingOAuth = {
    state,
    codeVerifier: verifier,
    clientId,
    clientSecret,
    createdAt: Date.now(),
  };
  await writeJson(pendingOAuthPath(), pending);

  const authorize = new URL(GITHUB_AUTHORIZE);
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", GITHUB_OAUTH_REDIRECT_URI);
  authorize.searchParams.set("scope", DEFAULT_SCOPES);
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("code_challenge", challenge);
  authorize.searchParams.set("code_challenge_method", "S256");

  await shell.openExternal(authorize.toString());
  return {
    ok: true,
    message: "Browser opened — approve access and return to Beluga.",
  };
}

export async function startGitHubDeviceLogin(
  clientId: string,
): Promise<{
  ok: boolean;
  message?: string;
  userCode?: string;
  verificationUri?: string;
}> {
  const id = clientId.trim();
  if (!id) {
    return {
      ok: false,
      message: "Add a GitHub OAuth Client ID in Settings → GitHub first.",
    };
  }

  const res = await fetch(GITHUB_DEVICE_CODE, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: id,
      scope: DEFAULT_SCOPES,
    }),
  });

  const data = (await res.json()) as {
    device_code?: string;
    user_code?: string;
    verification_uri?: string;
    expires_in?: number;
    interval?: number;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !data.device_code || !data.user_code) {
    return {
      ok: false,
      message:
        data.error_description ??
        data.error ??
        "Could not start GitHub device login.",
    };
  }

  const pending: PendingDevice = {
    deviceCode: data.device_code,
    clientId: id,
    interval: data.interval ?? 5,
    expiresAt: Date.now() + (data.expires_in ?? 900) * 1000,
  };
  await writeJson(pendingDevicePath(), pending);

  if (data.verification_uri) {
    await shell.openExternal(data.verification_uri);
  }

  return {
    ok: true,
    message: "Enter the code on GitHub to finish sign-in.",
    userCode: data.user_code,
    verificationUri: data.verification_uri,
  };
}

export async function pollGitHubDeviceLogin(): Promise<{
  ok: boolean;
  pending: boolean;
  message: string;
}> {
  const pending = await readJson<PendingDevice>(pendingDevicePath());
  if (!pending) {
    return { ok: false, pending: false, message: "No device login in progress." };
  }
  if (Date.now() > pending.expiresAt) {
    await fs.unlink(pendingDevicePath()).catch(() => undefined);
    return { ok: false, pending: false, message: "Device code expired. Try again." };
  }

  const res = await fetch(GITHUB_TOKEN, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: pending.clientId,
      device_code: pending.deviceCode,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    }),
  });

  const data = (await res.json()) as {
    access_token?: string;
    token_type?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };

  if (data.error === "authorization_pending") {
    return {
      ok: false,
      pending: true,
      message: "Waiting for GitHub authorization…",
    };
  }
  if (data.error === "slow_down") {
    return {
      ok: false,
      pending: true,
      message: "GitHub asked to slow down — still waiting…",
    };
  }
  if (!data.access_token) {
    await fs.unlink(pendingDevicePath()).catch(() => undefined);
    return {
      ok: false,
      pending: false,
      message: data.error_description ?? data.error ?? "Device login failed.",
    };
  }

  const user = await fetchGitHubUser(data.access_token);
  await saveTokens({
    accessToken: data.access_token,
    tokenType: data.token_type ?? "bearer",
    scope: data.scope ?? DEFAULT_SCOPES,
    login: user?.login,
    source: "device",
  });
  await fs.unlink(pendingDevicePath()).catch(() => undefined);
  return {
    ok: true,
    pending: false,
    message: `Connected to GitHub${user?.login ? ` as ${user.login}` : ""}.`,
  };
}

export async function verifyGitHubToken(): Promise<{
  ok: boolean;
  login?: string;
  message: string;
}> {
  const token = await getGitHubAccessToken();
  if (!token) {
    return { ok: false, message: "Not connected to GitHub." };
  }
  const user = await fetchGitHubUser(token);
  if (!user) {
    return { ok: false, message: "GitHub token is invalid or expired." };
  }
  const existing = await loadTokens();
  if (existing) {
    await saveTokens({ ...existing, login: user.login });
  }
  return { ok: true, login: user.login, message: `Connected as ${user.login}.` };
}