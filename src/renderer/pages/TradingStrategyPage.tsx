import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DEFAULT_SUI_USDC_STRATEGY_ID,
  getStrategyMemoryId,
  loadMemoryFragmentOptions,
  loadStrategies,
  saveActiveStrategyId,
  saveStrategies,
  setStrategyMemoryId,
  type TradingStrategy,
} from "./tradingStrategyShared";

const TIMEFRAMES = ["1s", "1m", "5m", "15m", "1h", "4h", "1d"];

export function TradingStrategyPage() {
  const navigate = useNavigate();
  // Load from localStorage immediately — never start as [] (would wipe storage on save)
  const [strategies, setStrategies] = useState<TradingStrategy[]>(() =>
    loadStrategies(),
  );
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [memoryLinkFor, setMemoryLinkFor] = useState<TradingStrategy | null>(
    null,
  );
  const [memoryOptions, setMemoryOptions] = useState<
    Array<{ id: string; label: string; network: string }>
  >([]);
  /** Exactly one selected memory, or null to unlink */
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    symbolsText: "",
    timeframe: "1h",
    entryRules: "",
    exitRules: "",
    agentPrompt: "",
    stopLoss: 2,
    takeProfit: 4,
    memoryId: null as string | null,
  });

  useEffect(() => {
    setStrategies(loadStrategies());
    setMemoryOptions(loadMemoryFragmentOptions());
  }, []);

  // Persist only when we have a real list (skip never — always loaded)
  useEffect(() => {
    if (strategies.length === 0) return;
    saveStrategies(strategies);
  }, [strategies]);

  const resetForm = () => {
    setForm({
      name: "",
      description: "",
      symbolsText: "",
      timeframe: "1h",
      entryRules: "",
      exitRules: "",
      agentPrompt: "",
      stopLoss: 2,
      takeProfit: 4,
      memoryId: null,
    });
    setEditingId(null);
    setShowForm(false);
  };

  const startCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const startEdit = (s: TradingStrategy) => {
    setForm({
      name: s.name,
      description: s.description,
      symbolsText: s.symbols.join(", "),
      timeframe: s.timeframe,
      entryRules: s.entryRules,
      exitRules: s.exitRules,
      agentPrompt: s.agentPrompt || "",
      stopLoss: s.stopLoss,
      takeProfit: s.takeProfit,
      memoryId: getStrategyMemoryId(s),
    });
    setEditingId(s.id);
    setShowForm(true);
  };

  const saveStrategy = () => {
    if (!form.name.trim()) return;

    const symbols = form.symbolsText
      .split(/[\s,]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    const prev = editingId
      ? strategies.find((s) => s.id === editingId)
      : undefined;

    const newStrategy: TradingStrategy = {
      id: editingId || "strat-" + Date.now(),
      name: form.name.trim(),
      description: form.description.trim(),
      symbols,
      timeframe: form.timeframe,
      entryRules: form.entryRules.trim(),
      exitRules: form.exitRules.trim(),
      agentPrompt: form.agentPrompt.trim(),
      memoryId: form.memoryId,
      isDefault: prev?.isDefault,
      stopLoss: Number(form.stopLoss) || 0,
      takeProfit: Number(form.takeProfit) || 0,
      createdAt: prev?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    // Keep durable memory link in sync
    setStrategyMemoryId(newStrategy.id, form.memoryId);

    if (editingId) {
      setStrategies((prevList) =>
        prevList.map((s) =>
          s.id === editingId ? { ...newStrategy, memoryId: form.memoryId } : s,
        ),
      );
    } else {
      setStrategies((prevList) => [
        ...prevList,
        { ...newStrategy, memoryId: form.memoryId },
      ]);
    }

    resetForm();
  };

  const openMemoryLink = (s: TradingStrategy) => {
    setMemoryOptions(loadMemoryFragmentOptions());
    setSelectedMemoryId(getStrategyMemoryId(s));
    setMemoryLinkFor(s);
  };

  const saveMemoryLink = () => {
    if (!memoryLinkFor) return;
    const next = setStrategyMemoryId(memoryLinkFor.id, selectedMemoryId);
    setStrategies(next);
    setMemoryLinkFor(null);
  };

  const selectMemoryId = (id: string) => {
    // Single select: click again to unlink
    setSelectedMemoryId((prev) => (prev === id ? null : id));
  };

  const deleteStrategy = (id: string) => {
    if (id === DEFAULT_SUI_USDC_STRATEGY_ID) {
      alert("Default SUI/USDC strategy cannot be deleted.");
      return;
    }
    setStrategyMemoryId(id, null);
    setStrategies((prev) => prev.filter((s) => s.id !== id));
  };

  const loadOnChart = (s: TradingStrategy) => {
    saveActiveStrategyId(s.id);
    navigate("/charts");
  };

  return (
    <div className="flex h-full flex-col bg-[#0a0a0f] text-[#e8e8f0]">
      <div className="border-b border-white/[0.06] px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">Strategy</div>
            <div className="text-sm text-[#8888a0]">
              Rules for the chart AI agent · load onto Charts → Agent
            </div>
          </div>
          {!showForm && (
            <button
              onClick={startCreate}
              className="rounded-xl border border-[#4ca3ff] bg-[#4ca3ff]/10 px-4 py-2 text-sm font-medium text-[#4ca3ff] hover:bg-[#4ca3ff]/15"
            >
              + Create Strategy
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {showForm && (
          <div className="mb-6 rounded-2xl border border-white/[0.08] bg-[#111114] p-5">
            <div className="mb-4 text-sm font-medium text-[#f4f4fa]">
              {editingId ? "Edit Strategy" : "New Strategy"}
            </div>

            <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <div className="mb-1 text-[11px] uppercase tracking-[0.5px] text-[#66667a]">
                  Strategy Name
                </div>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Breakout Scalper"
                  className="w-full rounded-lg border border-[#2a2a3c] bg-[#0a0a0f] px-3 py-2.5 text-[13px] text-[#f0f0f5] placeholder:text-[#66667a] focus:border-[#6c63ff] focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <div className="mb-1 text-[11px] uppercase tracking-[0.5px] text-[#66667a]">
                  Description
                </div>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Short description of the idea..."
                  rows={2}
                  className="w-full resize-y rounded-lg border border-[#2a2a3c] bg-[#0a0a0f] px-3 py-2.5 text-[13px] text-[#f0f0f5] placeholder:text-[#66667a] focus:border-[#6c63ff] focus:outline-none"
                />
              </div>

              <div>
                <div className="mb-1 text-[11px] uppercase tracking-[0.5px] text-[#66667a]">
                  Symbols (comma separated)
                </div>
                <input
                  value={form.symbolsText}
                  onChange={(e) =>
                    setForm({ ...form, symbolsText: e.target.value })
                  }
                  placeholder="SUI, WAL, DEEP"
                  className="w-full rounded-lg border border-[#2a2a3c] bg-[#0a0a0f] px-3 py-2.5 text-[13px] text-[#f0f0f5] placeholder:text-[#66667a] focus:border-[#6c63ff] focus:outline-none"
                />
              </div>

              <div>
                <div className="mb-1 text-[11px] uppercase tracking-[0.5px] text-[#66667a]">
                  Timeframe
                </div>
                <select
                  value={form.timeframe}
                  onChange={(e) =>
                    setForm({ ...form, timeframe: e.target.value })
                  }
                  className="w-full rounded-lg border border-[#2a2a3c] bg-[#0a0a0f] px-3 py-2.5 text-[13px] text-[#f0f0f5] focus:border-[#6c63ff] focus:outline-none"
                >
                  {TIMEFRAMES.map((tf) => (
                    <option key={tf} value={tf}>
                      {tf}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-1 text-[11px] uppercase tracking-[0.5px] text-[#66667a]">
                  Stop Loss %
                </div>
                <input
                  type="number"
                  value={form.stopLoss}
                  onChange={(e) =>
                    setForm({ ...form, stopLoss: Number(e.target.value) })
                  }
                  className="w-full rounded-lg border border-[#2a2a3c] bg-[#0a0a0f] px-3 py-2.5 text-[13px] text-[#f0f0f5] focus:border-[#6c63ff] focus:outline-none"
                />
              </div>
              <div>
                <div className="mb-1 text-[11px] uppercase tracking-[0.5px] text-[#66667a]">
                  Take Profit %
                </div>
                <input
                  type="number"
                  value={form.takeProfit}
                  onChange={(e) =>
                    setForm({ ...form, takeProfit: Number(e.target.value) })
                  }
                  className="w-full rounded-lg border border-[#2a2a3c] bg-[#0a0a0f] px-3 py-2.5 text-[13px] text-[#f0f0f5] focus:border-[#6c63ff] focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <div className="mb-1 text-[11px] uppercase tracking-[0.5px] text-[#66667a]">
                  Entry Rules
                </div>
                <textarea
                  value={form.entryRules}
                  onChange={(e) =>
                    setForm({ ...form, entryRules: e.target.value })
                  }
                  placeholder="e.g. Long only after bullish BOS + FVG hold..."
                  rows={3}
                  className="w-full resize-y rounded-lg border border-[#2a2a3c] bg-[#0a0a0f] px-3 py-2.5 text-[13px] text-[#f0f0f5] placeholder:text-[#66667a] focus:border-[#6c63ff] focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <div className="mb-1 text-[11px] uppercase tracking-[0.5px] text-[#66667a]">
                  Exit Rules
                </div>
                <textarea
                  value={form.exitRules}
                  onChange={(e) =>
                    setForm({ ...form, exitRules: e.target.value })
                  }
                  placeholder="e.g. Take profit at target or trailing stop..."
                  rows={3}
                  className="w-full resize-y rounded-lg border border-[#2a2a3c] bg-[#0a0a0f] px-3 py-2.5 text-[13px] text-[#f0f0f5] placeholder:text-[#66667a] focus:border-[#6c63ff] focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <div className="mb-1 text-[11px] uppercase tracking-[0.5px] text-[#66667a]">
                  Agent notes (persona / risk style)
                </div>
                <textarea
                  value={form.agentPrompt}
                  onChange={(e) =>
                    setForm({ ...form, agentPrompt: e.target.value })
                  }
                  placeholder="e.g. Conservative. Max 1 position. Prefer 1x leverage. Wait for confluence of OB + BOS..."
                  rows={3}
                  className="w-full resize-y rounded-lg border border-[#2a2a3c] bg-[#0a0a0f] px-3 py-2.5 text-[13px] text-[#f0f0f5] placeholder:text-[#66667a] focus:border-[#6c63ff] focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <div className="mb-1 text-[11px] uppercase tracking-[0.5px] text-[#66667a]">
                  Walrus Memory (exactly one)
                </div>
                <div className="text-[11px] text-[#55556a] mb-2">
                  One strategy → one memory fragment. Link persists after restart.
                </div>
                {memoryOptions.length === 0 ? (
                  <div className="rounded-lg border border-white/[0.06] px-3 py-2 text-[12px] text-[#666]">
                    No memory fragments yet. Create one in Memory Manager first.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {memoryOptions.map((m) => {
                      const on = form.memoryId === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() =>
                            setForm({
                              ...form,
                              memoryId: on ? null : m.id,
                            })
                          }
                          className={`rounded-full border px-2.5 py-1 text-[11px] ${
                            on
                              ? "border-[#00d4aa]/50 bg-[#00d4aa]/15 text-[#00d4aa]"
                              : "border-white/[0.08] text-[#888] hover:border-white/[0.15]"
                          }`}
                        >
                          🧠 {m.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={saveStrategy}
                disabled={!form.name.trim()}
                className="rounded-xl border border-[#4ca3ff] bg-[#4ca3ff] px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
              >
                {editingId ? "Save Strategy" : "Create Strategy"}
              </button>
              <button
                onClick={resetForm}
                className="rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 py-2 text-sm text-[#a8a8c0] hover:text-[#f4f4fa]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {strategies.length === 0 && !showForm && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] p-8 text-center">
            <div className="mb-2 text-sm text-[#8888a0]">No strategies yet.</div>
            <button
              onClick={startCreate}
              className="mt-1 rounded-xl border border-[#4ca3ff] bg-[#4ca3ff]/10 px-4 py-2 text-sm font-medium text-[#4ca3ff]"
            >
              Create your first strategy
            </button>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {strategies.map((s) => (
            <div
              key={s.id}
              className="flex flex-col rounded-2xl border border-white/[0.06] bg-[#111114] p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-[#f4f4fa]">{s.name}</div>
                  <div className="text-[11px] text-[#8888a0]">
                    {s.symbols.join(", ") || "any"} • {s.timeframe}
                  </div>
                </div>
                <div className="flex gap-1.5 text-xs">
                  <button
                    onClick={() => startEdit(s)}
                    className="rounded border border-white/[0.1] px-2 py-0.5 text-[#a8a8c0] hover:text-[#f4f4fa]"
                  >
                    Edit
                  </button>
                  {s.id !== DEFAULT_SUI_USDC_STRATEGY_ID && (
                    <button
                      onClick={() => deleteStrategy(s.id)}
                      className="rounded border border-white/[0.1] px-2 py-0.5 text-[#aa5555] hover:bg-[#3a2020]"
                    >
                      Delete
                    </button>
                  )}
                  {s.isDefault && (
                    <span className="rounded bg-[#00d4aa]/15 px-1.5 py-0.5 text-[9px] text-[#00d4aa]">
                      DEFAULT
                    </span>
                  )}
                </div>
              </div>

              {s.description && (
                <div className="mt-2 text-sm text-[#a8a8c0]">{s.description}</div>
              )}

              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div className="text-[#66667a]">Stop Loss</div>
                <div className="font-mono text-right text-[#f4f4fa]">
                  {s.stopLoss}%
                </div>
                <div className="text-[#66667a]">Take Profit</div>
                <div className="font-mono text-right text-[#f4f4fa]">
                  {s.takeProfit}%
                </div>
              </div>

              {(s.entryRules || s.exitRules) && (
                <div className="mt-3 space-y-2 text-xs">
                  {s.entryRules && (
                    <div>
                      <div className="text-[#66667a]">Entry</div>
                      <div className="line-clamp-3 text-[#c7c7d8]">
                        {s.entryRules}
                      </div>
                    </div>
                  )}
                  {s.exitRules && (
                    <div>
                      <div className="text-[#66667a]">Exit</div>
                      <div className="line-clamp-3 text-[#c7c7d8]">
                        {s.exitRules}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-3 text-[11px] text-[#66667a]">
                {getStrategyMemoryId(s) ? (
                  <span className="text-[#00d4aa]">
                    🧠 Memory linked
                    {memoryOptions.find((m) => m.id === getStrategyMemoryId(s))
                      ?.label
                      ? ` · ${memoryOptions.find((m) => m.id === getStrategyMemoryId(s))!.label}`
                      : ""}
                  </span>
                ) : (
                  <span>No Walrus memory linked</span>
                )}
              </div>

              <div className="mt-auto flex gap-2 pt-4">
                <button
                  onClick={() => openMemoryLink(s)}
                  className="rounded-xl border border-white/[0.1] px-3 py-1.5 text-xs text-[#a8a8c0] hover:bg-white/[0.04]"
                >
                  Link memory
                </button>
                <button
                  onClick={() => loadOnChart(s)}
                  className="flex-1 rounded-xl border border-[#00d4aa]/30 bg-[#00d4aa]/10 py-1.5 text-xs font-medium text-[#00d4aa] hover:bg-[#00d4aa]/15"
                >
                  Load on chart
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Memory link modal */}
      {memoryLinkFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#121218] p-5 shadow-2xl">
            <div className="mb-1 text-base font-semibold text-[#f4f4fa]">
              Link Walrus memory
            </div>
            <div className="mb-4 text-[12px] text-[#8888a0]">
              Strategy{" "}
              <span className="text-[#4ca3ff]">{memoryLinkFor.name}</span> —
              pick <strong className="text-[#c8c8d8]">one</strong> memory.
              Notes go to namespace{" "}
              <code className="text-[#888]">
                strategy-{memoryLinkFor.id.slice(0, 24)}
                {memoryLinkFor.id.length > 24 ? "…" : ""}
              </code>
              , not <code className="text-[#666]">default</code>. Link
              survives app restart.
            </div>
            {memoryOptions.length === 0 ? (
              <div className="py-6 text-center text-[13px] text-[#666]">
                No fragments. Create one in Memory Manager.
              </div>
            ) : (
              <div className="mb-4 max-h-64 space-y-2 overflow-auto">
                {memoryOptions.map((m) => {
                  const on = selectedMemoryId === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => selectMemoryId(m.id)}
                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-[13px] ${
                        on
                          ? "border-[#00d4aa]/50 bg-[#00d4aa]/10"
                          : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.12]"
                      }`}
                    >
                      <span>
                        🧠 {m.label}{" "}
                        <span className="text-[10px] text-[#555]">
                          {m.network}
                        </span>
                      </span>
                      {on && <span className="text-[#00d4aa]">✓</span>}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMemoryLinkFor(null)}
                className="rounded-xl border border-white/[0.08] px-4 py-2 text-[13px] text-[#888]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveMemoryLink}
                className="rounded-xl bg-[#4ca3ff] px-4 py-2 text-[13px] font-semibold text-black"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
