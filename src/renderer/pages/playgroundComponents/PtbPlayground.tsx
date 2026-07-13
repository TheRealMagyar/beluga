import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Boxes,
  ChevronDown,
  ChevronRight,
  History,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  Workflow,
} from "lucide-react";
import { useWallet } from "../../components/Walletcontext";
import { NetworkSwitcher } from "../../components/NetworkSwitcher";
import { PlaygroundConsole } from "./PlaygroundConsole";
import type { ConsoleLog } from "./types";
import { NETWORK_CONFIG } from "./constants";
import { uid } from "./utils";
import {
  DefiAlert,
  DefiCopyableText,
  DefiHeaderButton,
  DefiPanel,
  DefiPrimaryButton,
  DefiTabContent,
} from "./defi-ui";
import {
  describeDraft,
  executePtbDraft,
  summarizeObjectChanges,
} from "./ptb-playground-builder";
import { getPtbDraftValidationIssues } from "./ptb-playground-validation";
import {
  appendPtbHistory,
  createStep,
  isPtbDraftSaveInProgress,
  loadPtbDraft,
  loadPtbHistory,
  normalizePtbDraft,
  savePtbDraft,
} from "./ptb-playground-storage";
import { findPtbTemplate, PTB_TEMPLATES } from "./ptb-playground-templates";
import type {
  PtbArg,
  PtbDraft,
  PtbExecutionRecord,
  PtbPureType,
  PtbStep,
  PtbStepKind,
} from "./ptb-playground-types";
import { PTB_STEP_LABELS, ptbStepKindLabel } from "./ptb-playground-types";

type PtbView = "builder" | "preview" | "history";

const STEP_KINDS: PtbStepKind[] = [
  "splitCoins",
  "mergeCoins",
  "transferObjects",
  "moveCall",
];

const PURE_TYPES: PtbPureType[] = [
  "u64",
  "u8",
  "u32",
  "bool",
  "address",
  "string",
];

function stepProducesOutput(step: PtbStep): boolean {
  return step.kind === "splitCoins" || step.kind === "mergeCoins";
}

function inputClassName() {
  return "w-full h-9 px-3 rounded-lg text-[12px] font-mono bg-[#0d0d14] border border-[#2a2a3c] text-[#e8e8f0] outline-none focus:border-[#c084fc]/40 transition-colors";
}

function labelClassName() {
  return "text-[10px] uppercase tracking-wide text-[#55556a] mb-1.5 block";
}

function ArgEditor({
  label,
  arg,
  priorSteps,
  stepIndex,
  onChange,
}: {
  label: string;
  arg: PtbArg | undefined;
  priorSteps: PtbStep[];
  stepIndex: number;
  onChange: (next: PtbArg) => void;
}) {
  const safeArg = arg ?? { kind: "gas" as const };

  const refCandidates = priorSteps
    .map((step, index) => ({ step, index }))
    .filter(
      ({ step, index }) =>
        Boolean(step?.id) && stepProducesOutput(step) && index < stepIndex,
    );

  return (
    <div className="rounded-xl border border-[#2a2a3c]/80 bg-[#0d0d14]/60 p-3 space-y-2">
      <div className="text-[11px] font-medium text-[#c7c7d8]">{label}</div>
      <select
        value={safeArg.kind}
        onChange={(e) => {
          const kind = e.target.value as PtbArg["kind"];
          if (kind === "gas") onChange({ kind: "gas" });
          else if (kind === "object") onChange({ kind: "object", objectId: "" });
          else if (kind === "pure") onChange({ kind: "pure", pureType: "u64", value: "0" });
          else onChange({ kind: "ref", stepId: refCandidates[0]?.step.id ?? "", index: 0 });
        }}
        className={inputClassName()}
      >
        <option value="gas">Gas coin</option>
        <option value="object">Object ID</option>
        <option value="pure">Pure value</option>
        <option value="ref">Step result</option>
      </select>

      {safeArg.kind === "object" && (
        <input
          value={safeArg.objectId ?? ""}
          onChange={(e) => onChange({ ...safeArg, objectId: e.target.value })}
          placeholder="0x..."
          className={inputClassName()}
        />
      )}

      {safeArg.kind === "pure" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <select
            value={safeArg.pureType}
            onChange={(e) =>
              onChange({ ...safeArg, pureType: e.target.value as PtbPureType })
            }
            className={inputClassName()}
          >
            {PURE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <input
            value={safeArg.value ?? ""}
            onChange={(e) => onChange({ ...safeArg, value: e.target.value })}
            placeholder="value"
            className={inputClassName()}
          />
        </div>
      )}

      {safeArg.kind === "ref" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <select
            value={safeArg.stepId ?? ""}
            onChange={(e) => onChange({ ...safeArg, stepId: e.target.value })}
            className={inputClassName()}
          >
            <option value="">Select step…</option>
            {refCandidates.map(({ step, index }) => (
              <option key={step.id} value={step.id}>
                Step {index + 1}: {ptbStepKindLabel(step)}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            value={safeArg.index ?? 0}
            onChange={(e) =>
              onChange({ ...safeArg, index: Number(e.target.value) || 0 })
            }
            placeholder="output index"
            className={inputClassName()}
          />
        </div>
      )}
    </div>
  );
}

function StepCard({
  step,
  index,
  expanded,
  priorSteps,
  onToggle,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
  canMoveUp,
  canMoveDown,
}: {
  step: PtbStep;
  index: number;
  expanded: boolean;
  priorSteps: PtbStep[];
  onToggle: () => void;
  onChange: (next: PtbStep) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  return (
    <div className="rounded-xl border border-[#2a2a3c] bg-[#0d0d14]/80 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-2 min-w-0 flex-1 text-left bg-transparent border-none cursor-pointer p-0"
        >
          {expanded ? (
            <ChevronDown size={14} className="text-[#8888a0] flex-shrink-0" />
          ) : (
            <ChevronRight size={14} className="text-[#8888a0] flex-shrink-0" />
          )}
          <span className="text-[11px] font-mono text-[#c084fc] flex-shrink-0">
            {index + 1}
          </span>
          <span className="text-[12px] font-medium text-[#f0f0f5] truncate">
            {ptbStepKindLabel(step)}
          </span>
        </button>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            className="h-7 w-7 rounded-lg border border-[#2a2a3c] text-[#8888a0] hover:text-[#f0f0f5] disabled:opacity-30 cursor-pointer bg-transparent"
          >
            <ArrowUp size={12} className="mx-auto" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            className="h-7 w-7 rounded-lg border border-[#2a2a3c] text-[#8888a0] hover:text-[#f0f0f5] disabled:opacity-30 cursor-pointer bg-transparent"
          >
            <ArrowDown size={12} className="mx-auto" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="h-7 w-7 rounded-lg border border-[#2a2a3c] text-[#8888a0] hover:text-[#ff4d6d] cursor-pointer bg-transparent"
          >
            <Trash2 size={12} className="mx-auto" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-[#2a2a3c]/60 pt-3">
          {step.kind === "moveCall" && (
            <>
              <div>
                <label className={labelClassName()}>Target</label>
                <input
                  value={step.target}
                  onChange={(e) => onChange({ ...step, target: e.target.value })}
                  placeholder="0xPKG::module::function"
                  className={inputClassName()}
                />
              </div>
              <div>
                <label className={labelClassName()}>Type arguments (comma-separated)</label>
                <input
                  value={step.typeArguments.join(", ")}
                  onChange={(e) =>
                    onChange({
                      ...step,
                      typeArguments: e.target.value
                        .split(",")
                        .map((part) => part.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="0x2::sui::SUI"
                  className={inputClassName()}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={labelClassName()}>Arguments</span>
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...step,
                        arguments: [
                          ...step.arguments,
                          { kind: "pure", pureType: "u64", value: "0" },
                        ],
                      })
                    }
                    className="text-[11px] text-[#c084fc] bg-transparent border-none cursor-pointer"
                  >
                    + Add arg
                  </button>
                </div>
                {step.arguments.map((arg, argIndex) => (
                  <div key={argIndex} className="space-y-2">
                    <ArgEditor
                      label={`Arg ${argIndex + 1}`}
                      arg={arg}
                      priorSteps={priorSteps}
                      stepIndex={index}
                      onChange={(next) => {
                        const args = [...step.arguments];
                        args[argIndex] = next;
                        onChange({ ...step, arguments: args });
                      }}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          ...step,
                          arguments: step.arguments.filter((_, i) => i !== argIndex),
                        })
                      }
                      className="text-[11px] text-[#ff4d6d] bg-transparent border-none cursor-pointer"
                    >
                      Remove arg
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {step.kind === "splitCoins" && (
            <>
              <ArgEditor
                label="Source coin"
                arg={step.coin}
                priorSteps={priorSteps}
                stepIndex={index}
                onChange={(coin) => onChange({ ...step, coin })}
              />
              <div>
                <label className={labelClassName()}>Amounts (MIST, comma-separated)</label>
                <input
                  value={step.amounts.join(", ")}
                  onChange={(e) =>
                    onChange({
                      ...step,
                      amounts: e.target.value
                        .split(",")
                        .map((part) => part.trim())
                        .filter(Boolean),
                    })
                  }
                  className={inputClassName()}
                />
              </div>
            </>
          )}

          {step.kind === "mergeCoins" && (
            <>
              <ArgEditor
                label="Destination coin"
                arg={step.destination}
                priorSteps={priorSteps}
                stepIndex={index}
                onChange={(destination) =>
                  onChange({
                    id: step.id,
                    kind: "mergeCoins",
                    destination,
                    sources: step.sources ?? [],
                  })
                }
              />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={labelClassName()}>Source coins</span>
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        id: step.id,
                        kind: "mergeCoins",
                        destination: step.destination ?? { kind: "gas" },
                        sources: [
                          ...(step.sources ?? []),
                          { kind: "object", objectId: "" },
                        ],
                      })
                    }
                    className="text-[11px] text-[#c084fc] bg-transparent border-none cursor-pointer"
                  >
                    + Add source
                  </button>
                </div>
                {(step.sources ?? []).map((source, sourceIndex) => (
                  <div key={`${step.id}-source-${sourceIndex}`}>
                    <ArgEditor
                      label={`Source ${sourceIndex + 1}`}
                      arg={source}
                      priorSteps={priorSteps}
                      stepIndex={index}
                      onChange={(next) => {
                        const sources = [...(step.sources ?? [])];
                        sources[sourceIndex] = next;
                        onChange({
                          id: step.id,
                          kind: "mergeCoins",
                          destination: step.destination ?? { kind: "gas" },
                          sources,
                        });
                      }}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {step.kind === "transferObjects" && (
            <>
              <div>
                <label className={labelClassName()}>Recipient</label>
                <input
                  value={step.recipient}
                  onChange={(e) => onChange({ ...step, recipient: e.target.value })}
                  placeholder="0x..."
                  className={inputClassName()}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={labelClassName()}>Objects</span>
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...step,
                        objects: [...step.objects, { kind: "gas" }],
                      })
                    }
                    className="text-[11px] text-[#c084fc] bg-transparent border-none cursor-pointer"
                  >
                    + Add object
                  </button>
                </div>
                {step.objects.map((objectArg, objectIndex) => (
                  <ArgEditor
                    key={objectIndex}
                    label={`Object ${objectIndex + 1}`}
                    arg={objectArg}
                    priorSteps={priorSteps}
                    stepIndex={index}
                    onChange={(next) => {
                      const objects = [...step.objects];
                      objects[objectIndex] = next;
                      onChange({ ...step, objects });
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function PtbPlayground() {
  const { walletInfo, network } = useWallet();
  const walletAddress = walletInfo?.address ?? null;

  const [view, setView] = useState<PtbView>("builder");
  const [draft, setDraft] = useState<PtbDraft>(loadPtbDraft);
  const [history, setHistory] = useState<PtbExecutionRecord[]>(loadPtbHistory);
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<{
    digest: string;
    objectChanges: ReturnType<typeof summarizeObjectChanges>;
  } | null>(null);
  const [logs, setLogs] = useState<ConsoleLog[]>([]);

  const addLog = useCallback((level: ConsoleLog["level"], message: string) => {
    const entry = { id: uid(), level, message, timestamp: Date.now() };
    setLogs((prev) => [...prev, entry]);
    void window.belugaConsole.appendPlaygroundLog(entry);
  }, []);

  useEffect(() => {
    const syncDraft = () => {
      if (isPtbDraftSaveInProgress()) return;
      setDraft(loadPtbDraft());
    };
    const syncHistory = () => setHistory(loadPtbHistory());
    window.addEventListener("beluga-ptb-draft-changed", syncDraft);
    window.addEventListener("beluga-ptb-history-changed", syncHistory);
    return () => {
      window.removeEventListener("beluga-ptb-draft-changed", syncDraft);
      window.removeEventListener("beluga-ptb-history-changed", syncHistory);
    };
  }, []);

  const previewText = useMemo(() => describeDraft(draft), [draft]);

  const validationIssues = useMemo(
    () => getPtbDraftValidationIssues(draft, { senderAddress: walletAddress ?? undefined }),
    [draft, walletAddress],
  );

  const persistDraft = useCallback((updater: PtbDraft | ((prev: PtbDraft) => PtbDraft)) => {
    setDraft((prev) => {
      const raw = typeof updater === "function" ? updater(prev) : updater;
      const next = normalizePtbDraft(raw);
      savePtbDraft(next);
      return next;
    });
  }, []);

  const updateStep = useCallback(
    (stepId: string, next: PtbStep) => {
      persistDraft((prev) => ({
        ...prev,
        steps: prev.steps.map((step) => (step.id === stepId ? next : step)),
      }));
    },
    [persistDraft],
  );

  const moveStep = useCallback(
    (index: number, direction: -1 | 1) => {
      persistDraft((prev) => {
        const target = index + direction;
        if (target < 0 || target >= prev.steps.length) return prev;
        const steps = [...prev.steps];
        [steps[index], steps[target]] = [steps[target], steps[index]];
        return { ...prev, steps };
      });
    },
    [persistDraft],
  );

  const removeStep = useCallback(
    (stepId: string) => {
      persistDraft((prev) => ({
        ...prev,
        steps: prev.steps.filter((step) => step.id !== stepId),
      }));
      setExpandedStepId((current) => (current === stepId ? null : current));
    },
    [persistDraft],
  );

  const addStep = useCallback(
    (kind: PtbStepKind) => {
      const step = createStep(kind);
      persistDraft((prev) => ({
        ...prev,
        steps: [...prev.steps, step],
      }));
      setExpandedStepId(step.id);
    },
    [persistDraft],
  );

  const applyTemplate = useCallback(
    (templateId: string) => {
      const template = findPtbTemplate(templateId);
      if (!template) return;
      const next = normalizePtbDraft({
        ...template.draft,
        updatedAt: Date.now(),
        steps: template.draft.steps.map((step) =>
          step.kind === "transferObjects" && walletAddress
            ? { ...step, recipient: walletAddress }
            : step,
        ),
      });
      persistDraft(next);
      setExpandedStepId(next.steps[0]?.id ?? null);
      addLog("info", `Loaded template: ${template.name}`);
    },
    [addLog, persistDraft, walletAddress],
  );

  const handleExecute = useCallback(async () => {
    if (!walletAddress) {
      addLog("warn", "Connect a wallet before executing a PTB.");
      return;
    }
    if (draft.steps.length === 0) {
      addLog("warn", "Add at least one command to the PTB.");
      return;
    }

    setBusy(true);
    addLog("info", `Executing PTB (${draft.steps.length} step${draft.steps.length === 1 ? "" : "s"})…`);

    try {
      const result = await executePtbDraft({
        draft,
        address: walletAddress,
        network,
      });
      for (const note of result.autoAdded ?? []) {
        addLog("info", note);
      }
      const changes = summarizeObjectChanges(result.objectChanges);
      setLastResult({ digest: result.digest, objectChanges: changes });
      appendPtbHistory({
        digest: result.digest,
        network,
        executedAt: Date.now(),
        stepCount: draft.steps.length,
        status: "success",
      });
      addLog("success", `PTB executed — digest ${result.digest}`);
      setView("history");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "PTB execution failed.";
      appendPtbHistory({
        digest: "",
        network,
        executedAt: Date.now(),
        stepCount: draft.steps.length,
        status: "failed",
        error: message,
      });
      addLog("error", message);
    } finally {
      setBusy(false);
    }
  }, [addLog, draft, network, walletAddress]);

  const viewTabs = useMemo(
    () =>
      [
        { id: "builder" as const, label: "Builder", icon: <Workflow size={14} /> },
        { id: "preview" as const, label: "Preview", icon: <Boxes size={14} /> },
        { id: "history" as const, label: "History", icon: <History size={14} /> },
      ] as const,
    [],
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <header className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border-b border-white/[0.06] bg-[#101018]">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-[#c084fc]/12 flex items-center justify-center text-[#c084fc] flex-shrink-0">
            <Workflow size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-[#f0f0f5] leading-none">
              PTB Playground
            </div>
            <div className="text-[10px] text-[#8888a0] mt-0.5 truncate">
              Programmable Transaction Blocks on {NETWORK_CONFIG[network].label}
            </div>
          </div>
        </div>
        <div className="flex-1" />
        <NetworkSwitcher compact />
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-y-auto">
          <div className="p-5 space-y-5 max-w-4xl mx-auto w-full">
            <nav className="flex items-center gap-1 rounded-2xl border border-[#2a2a3c] bg-[#0d0d14] p-1 overflow-x-auto">
              {viewTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setView(tab.id)}
                  className={`flex items-center gap-2 h-9 px-4 rounded-xl text-[12px] font-medium border border-transparent cursor-pointer transition-all whitespace-nowrap ${
                    view === tab.id
                      ? "bg-[#c084fc]/14 text-[#c084fc] border-[#c084fc]/25"
                      : "bg-transparent text-[#8888a0] hover:text-[#f0f0f5]"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>

            {!walletAddress && (
              <DefiAlert tone="warn">
                Connect a Beluga wallet to build and execute PTBs.
              </DefiAlert>
            )}

            {network === "mainnet" && (
              <DefiAlert tone="warn">
                PTB Playground is best for <strong>Localnet</strong> and{" "}
                <strong>Testnet</strong> experimentation.
              </DefiAlert>
            )}

            {view === "builder" && (
              <DefiTabContent tabKey="builder">
                <div className="space-y-5">
                  <DefiPanel
                    title="Transaction draft"
                    subtitle="Chain Move calls, coin operations, and transfers into one PTB."
                    action={
                      <DefiHeaderButton
                        onClick={() => persistDraft((prev) => ({ ...prev, steps: [] }))}
                        disabled={draft.steps.length === 0}
                      >
                        Clear
                      </DefiHeaderButton>
                    }
                  >
                    <div className="p-5 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className={labelClassName()}>Draft name</label>
                          <input
                            value={draft.name}
                            onChange={(e) =>
                              persistDraft((prev) => ({ ...prev, name: e.target.value }))
                            }
                            placeholder="Untitled PTB"
                            className={inputClassName()}
                          />
                        </div>
                        <div>
                          <label className={labelClassName()}>Template</label>
                          <select
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) applyTemplate(e.target.value);
                              e.target.value = "";
                            }}
                            className={inputClassName()}
                          >
                            <option value="">Load template…</option>
                            {PTB_TEMPLATES.map((template) => (
                              <option key={template.id} value={template.id}>
                                {template.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {STEP_KINDS.map((kind) => (
                          <button
                            key={kind}
                            type="button"
                            onClick={() => addStep(kind)}
                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-medium border border-[#2a2a3c] bg-[#12121a] text-[#c084fc] hover:bg-[#c084fc]/10 cursor-pointer transition-colors"
                          >
                            <Plus size={12} />
                            {PTB_STEP_LABELS[kind]}
                          </button>
                        ))}
                      </div>

                      {draft.steps.length === 0 ? (
                        <p className="text-[12px] text-[#55556a]">
                          No commands yet. Add a step or load a template to get started.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {draft.steps.map((step, index) => (
                            <StepCard
                              key={step.id || `step-${index}`}
                              step={step}
                              index={index}
                              expanded={expandedStepId === step.id}
                              priorSteps={draft.steps}
                              onToggle={() =>
                                setExpandedStepId((prev) =>
                                  prev === step.id ? null : step.id,
                                )
                              }
                              onChange={(next) => updateStep(step.id, next)}
                              onMoveUp={() => moveStep(index, -1)}
                              onMoveDown={() => moveStep(index, 1)}
                              onRemove={() => removeStep(step.id)}
                              canMoveUp={index > 0}
                              canMoveDown={index < draft.steps.length - 1}
                            />
                          ))}
                        </div>
                      )}

                      {validationIssues.length > 0 && (
                        <DefiAlert tone="warn">
                          <div className="space-y-1">
                            <div>Fix these issues before executing:</div>
                            <ul className="list-disc pl-4 text-[11px] space-y-0.5">
                              {validationIssues.map((issue) => (
                                <li key={issue}>{issue}</li>
                              ))}
                            </ul>
                          </div>
                        </DefiAlert>
                      )}

                      <div className="flex items-center gap-3 pt-2">
                        <DefiPrimaryButton
                          onClick={() => void handleExecute()}
                          disabled={
                            busy ||
                            !walletAddress ||
                            draft.steps.length === 0 ||
                            validationIssues.length > 0
                          }
                          loading={busy}
                          variant="blue"
                        >
                          <span className="inline-flex items-center gap-2">
                            {busy ? (
                              <RefreshCw size={14} className="animate-spin" />
                            ) : (
                              <Play size={14} />
                            )}
                            {busy ? "Executing…" : "Execute PTB"}
                          </span>
                        </DefiPrimaryButton>
                        <span className="text-[11px] text-[#55556a]">
                          {draft.steps.length} command{draft.steps.length === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>
                  </DefiPanel>
                </div>
              </DefiTabContent>
            )}

            {view === "preview" && (
              <DefiTabContent tabKey="preview">
                <DefiPanel
                  title="PTB preview"
                  subtitle="Human-readable summary of the current draft."
                >
                  <div className="p-5 space-y-4">
                    {validationIssues.length > 0 && (
                      <DefiAlert tone="warn">
                        <div className="space-y-1">
                          <div>Validation issues:</div>
                          <ul className="list-disc pl-4 text-[11px] space-y-0.5">
                            {validationIssues.map((issue) => (
                              <li key={issue}>{issue}</li>
                            ))}
                          </ul>
                        </div>
                      </DefiAlert>
                    )}
                    <pre className="text-[12px] font-mono text-[#d8d8ea] whitespace-pre-wrap break-words leading-relaxed bg-[#0d0d14] rounded-xl border border-[#2a2a3c] p-4">
                      {previewText || "No commands in draft."}
                    </pre>
                    <details className="rounded-xl border border-[#2a2a3c] bg-[#0d0d14] p-4">
                      <summary className="text-[12px] text-[#8888a0] cursor-pointer">
                        Raw JSON draft
                      </summary>
                      <pre className="mt-3 text-[11px] font-mono text-[#c7c7d8] whitespace-pre-wrap break-all">
                        {JSON.stringify(draft, null, 2)}
                      </pre>
                    </details>
                  </div>
                </DefiPanel>
              </DefiTabContent>
            )}

            {view === "history" && (
              <DefiTabContent tabKey="history">
                <DefiPanel
                  title="Execution history"
                  subtitle="Recent PTB runs from this playground."
                >
                  <div className="p-5 space-y-4">
                    {lastResult && (
                      <div className="rounded-xl border border-[#34d399]/25 bg-[#34d399]/8 p-4 space-y-2">
                        <div className="text-[12px] font-medium text-[#34d399]">
                          Last success
                        </div>
                        <DefiCopyableText
                          value={lastResult.digest}
                          textClassName="text-[12px]"
                        />
                        {lastResult.objectChanges.length > 0 && (
                          <ul className="text-[11px] text-[#c7c7d8] space-y-1 mt-2">
                            {lastResult.objectChanges.slice(0, 8).map((change, index) => (
                              <li key={`${change.objectId}-${index}`}>
                                {change.type}
                                {change.objectType ? ` — ${change.objectType}` : ""}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {history.length === 0 ? (
                      <p className="text-[12px] text-[#55556a]">No executions yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {history.map((entry) => (
                          <div
                            key={entry.id}
                            className="rounded-xl border border-[#2a2a3c] bg-[#0d0d14]/70 px-4 py-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span
                                className={`text-[11px] font-medium ${
                                  entry.status === "success"
                                    ? "text-[#34d399]"
                                    : "text-[#ff4d6d]"
                                }`}
                              >
                                {entry.status}
                              </span>
                              <span className="text-[10px] text-[#55556a]">
                                {new Date(entry.executedAt).toLocaleString()}
                              </span>
                            </div>
                            {entry.digest ? (
                              <div className="mt-1">
                                <DefiCopyableText
                                  value={entry.digest}
                                  textClassName="text-[11px]"
                                />
                              </div>
                            ) : (
                              <p className="text-[11px] text-[#ff8fa3] mt-1">
                                {entry.error ?? "Failed"}
                              </p>
                            )}
                            <p className="text-[10px] text-[#55556a] mt-1">
                              {entry.stepCount} steps · {entry.network}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </DefiPanel>
              </DefiTabContent>
            )}
          </div>
        </div>
      </div>

      <PlaygroundConsole
        logs={logs}
        onClear={() => setLogs([])}
        onCommand={async (command) => {
          if (command === "__help__") {
            addLog(
              "info",
              "PTB Playground console — use the Builder tab to compose and execute transactions.",
            );
            return;
          }
          addLog("info", `$ ${command}`);
          addLog("warn", "Shell commands are available on the Move tab.");
        }}
      />
    </div>
  );
}