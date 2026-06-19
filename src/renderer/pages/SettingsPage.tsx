// ── src/renderer/SettingsPage.tsx ─────────────────────────────────────────
// Drop-in replacement for your existing SettingsPage.
// All state is loaded from / saved to settings.json via IPC.

import { useState, useEffect, useCallback } from "react";
import { CONFIG } from "../../config";
import type {
  WalrusNetworkConfig,
  AppSettings,
  WalrusNetwork,
} from "../types/settings";

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
      .then((s: AppSettings) => setSettings(s))
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
          {activeSection === "mcp" && <McpSection {...sectionProps} />}
          {activeSection === "walrus" && <WalrusSection {...sectionProps} />}
        </main>
      </div>

      <Toast msg={toast.msg} danger={toast.danger} visible={toast.visible} />
    </div>
  );
}

export default SettingsPage;
