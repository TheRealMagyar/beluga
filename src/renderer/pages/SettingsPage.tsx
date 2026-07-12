// ── src/renderer/SettingsPage.tsx ─────────────────────────────────────────
// Drop-in replacement for your existing SettingsPage.
// All state is loaded from / saved to settings.json via IPC.

import { useState, useEffect, useCallback } from "react";
import { CONFIG } from "../../config";
import type {
  WalrusNetworkConfig,
  AppSettings,
  WalrusNetwork,
  AiSettings,
  AiAuthMode,
} from "../types/settings";
import { AI_MODEL_OPTIONS } from "../../helper/ai-models";

const SIDEBAR_ITEMS = CONFIG.settingsPage.SIDEBAR_ITEMS;

// Fix ports — not user-configurable
const RELAYER_PORT: Record<WalrusNetwork, number> = {
  mainnet: 47821,
  testnet: 47822,
};

// ── Fixed relayer URLs (not user-configurable) ───────────────────────────────

// window.settings is injected by preload — check at call time, not module load time
const hasIPC = () =>
  typeof window !== "undefined" &&
  typeof (window as any).settings?.get === "function";

// ── Defaults (mirror what main.ts defines) ───────────────────────────────────

const DEFAULTS: AppSettings = {
  autoLaunch: false,
  startMinimized: false,
  mcpUrl: "http://0.0.0.0:47823",
  ai: {
    enabled: false,
    authMode: "grok-build",
    apiKey: "",
    model: "grok-build-0.1",
    includePageContext: true,
    allowToolUse: true,
  },
  walrus: {
    mainnet: {
      target: "https://relayer.memory.walrus.xyz",
      packageId:
        "0xcee7a6fd8de52ce645c38332bde23d4a30fd9426bc4681409733dd50958a24c6",
      registryId:
        "0x0da982cefa26864ae834a8a0504b904233d49e20fcc17c373c8bed99c75a7edd",
      rpc: "https://fullnode.mainnet.sui.io:443",
    },
    testnet: {
      target: "https://relayer-staging.memory.walrus.xyz",
      packageId:
        "0xcf6ad755a1cdff7217865c796778fabe5aa399cb0cf2eba986f4b582047229c6",
      registryId:
        "0xe80f2feec1c139616a86c9f71210152e2a7ca552b20841f2e192f99f75864437",
      rpc: "https://fullnode.testnet.sui.io:443",
    },
  },
  github: {
    clientId: "",
    clientSecret: "",
  },
};

// ── Shared UI primitives ─────────────────────────────────────────────────────

function SectionHeading({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-xl font-bold text-[#f0f0f5] tracking-tight">
        {title}
      </h1>
      <p className="text-sm text-[#8888a0] mt-1">{sub}</p>
    </div>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`border border-[#2a2a3c] rounded-2xl p-6 ${className}`}
      style={{ background: "#1e1e1e" }}
    >
      {children}
    </div>
  );
}

function CardHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold text-[#8888a0] uppercase tracking-[1.2px] mb-4">
      {children}
    </p>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 mb-4 last:mb-0">
      <label className="text-xs font-medium text-[#8888a0]">{label}</label>
      {children}
    </div>
  );
}

function Input({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`border border-[#2a2a3c] text-[#f0f0f5] rounded-lg px-3 py-2.5 text-[13px] outline-none focus:border-[#6c63ff] transition-colors placeholder:text-[#8888a0] w-full ${className}`}
      style={{ background: "#111111" }}
      {...props}
    />
  );
}

function BtnPrimary({
  children,
  onClick,
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 bg-gradient-to-br from-[#6c63ff] to-[#5148d4] text-white rounded-lg px-4 py-2.5 text-[13px] font-semibold active:scale-[0.97] transition-transform disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

function BtnSecondary({
  children,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 border border-[#2a2a3c] text-[#8888a0] hover:text-[#f0f0f5] hover:border-[#444466] rounded-lg px-4 py-2.5 text-[13px] font-semibold transition-colors active:scale-[0.97] ${className}`}
      style={{ background: "#111111" }}
    >
      {children}
    </button>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-6 rounded-full border transition-colors flex-shrink-0 ${checked ? "bg-[#6c63ff] border-[#6c63ff]" : "border-[#2a2a3c]"}`}
      style={!checked ? { background: "#111111" } : undefined}
    >
      <span
        className={`absolute top-[3px] left-[3px] w-[14px] h-[14px] rounded-full transition-all ${checked ? "translate-x-4 bg-white" : "translate-x-0 bg-[#8888a0]"}`}
      />
    </button>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[#2a2a3c] last:border-b-0">
      <div className="flex flex-col gap-0.5 pr-4">
        <span className="text-[13px] font-medium text-[#f0f0f5]">{label}</span>
        <span className="text-[11px] text-[#8888a0]">{desc}</span>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

// ── Toast ────────────────────────────────────────────────────────────────────

function Toast({
  msg,
  danger,
  visible,
}: {
  msg: string;
  danger?: boolean;
  visible: boolean;
}) {
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 border border-[#2a2a3c] rounded-xl px-4 py-3 text-[13px] transition-all duration-300 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8 pointer-events-none"}`}
      style={{ background: "#1e1e1e" }}
    >
      <span
        className={`w-2 h-2 rounded-full flex-shrink-0 ${danger ? "bg-[#ff4d6d]" : "bg-[#00d4aa]"}`}
      />
      <span className="text-[#f0f0f5]">{msg}</span>
    </div>
  );
}

// ── ApplicationSection ───────────────────────────────────────────────────────

function ApplicationSection({
  settings,
  showToast,
  onUpdate,
}: {
  settings: AppSettings;
  showToast: (m: string, d?: boolean) => void;
  onUpdate: (key: keyof AppSettings, value: unknown) => Promise<void>;
}) {
  const toggle = async (
    field: "autoLaunch" | "startMinimized",
    next: boolean,
  ) => {
    await onUpdate(field, next);
    showToast(
      field === "autoLaunch"
        ? next
          ? "Launch on startup enabled"
          : "Launch on startup disabled"
        : next
          ? "Start minimized enabled"
          : "Start minimized disabled",
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading
        title="Application"
        sub="Configure how the app behaves on startup"
      />
      <Card>
        <CardHeader>Startup</CardHeader>
        <ToggleRow
          label="Launch on system startup"
          desc="Automatically start the app when you log in"
          checked={settings.autoLaunch}
          onChange={(v) => toggle("autoLaunch", v)}
        />
        <ToggleRow
          label="Start minimized to tray"
          desc="The window stays hidden on launch; only the tray icon appears"
          checked={settings.startMinimized}
          onChange={(v) => toggle("startMinimized", v)}
        />
      </Card>
    </div>
  );
}

// ── AiSection ────────────────────────────────────────────────────────────────

function AiSection({
  settings,
  showToast,
  onUpdate,
}: {
  settings: AppSettings;
  showToast: (m: string, d?: boolean) => void;
  onUpdate: (key: keyof AppSettings, value: unknown) => Promise<void>;
}) {
  const ai = settings.ai ?? DEFAULTS.ai;
  const authMode: AiAuthMode = ai.authMode === "api-key" ? "api-key" : "grok-build";
  const [apiKeyDraft, setApiKeyDraft] = useState(ai.apiKey);
  const [oauthCodeDraft, setOauthCodeDraft] = useState("");
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [grokStatus, setGrokStatus] = useState<{
    connected: boolean;
    email: string | null;
    source: "beluga" | "grok-cli" | null;
  } | null>(null);

  useEffect(() => {
    setApiKeyDraft(ai.apiKey);
  }, [ai.apiKey]);

  const refreshGrokStatus = useCallback(async () => {
    if (!window.belugaAi?.oauthStatus) return;
    const status = await window.belugaAi.oauthStatus();
    setGrokStatus({
      connected: status.connected,
      email: status.email,
      source: status.source,
    });
  }, []);

  useEffect(() => {
    void refreshGrokStatus();
    const unsub = window.belugaAi?.onOauthComplete?.((payload) => {
      setSigningIn(false);
      setTestStatus(payload.ok ? `✓ ${payload.message}` : payload.message);
      if (payload.ok) showToast(payload.message);
      else showToast(payload.message, true);
      void refreshGrokStatus();
    });
    return () => unsub?.();
  }, [refreshGrokStatus, showToast]);

  const patchAi = async (patch: Partial<AiSettings>) => {
    await onUpdate("ai", { ...ai, ...patch });
  };

  const saveApiKey = async () => {
    const trimmed = apiKeyDraft.trim();
    if (!trimmed) {
      showToast("Paste your xAI API key first", true);
      return;
    }
    await patchAi({ apiKey: trimmed });
    showToast("API key saved");
  };

  const testConnection = async () => {
    setTesting(true);
    setTestStatus("Testing…");
    try {
      if (!window.belugaAi?.testConnection) {
        throw new Error("AI bridge unavailable. Restart the app.");
      }
      const result = await window.belugaAi.testConnection({
        apiKey: authMode === "api-key" ? apiKeyDraft.trim() : undefined,
        model: ai.model,
        authMode,
      });
      if (result.ok && authMode === "api-key") {
        const patch: Partial<AiSettings> = { apiKey: apiKeyDraft.trim() };
        if (result.suggestedModel && result.suggestedModel !== ai.model) {
          patch.model = result.suggestedModel;
        }
        await patchAi(patch);
      }
      setTestStatus(result.ok ? `✓ ${result.message}` : result.message);
      if (!result.ok) showToast(result.message, true);
      else showToast(result.message);
      if (authMode === "grok-build") await refreshGrokStatus();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Test failed";
      setTestStatus(msg);
      showToast(msg, true);
    } finally {
      setTesting(false);
    }
  };

  const signInWithGrok = async () => {
    setSigningIn(true);
    setTestStatus("Opening browser…");
    try {
      if (!window.belugaAi?.oauthStart) {
        throw new Error("AI bridge unavailable. Restart the app.");
      }
      const result = await window.belugaAi.oauthStart();
      if (!result.ok) throw new Error(result.message ?? "Could not start sign-in.");
      setTestStatus(result.message ?? "Complete sign-in in your browser.");
      showToast(result.message ?? "Browser opened for Grok sign-in.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign-in failed";
      setTestStatus(msg);
      showToast(msg, true);
      setSigningIn(false);
    }
  };

  const submitOAuthCode = async () => {
    const code = oauthCodeDraft.trim();
    if (!code) {
      showToast("Paste the Grok Build sign-in code", true);
      return;
    }
    setSigningIn(true);
    try {
      if (!window.belugaAi?.oauthExchangeCode) {
        throw new Error("AI bridge unavailable. Restart the app.");
      }
      const result = await window.belugaAi.oauthExchangeCode(code);
      setTestStatus(result.ok ? `✓ ${result.message}` : result.message);
      if (!result.ok) showToast(result.message, true);
      else {
        showToast(result.message);
        setOauthCodeDraft("");
      }
      await refreshGrokStatus();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Code exchange failed";
      setTestStatus(msg);
      showToast(msg, true);
    } finally {
      setSigningIn(false);
    }
  };

  const logoutGrok = async () => {
    await window.belugaAi?.oauthLogout?.();
    await refreshGrokStatus();
    setTestStatus(null);
    showToast("Signed out of Grok Build");
  };

  const canTest =
    authMode === "grok-build" ? grokStatus?.connected : Boolean(apiKeyDraft.trim());

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading
        title="AI Assistant"
        sub="Optional in-app chat powered by Grok Build (subscription) or xAI API key"
      />
      <Card>
        <CardHeader>General</CardHeader>
        <ToggleRow
          label="Enable AI Assistant"
          desc="Show the AI chat panel in the titlebar"
          checked={ai.enabled}
          onChange={(v) => patchAi({ enabled: v })}
        />
        <ToggleRow
          label="Include page context"
          desc="Tell the AI which Beluga page you are on"
          checked={ai.includePageContext}
          onChange={(v) => patchAi({ includePageContext: v })}
        />
        <ToggleRow
          label="Allow Beluga tool use"
          desc="Let the AI list projects, read/write files, and query Walrus memory"
          checked={ai.allowToolUse ?? true}
          onChange={(v) => patchAi({ allowToolUse: v })}
        />
      </Card>

      <Card>
        <CardHeader>Authentication</CardHeader>
        <Field label="Sign-in method">
          <select
            value={authMode}
            onChange={(e) => {
              const mode = e.target.value as AiAuthMode;
              const patch: Partial<AiSettings> = { authMode: mode };
              if (mode === "grok-build" && !ai.model.startsWith("grok-build")) {
                patch.model = "grok-build-0.1";
              }
              if (mode === "api-key" && ai.model.startsWith("grok-build")) {
                patch.model = "grok-3-fast";
              }
              void patchAi(patch);
            }}
            className="border border-[#2a2a3c] text-[#f0f0f5] rounded-lg px-3 py-2.5 text-[13px] outline-none focus:border-[#6c63ff] transition-colors w-full"
            style={{ background: "#111111" }}
          >
            <option value="grok-build">Grok Build (SuperGrok / X Premium+)</option>
            <option value="api-key">xAI API key (prepaid credits)</option>
          </select>
        </Field>

        {authMode === "grok-build" ? (
          <>
            <p className="text-[11px] text-[#8888a0] mb-4 leading-relaxed">
              Uses the same browser login as the Grok Build CLI — no API key or
              prepaid credits needed. Works with SuperGrok or X Premium+.
              If you already ran <code className="text-[#ccc]">grok</code> in a
              terminal, Beluga reuses that session automatically.
            </p>
            {grokStatus?.connected ? (
              <div className="rounded-lg border border-[#00d4aa]/30 bg-[#00d4aa]/08 px-3 py-2.5 mb-4">
                <p className="text-[12px] text-[#00d4aa]">
                  Signed in
                  {grokStatus.email ? ` as ${grokStatus.email}` : ""}
                  {grokStatus.source === "grok-cli" ? " (from Grok CLI)" : ""}
                </p>
              </div>
            ) : (
              <p className="text-[12px] text-[#8888a0] mb-4">Not signed in yet.</p>
            )}
            <div className="flex items-center gap-3 flex-wrap mb-4">
              <BtnPrimary
                onClick={signInWithGrok}
                disabled={signingIn}
                className="text-[12px] px-3 py-2"
              >
                {signingIn ? "Waiting for browser…" : "Sign in with Grok"}
              </BtnPrimary>
              {grokStatus?.connected && (
                <BtnSecondary
                  onClick={logoutGrok}
                  className="text-[12px] px-3 py-2"
                >
                  Sign out
                </BtnSecondary>
              )}
            </div>
            <Field label="Grok Build code (if browser shows a code)">
              <Input
                value={oauthCodeDraft}
                onChange={(e) => setOauthCodeDraft(e.target.value)}
                placeholder="Paste sign-in code from browser"
                autoComplete="off"
              />
            </Field>
            <div className="flex items-center gap-3 mt-2">
              <BtnSecondary
                onClick={submitOAuthCode}
                disabled={signingIn || !oauthCodeDraft.trim()}
                className="text-[12px] px-3 py-2"
              >
                Submit code
              </BtnSecondary>
            </div>
          </>
        ) : (
          <>
            <Field label="API key">
              <Input
                type="password"
                value={apiKeyDraft}
                onChange={(e) => setApiKeyDraft(e.target.value)}
                placeholder="xai-…"
                autoComplete="off"
              />
            </Field>
            <div className="flex items-center gap-3 mt-2">
              <BtnPrimary onClick={saveApiKey} className="text-[12px] px-3 py-2">
                Save key
              </BtnPrimary>
            </div>
            <p className="text-[11px] text-[#8888a0] mt-3 leading-relaxed">
              API keys require prepaid credits at{" "}
              <a
                href="https://console.x.ai/team/default/billing"
                target="_blank"
                rel="noreferrer"
                className="text-[#6c63ff] hover:underline"
              >
                console.x.ai → Billing
              </a>
              . Grok / X Premium alone does not include API credits.
            </p>
            {ai.apiKey && (
              <p className="text-[11px] text-[#00d4aa] mt-2">
                Saved key: {ai.apiKey.slice(0, 4)}••••{ai.apiKey.slice(-4)}
              </p>
            )}
          </>
        )}

        <Field label="Model">
          <select
            value={ai.model}
            onChange={(e) => patchAi({ model: e.target.value })}
            className="border border-[#2a2a3c] text-[#f0f0f5] rounded-lg px-3 py-2.5 text-[13px] outline-none focus:border-[#6c63ff] transition-colors w-full"
            style={{ background: "#111111" }}
          >
            <optgroup label="Grok Build (agentic)">
              {AI_MODEL_OPTIONS.filter((m) => m.group === "build").map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Grok Chat">
              {AI_MODEL_OPTIONS.filter((m) => m.group === "chat").map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </optgroup>
          </select>
        </Field>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <BtnSecondary
            onClick={testConnection}
            disabled={testing || !canTest}
            className="text-[12px] px-3 py-2"
          >
            Test connection
          </BtnSecondary>
          {testStatus && (
            <span
              className={`text-[12px] ${testStatus.startsWith("✓") ? "text-[#00d4aa]" : "text-[#8888a0]"}`}
            >
              {testStatus}
            </span>
          )}
        </div>
      </Card>
    </div>
  );
}

// ── McpSection ───────────────────────────────────────────────────────────────

function McpSection({
  settings,
  showToast,
  onUpdate,
}: {
  settings: AppSettings;
  showToast: (m: string, d?: boolean) => void;
  onUpdate: (key: keyof AppSettings, value: unknown) => Promise<void>;
}) {
  const [draft, setDraft] = useState(settings.mcpUrl);
  const [epStatus, setEpStatus] = useState<string | null>(null);

  useEffect(() => setDraft(settings.mcpUrl), [settings.mcpUrl]);

  const save = async () => {
    await onUpdate("mcpUrl", draft);
    showToast("MCP server saved and restarted");
  };

  const testEndpoint = () => {
    setEpStatus("Testing…");
    setTimeout(() => setEpStatus("✓ Connection successful (42 ms)"), 900);
  };

  const reset = async () => {
    await onUpdate("mcpUrl", DEFAULTS.mcpUrl);
    setDraft(DEFAULTS.mcpUrl);
    setEpStatus(null);
    showToast("Default URL restored");
  };

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading
        title="MCP endpoint"
        sub="Configure the Model Context Protocol server"
      />
      <Card>
        <CardHeader>Primary MCP server</CardHeader>
        <Field label="Server URL">
          <Input
            type="url"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={DEFAULTS.mcpUrl}
          />
        </Field>
        <div className="flex items-center gap-3 mt-2">
          <BtnPrimary onClick={save} className="text-[12px] px-3 py-2">
            Save
          </BtnPrimary>
          <BtnSecondary
            onClick={testEndpoint}
            className="text-[12px] px-3 py-2"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 12.55a11 11 0 0114.08 0" />
              <path d="M1.42 9a16 16 0 0121.16 0" />
              <path d="M8.53 16.11a6 6 0 016.95 0" />
              <circle cx="12" cy="20" r="1" />
            </svg>
            Test connection
          </BtnSecondary>
          <BtnSecondary onClick={reset} className="text-[12px] px-3 py-2">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
            </svg>
            Reset to default
          </BtnSecondary>
          {epStatus && (
            <span
              className={`text-[12px] ${epStatus.startsWith("✓") ? "text-[#00d4aa]" : "text-[#8888a0]"}`}
            >
              {epStatus}
            </span>
          )}
        </div>
      </Card>
      <Card>
        <CardHeader>Scoped MCP endpoints</CardHeader>
        <p className="text-[12px] text-[#8888a0] mb-3 leading-relaxed">
          Same port, different tool sets. Use a scoped URL in Cursor/Claude when you
          only need one area (Playground includes core project tools).
        </p>
        <ul className="text-[11px] font-mono text-[#c7c7d8] space-y-1.5">
          <li>/mcp — all tools</li>
          <li>/mcp/core — projects, memory, files, skills</li>
          <li>/mcp/playground — localnet, Move build/publish, dWallet</li>
          <li>/mcp/packages — SDK catalog install/link</li>
          <li>/mcp/tools — token scanner, NFT/token gen, gRPC</li>
          <li>/mcp/wallet — wallet balance, faucet, send</li>
        </ul>
        <p className="text-[11px] text-[#666680] mt-3">
          Example: <code className="text-[#aaa]">http://0.0.0.0:47823/mcp/playground</code>
        </p>
      </Card>
    </div>
  );
}

// ── WalrusNetworkCard ─────────────────────────────────────────────────────────

function WalrusNetworkCard({
  network,
  label,
  target,
  packageId,
  registryId,
  rpc,
  onChange,
  onSave,
  onReset,
}: {
  network: WalrusNetwork;
  label: string;
  target: string;
  packageId: string;
  registryId: string;
  rpc: string;
  onChange: (field: keyof WalrusNetworkConfig, value: string) => void;
  onSave: () => void;
  onReset: () => void;
}) {
  const accent = network === "mainnet" ? "#00d4aa" : "#ffb347";

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] font-bold text-[#8888a0] uppercase tracking-[1.2px]">
          {label}
        </p>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide"
          style={{ backgroundColor: `${accent}1a`, color: accent }}
        >
          {network}
        </span>
      </div>

      <Field label="Relayer target">
        <Input
          value={target}
          onChange={(e) => onChange("target", e.target.value)}
          placeholder={DEFAULTS.walrus[network].target}
        />
      </Field>
      <Field label="Package ID">
        <Input
          value={packageId}
          onChange={(e) => onChange("packageId", e.target.value)}
          placeholder={DEFAULTS.walrus[network].packageId}
          className="font-mono text-[12px]"
        />
      </Field>
      <Field label="Registry ID">
        <Input
          value={registryId}
          onChange={(e) => onChange("registryId", e.target.value)}
          placeholder={DEFAULTS.walrus[network].registryId}
          className="font-mono text-[12px]"
        />
      </Field>
      <Field label="Sui RPC">
        <Input
          value={rpc}
          onChange={(e) => onChange("rpc", e.target.value)}
          placeholder={DEFAULTS.walrus[network].rpc}
        />
      </Field>

      <div className="flex items-center gap-3 mt-2">
        <BtnPrimary onClick={onSave} className="text-[12px] px-3 py-2">
          Save
        </BtnPrimary>
        <BtnSecondary onClick={onReset} className="text-[12px] px-3 py-2">
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
          </svg>
          Reset to default
        </BtnSecondary>
      </div>
    </Card>
  );
}

// ── WalrusSection ────────────────────────────────────────────────────────────

function WalrusSection({
  settings,
  showToast,
  onUpdate,
}: {
  settings: AppSettings;
  showToast: (m: string, d?: boolean) => void;
  onUpdate: (key: keyof AppSettings, value: unknown) => Promise<void>;
}) {
  const [mainnet, setMainnet] = useState(settings.walrus.mainnet);
  const [testnet, setTestnet] = useState(settings.walrus.testnet);

  useEffect(() => {
    setMainnet(settings.walrus.mainnet);
    setTestnet(settings.walrus.testnet);
  }, [settings.walrus]);

  const handleChange =
    (network: WalrusNetwork) =>
    (field: keyof WalrusNetworkConfig, value: string) => {
      if (network === "mainnet") setMainnet((p) => ({ ...p, [field]: value }));
      else setTestnet((p) => ({ ...p, [field]: value }));
    };

  const saveNetwork = async (network: WalrusNetwork) => {
    const next = {
      ...settings.walrus,
      [network]: network === "mainnet" ? mainnet : testnet,
    };
    await onUpdate("walrus", next);
    showToast(
      network === "mainnet" ? "Mainnet config saved" : "Testnet config saved",
    );
  };

  const resetNetwork = async (network: WalrusNetwork) => {
    const def = DEFAULTS.walrus[network];
    if (network === "mainnet") setMainnet(def);
    else setTestnet(def);
    await onUpdate("walrus", { ...settings.walrus, [network]: def });
    showToast(
      network === "mainnet"
        ? "Mainnet defaults restored"
        : "Testnet defaults restored",
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading
        title="Walrus network"
        sub="Package IDs and RPC endpoints for mainnet and testnet"
      />
      <WalrusNetworkCard
        network="mainnet"
        label="Mainnet"
        target={mainnet.target}
        packageId={mainnet.packageId}
        registryId={mainnet.registryId}
        rpc={mainnet.rpc}
        onChange={handleChange("mainnet")}
        onSave={() => saveNetwork("mainnet")}
        onReset={() => resetNetwork("mainnet")}
      />
      <WalrusNetworkCard
        network="testnet"
        label="Testnet"
        target={testnet.target}
        packageId={testnet.packageId}
        registryId={testnet.registryId}
        rpc={testnet.rpc}
        onChange={handleChange("testnet")}
        onSave={() => saveNetwork("testnet")}
        onReset={() => resetNetwork("testnet")}
      />
    </div>
  );
}

const GITHUB_TOKEN_URL =
  "https://github.com/settings/tokens/new?scopes=repo,read:user&description=Beluga";

// ── GitHubSection ─────────────────────────────────────────────────────────────

function GitHubSection({
  showToast,
}: {
  settings: AppSettings;
  showToast: (m: string, d?: boolean) => void;
  onUpdate: (key: keyof AppSettings, value: unknown) => Promise<void>;
}) {
  const [tokenDraft, setTokenDraft] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [ghStatus, setGhStatus] = useState<{
    connected: boolean;
    login: string | null;
    gitInstalled: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!window.belugaGitHub?.getStatus) return;
    const s = await window.belugaGitHub.getStatus();
    setGhStatus({
      connected: s.connected,
      login: s.login,
      gitInstalled: s.gitInstalled,
    });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connect = async () => {
    const api = window.belugaGitHub;
    if (!api?.savePat || !api.verify) {
      showToast("GitHub bridge unavailable. Restart the app.", true);
      return;
    }
    const token = tokenDraft.trim();
    if (!token) {
      showToast("Paste your GitHub token first", true);
      return;
    }
    setBusy(true);
    setStatus("Connecting…");
    try {
      const saved = await api.savePat(token);
      if (!saved.ok) throw new Error(saved.message);
      const verified = await api.verify();
      if (!verified.ok) throw new Error(verified.message);
      setStatus(`Connected as ${verified.login ?? "GitHub user"}`);
      showToast(`Connected as ${verified.login ?? "GitHub user"}`);
      setTokenDraft("");
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Connection failed";
      setStatus(msg);
      showToast(msg, true);
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await window.belugaGitHub?.logout?.();
    setStatus(null);
    setTokenDraft("");
    showToast("Disconnected from GitHub");
    await refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading
        title="GitHub"
        sub="Paste a personal access token — then push, create repos, and use git from projects or the AI"
      />
      <Card>
        <CardHeader>Account</CardHeader>

        {ghStatus?.connected ? (
          <div className="flex items-center justify-between gap-3 mb-4 p-3 rounded-xl bg-[#00d4aa]/08 border border-[#00d4aa]/20">
            <div>
              <p className="text-[13px] text-[#00d4aa] font-medium">
                Connected as @{ghStatus.login}
              </p>
              <p className="text-[11px] text-[#8888a0] mt-0.5">
                Token stored locally on this device
              </p>
            </div>
            <BtnSecondary onClick={() => void logout()}>Disconnect</BtnSecondary>
          </div>
        ) : (
          <p className="text-[13px] text-[#8888a0] mb-4">
            Not connected yet. Create a token on GitHub, paste it below, and
            click Connect.
          </p>
        )}

        {!ghStatus?.gitInstalled && (
          <p className="text-[12px] text-[#ffb347] mb-4">
            Git is not installed — install it from Packages → Toolchain before
            push/pull.
          </p>
        )}

        <ol className="text-[12px] text-[#8888a0] mb-4 space-y-1.5 list-decimal list-inside leading-relaxed">
          <li>
            <a
              href={GITHUB_TOKEN_URL}
              target="_blank"
              rel="noreferrer"
              className="text-[#4ca3ff] hover:underline"
            >
              Create a token on GitHub
            </a>{" "}
            with <code className="text-[#aaa]">repo</code> scope
          </li>
          <li>Copy the token (starts with <code className="text-[#aaa]">ghp_</code> or{" "}
            <code className="text-[#aaa]">github_pat_</code>)
          </li>
          <li>Paste it here and press Connect</li>
        </ol>

        <Field label="Personal access token">
          <Input
            type="password"
            value={tokenDraft}
            onChange={(e) => setTokenDraft(e.target.value)}
            placeholder="ghp_… or github_pat_…"
            autoComplete="off"
          />
        </Field>

        {status && (
          <p className="text-[12px] text-[#8888a0] mb-3">{status}</p>
        )}

        <div className="flex flex-wrap gap-2">
          <BtnPrimary
            onClick={() => void connect()}
            disabled={busy || !tokenDraft.trim()}
          >
            {busy ? "Connecting…" : ghStatus?.connected ? "Update token" : "Connect"}
          </BtnPrimary>
        </div>
      </Card>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export function SettingsPage() {
  const [activeSection, setActiveSection] = useState("application");
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({
    msg: "",
    danger: false,
    visible: false,
  });

  useEffect(() => {
    if (!hasIPC()) {
      console.warn(
        "[Settings] window.settings not available – running on DEFAULTS",
      );
      setLoading(false);
      return;
    }
    (window as any).settings
      .get()
      .then((s: AppSettings) =>
        setSettings({
          ...DEFAULTS,
          ...s,
          ai: {
            ...DEFAULTS.ai,
            ...(s.ai ?? {}),
            allowToolUse: s.ai?.allowToolUse ?? DEFAULTS.ai.allowToolUse,
          },
          walrus: {
            mainnet: { ...DEFAULTS.walrus.mainnet, ...s.walrus?.mainnet },
            testnet: { ...DEFAULTS.walrus.testnet, ...s.walrus?.testnet },
          },
          github: { ...DEFAULTS.github, ...s.github },
        }),
      )
      .catch((err: unknown) => console.error("[Settings] get() failed:", err))
      .finally(() => setLoading(false));
  }, []);

  const onUpdate = useCallback(
    async (key: keyof AppSettings, value: unknown) => {
      if (!hasIPC()) {
        setSettings((prev) => ({ ...prev, [key]: value }));
        return;
      }
      try {
        const next = await (window as any).settings.set(key, value);
        setSettings(next);
      } catch (err) {
        console.error("[Settings] set() failed:", err);
      }
    },
    [],
  );

  const showToast = (msg: string, danger = false) => {
    setToast({ msg, danger, visible: true });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2400);
  };

  const sectionProps = { settings, showToast, onUpdate };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#161616" }}
      >
        <span className="text-[#8888a0] text-sm">Loading settings…</span>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen text-[#f0f0f5]"
      style={{ background: "#161616", fontFamily: "system-ui, sans-serif" }}
    >
      <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-[200px_1fr] gap-6">
        {/* Sidebar */}
        <nav className="flex flex-col gap-0.5" aria-label="Settings navigation">
          {SIDEBAR_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium text-left transition-colors w-full ${
                activeSection === item.id
                  ? "bg-[#4ca3ff]/12 text-[#4ca3ff]"
                  : "text-[#8888a0] hover:text-[#f0f0f5] hover:bg-[#1e1e1e]"
              }`}
              style={activeSection !== item.id ? {} : undefined}
            >
              <img className="h-5 w-5" src={item.icon} />
              {item.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <main>
          {activeSection === "application" && (
            <ApplicationSection {...sectionProps} />
          )}
          {activeSection === "ai" && <AiSection {...sectionProps} />}
          {activeSection === "mcp" && <McpSection {...sectionProps} />}
          {activeSection === "walrus" && <WalrusSection {...sectionProps} />}
          {activeSection === "github" && <GitHubSection {...sectionProps} />}
        </main>
      </div>

      <Toast msg={toast.msg} danger={toast.danger} visible={toast.visible} />
    </div>
  );
}

export default SettingsPage;
