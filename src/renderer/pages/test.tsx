import { useState } from "react";
import {
  health,
  remember,
  remember_bulk,
  recall,
  analyze,
  restore,
  WalrusCredentials,
  HealthResult,
  RememberResult,
  BulkRememberItem,
  RecallResult,
  AnalyzeResult,
  RestoreResult,
} from "../../helper/walrus-memory"; // adjust path as needed

// ─── Theme tokens ──────────────────────────────────────────────────────────────
// Palette: deep navy base, electric teal accent, warm offwhite surface, muted slate text
// Typography: monospace utility face throughout (suits a developer/API testing tool)
// Signature: a live JSON result pane that animates in per-result, terminal-style

const COLORS = {
  bg: "#0D1117",
  surface: "#161B22",
  border: "#21262D",
  accent: "#2DD4BF",
  accentDim: "#134E4A",
  text: "#E6EDF3",
  muted: "#7D8590",
  error: "#F85149",
  success: "#3FB950",
  warning: "#D29922",
};

// ─── Types ─────────────────────────────────────────────────────────────────────

type FnName = "health" | "remember" | "remember_bulk" | "recall" | "analyze" | "restore";

interface ResultEntry {
  fn: FnName;
  status: "ok" | "error";
  data: unknown;
  ts: string;
}

// ─── Small components ──────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ display: "block", fontSize: 11, color: COLORS.muted, marginBottom: 4, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "monospace" }}>
      {children}
    </label>
  );
}

function Input({ value, onChange, placeholder, multiline = false }: { value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean }) {
  const base: React.CSSProperties = {
    width: "100%",
    background: COLORS.bg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 6,
    color: COLORS.text,
    fontFamily: "monospace",
    fontSize: 13,
    padding: "8px 10px",
    outline: "none",
    resize: multiline ? "vertical" : undefined,
    boxSizing: "border-box",
    transition: "border-color 0.15s",
  };
  if (multiline) {
    return <textarea rows={3} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ ...base, minHeight: 72 }} />;
  }
  return <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={base} />;
}

function Btn({ onClick, disabled, children, variant = "primary" }: { onClick: () => void; disabled?: boolean; children: React.ReactNode; variant?: "primary" | "ghost" }) {
  const bg = variant === "primary" ? (disabled ? COLORS.accentDim : COLORS.accent) : "transparent";
  const color = variant === "primary" ? (disabled ? COLORS.muted : COLORS.bg) : COLORS.muted;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: bg,
        color,
        border: variant === "ghost" ? `1px solid ${COLORS.border}` : "none",
        borderRadius: 6,
        padding: "8px 16px",
        fontFamily: "monospace",
        fontSize: 13,
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 0.15s, color 0.15s",
        letterSpacing: "0.04em",
      }}
    >
      {children}
    </button>
  );
}

function Field({ label, value, onChange, placeholder, multiline = false }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <Label>{label}</Label>
      <Input value={value} onChange={onChange} placeholder={placeholder} multiline={multiline} />
    </div>
  );
}

function Badge({ status }: { status: "ok" | "error" | "pending" }) {
  const colors = { ok: COLORS.success, error: COLORS.error, pending: COLORS.warning };
  return (
    <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: colors[status], marginRight: 6, flexShrink: 0 }} />
  );
}

function ResultPane({ entries }: { entries: ResultEntry[] }) {
  if (entries.length === 0) {
    return (
      <div style={{ color: COLORS.muted, fontFamily: "monospace", fontSize: 13, padding: 24, textAlign: "center", borderTop: `1px solid ${COLORS.border}` }}>
        — Még nincs eredmény. Hívj meg egy funkciót. —
      </div>
    );
  }
  return (
    <div style={{ borderTop: `1px solid ${COLORS.border}` }}>
      {[...entries].reverse().map((e, i) => (
        <div key={i} style={{ borderBottom: `1px solid ${COLORS.border}`, padding: "14px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 8, gap: 8 }}>
            <Badge status={e.status} />
            <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: COLORS.accent }}>{e.fn}()</span>
            <span style={{ fontFamily: "monospace", fontSize: 11, color: COLORS.muted, marginLeft: "auto" }}>{e.ts}</span>
          </div>
          <pre style={{
            margin: 0,
            fontFamily: "monospace",
            fontSize: 12,
            color: e.status === "error" ? COLORS.error : COLORS.text,
            background: COLORS.bg,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 6,
            padding: "10px 12px",
            overflowX: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            lineHeight: 1.6,
          }}>
            {JSON.stringify(e.data, null, 2)}
          </pre>
        </div>
      ))}
    </div>
  );
}

// ─── Function panels ───────────────────────────────────────────────────────────

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 8, marginBottom: 12, overflow: "hidden" }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ padding: "10px 16px", background: COLORS.surface, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", userSelect: "none" }}
      >
        <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: COLORS.text }}>{title}</span>
        <span style={{ color: COLORS.muted, fontSize: 11 }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && <div style={{ padding: 16, background: COLORS.bg }}>{children}</div>}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function WalrusTestUI() {
  // Credentials
  const [accountId, setAccountId] = useState("");
  const [delegateKey, setDelegateKey] = useState("");
  const [network, setNetwork] = useState<"mainnet" | "testnet">("mainnet");
  const [namespace, setNamespace] = useState("default");

  // Function inputs
  const [rememberText, setRememberText] = useState("");
  const [rememberNs, setRememberNs] = useState("");
  const [bulkTexts, setBulkTexts] = useState("");
  const [bulkNs, setBulkNs] = useState("");
  const [recallQuery, setRecallQuery] = useState("");
  const [recallLimit, setRecallLimit] = useState("10");
  const [recallNs, setRecallNs] = useState("");
  const [recallMaxDist, setRecallMaxDist] = useState("");
  const [analyzeText, setAnalyzeText] = useState("");
  const [analyzeNs, setAnalyzeNs] = useState("");
  const [restoreNs, setRestoreNs] = useState("");
  const [restoreLimit, setRestoreLimit] = useState("");

  // State
  const [loading, setLoading] = useState<FnName | null>(null);
  const [results, setResults] = useState<ResultEntry[]>([]);

  function getCreds(): WalrusCredentials {
    return { accountId, delegateKey, network, namespace: namespace || "default" };
  }

  async function run(fn: FnName, call: () => Promise<unknown>) {
    setLoading(fn);
    const ts = new Date().toLocaleTimeString("hu-HU");
    try {
      const data = await call();
      setResults(r => [...r, { fn, status: "ok", data, ts }]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setResults(r => [...r, { fn, status: "error", data: { error: msg }, ts }]);
    } finally {
      setLoading(null);
    }
  }

  const busy = loading !== null;
  const credsOk = accountId.trim() !== "" && delegateKey.trim() !== "";

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text, fontFamily: "monospace" }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${COLORS.border}`, padding: "16px 24px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS.accent }} />
        <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "0.06em", color: COLORS.text }}>WALRUS MEMORY</span>
        <span style={{ color: COLORS.muted, fontSize: 12 }}>/ api testbed</span>
        {!credsOk && (
          <span style={{ marginLeft: "auto", color: COLORS.warning, fontSize: 11 }}>⚠ Töltsd ki a credentials mezőket</span>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", minHeight: "calc(100vh - 53px)" }}>
        {/* Left: controls */}
        <div style={{ borderRight: `1px solid ${COLORS.border}`, padding: 20, overflowY: "auto", maxHeight: "calc(100vh - 53px)" }}>
          {/* Credentials */}
          <div style={{ marginBottom: 20, padding: 14, border: `1px solid ${COLORS.accentDim}`, borderRadius: 8, background: "#0b1e1c" }}>
            <div style={{ fontSize: 11, color: COLORS.accent, marginBottom: 12, letterSpacing: "0.1em", textTransform: "uppercase" }}>Credentials</div>
            <Field label="Account ID (0x...)" value={accountId} onChange={setAccountId} placeholder="0xabc..." />
            <Field label="Delegate Private Key (hex)" value={delegateKey} onChange={setDelegateKey} placeholder="hex string..." />
            <div style={{ marginBottom: 12 }}>
              <Label>Network</Label>
              <div style={{ display: "flex", gap: 8 }}>
                {(["mainnet", "testnet"] as const).map(n => (
                  <button
                    key={n}
                    onClick={() => setNetwork(n)}
                    style={{
                      flex: 1, padding: "7px 0", borderRadius: 6, fontFamily: "monospace", fontSize: 12, cursor: "pointer",
                      background: network === n ? COLORS.accentDim : COLORS.bg,
                      color: network === n ? COLORS.accent : COLORS.muted,
                      border: `1px solid ${network === n ? COLORS.accent : COLORS.border}`,
                      fontWeight: network === n ? 700 : 400,
                      transition: "all 0.15s",
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <Field label="Default namespace" value={namespace} onChange={setNamespace} placeholder="default" />
          </div>

          {/* health */}
          <Panel title="health()">
            <p style={{ color: COLORS.muted, fontSize: 12, marginTop: 0, marginBottom: 12 }}>Ellenőrzi a relayer kapcsolatot.</p>
            <Btn onClick={() => run("health", () => health(getCreds()))} disabled={busy || !credsOk}>
              {loading === "health" ? "⏳ fut..." : "▶ Futtatás"}
            </Btn>
          </Panel>

          {/* remember */}
          <Panel title="remember(text)">
            <Field label="Szöveg" value={rememberText} onChange={setRememberText} placeholder="Ezt megjegyzi..." multiline />
            <Field label="Namespace (opcionális)" value={rememberNs} onChange={setRememberNs} placeholder="default" />
            <Btn
              onClick={() => run("remember", () => remember(getCreds(), rememberText, rememberNs || undefined))}
              disabled={busy || !credsOk || !rememberText.trim()}
            >
              {loading === "remember" ? "⏳ fut..." : "▶ Futtatás"}
            </Btn>
          </Panel>

          {/* remember_bulk */}
          <Panel title="remember_bulk(texts[])">
            <Field label="Szövegek (soronként 1, max 20)" value={bulkTexts} onChange={setBulkTexts} placeholder={"Első szöveg\nMásodik szöveg\n..."} multiline />
            <Field label="Namespace (opcionális)" value={bulkNs} onChange={setBulkNs} placeholder="default" />
            <Btn
              onClick={() => {
                const texts = bulkTexts.split("\n").map(s => s.trim()).filter(Boolean).slice(0, 20);
                run("remember_bulk", () => remember_bulk(getCreds(), texts, bulkNs || undefined));
              }}
              disabled={busy || !credsOk || !bulkTexts.trim()}
            >
              {loading === "remember_bulk" ? "⏳ fut..." : "▶ Futtatás"}
            </Btn>
          </Panel>

          {/* recall */}
          <Panel title="recall(query)">
            <Field label="Lekérdezés" value={recallQuery} onChange={setRecallQuery} placeholder="Mi az XYZ?" />
            <Field label="Limit (default: 10)" value={recallLimit} onChange={setRecallLimit} placeholder="10" />
            <Field label="Max Distance (opcionális)" value={recallMaxDist} onChange={setRecallMaxDist} placeholder="0.5" />
            <Field label="Namespace (opcionális)" value={recallNs} onChange={setRecallNs} placeholder="default" />
            <Btn
              onClick={() => run("recall", () => recall(getCreds(), recallQuery, {
                limit: parseInt(recallLimit) || 10,
                namespace: recallNs || undefined,
                maxDistance: recallMaxDist ? parseFloat(recallMaxDist) : undefined,
              }))}
              disabled={busy || !credsOk || !recallQuery.trim()}
            >
              {loading === "recall" ? "⏳ fut..." : "▶ Futtatás"}
            </Btn>
          </Panel>

          {/* analyze */}
          <Panel title="analyze(text)">
            <Field label="Szöveg (LLM kinyeri a tényeket)" value={analyzeText} onChange={setAnalyzeText} placeholder="Hosszabb szöveg, amiből tényeket kell kiszedni..." multiline />
            <Field label="Namespace (opcionális)" value={analyzeNs} onChange={setAnalyzeNs} placeholder="default" />
            <Btn
              onClick={() => run("analyze", () => analyze(getCreds(), analyzeText, analyzeNs || undefined))}
              disabled={busy || !credsOk || !analyzeText.trim()}
            >
              {loading === "analyze" ? "⏳ fut..." : "▶ Futtatás"}
            </Btn>
          </Panel>

          {/* restore */}
          <Panel title="restore()">
            <p style={{ color: COLORS.muted, fontSize: 12, marginTop: 0, marginBottom: 12 }}>Visszaindexeli a hiányzó bejegyzéseket a Walrus hálózatról.</p>
            <Field label="Namespace (opcionális)" value={restoreNs} onChange={setRestoreNs} placeholder="default" />
            <Field label="Limit (opcionális)" value={restoreLimit} onChange={setRestoreLimit} placeholder="100" />
            <Btn
              onClick={() => run("restore", () => restore(getCreds(), restoreNs || undefined, restoreLimit ? parseInt(restoreLimit) : undefined))}
              disabled={busy || !credsOk}
            >
              {loading === "restore" ? "⏳ fut..." : "▶ Futtatás"}
            </Btn>
          </Panel>

          {results.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <Btn variant="ghost" onClick={() => setResults([])}>🗑 Eredmények törlése</Btn>
            </div>
          )}
        </div>

        {/* Right: results */}
        <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 53px)" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: COLORS.muted }}>EREDMÉNYEK</span>
            {results.length > 0 && (
              <span style={{ fontSize: 11, background: COLORS.accentDim, color: COLORS.accent, borderRadius: 10, padding: "2px 8px" }}>{results.length}</span>
            )}
            {loading && (
              <span style={{ marginLeft: "auto", fontSize: 12, color: COLORS.warning }}>⏳ {loading}() fut...</span>
            )}
          </div>
          <ResultPane entries={results} />
        </div>
      </div>
    </div>
  );
}