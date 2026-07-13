import { uid } from "./utils";
import type {
  PtbArg,
  PtbDraft,
  PtbExecutionRecord,
  PtbPureType,
  PtbStep,
  PtbStepKind,
} from "./ptb-playground-types";
import { PTB_HISTORY_KEY, PTB_STORAGE_KEY } from "./ptb-playground-types";

const MAX_HISTORY = 20;

const PURE_TYPES = new Set<PtbPureType>([
  "u64",
  "u8",
  "u32",
  "bool",
  "address",
  "string",
]);

export const DEFAULT_PTB_DRAFT: PtbDraft = {
  name: "Untitled PTB",
  steps: [],
  updatedAt: Date.now(),
};

function defaultArg(kind: PtbArg["kind"] = "gas"): PtbArg {
  switch (kind) {
    case "object":
      return { kind: "object", objectId: "" };
    case "pure":
      return { kind: "pure", pureType: "u64", value: "0" };
    case "ref":
      return { kind: "ref", stepId: "", index: 0 };
    default:
      return { kind: "gas" };
  }
}

export function normalizePtbArg(raw: unknown): PtbArg {
  if (!raw || typeof raw !== "object") return defaultArg();

  const arg = raw as Partial<PtbArg> & { kind?: string };
  switch (arg.kind) {
    case "object":
      return {
        kind: "object",
        objectId: typeof arg.objectId === "string" ? arg.objectId : "",
      };
    case "pure": {
      const pureType = PURE_TYPES.has(arg.pureType as PtbPureType)
        ? (arg.pureType as PtbPureType)
        : "u64";
      return {
        kind: "pure",
        pureType,
        value: typeof arg.value === "string" ? arg.value : "0",
      };
    }
    case "ref":
      return {
        kind: "ref",
        stepId: typeof arg.stepId === "string" ? arg.stepId : "",
        index:
          typeof arg.index === "number" && Number.isFinite(arg.index)
            ? Math.max(0, Math.trunc(arg.index))
            : 0,
      };
    case "gas":
      return { kind: "gas" };
    default:
      return defaultArg();
  }
}

export function normalizePtbStep(raw: unknown): PtbStep | null {
  if (!raw || typeof raw !== "object") return null;

  const step = raw as Partial<PtbStep> & { kind?: string };
  const id = typeof step.id === "string" && step.id.trim() ? step.id : uid();
  const kind = step.kind as PtbStepKind | undefined;

  switch (kind) {
    case "moveCall":
      return {
        id,
        kind: "moveCall",
        target:
          typeof step.target === "string" ? step.target : "0xPACKAGE_ID::module::function_name",
        typeArguments: Array.isArray(step.typeArguments)
          ? step.typeArguments.filter((value): value is string => typeof value === "string")
          : [],
        arguments: Array.isArray(step.arguments)
          ? step.arguments.map(normalizePtbArg)
          : [],
      };
    case "splitCoins":
      return {
        id,
        kind: "splitCoins",
        coin: normalizePtbArg(
          (step as { coin?: unknown }).coin ?? defaultArg("gas"),
        ),
        amounts: Array.isArray((step as { amounts?: unknown }).amounts)
          ? (step as { amounts: unknown[] }).amounts
              .map((amount) => String(amount ?? "").trim())
              .filter(Boolean)
          : ["100000000"],
      };
    case "mergeCoins":
      return {
        id,
        kind: "mergeCoins",
        destination: normalizePtbArg(
          (step as { destination?: unknown }).destination ?? defaultArg("gas"),
        ),
        sources: Array.isArray((step as { sources?: unknown }).sources)
          ? (step as { sources: unknown[] }).sources.map(normalizePtbArg)
          : [{ kind: "object", objectId: "" }],
      };
    case "transferObjects":
      return {
        id,
        kind: "transferObjects",
        objects: Array.isArray((step as { objects?: unknown }).objects)
          ? (step as { objects: unknown[] }).objects.map(normalizePtbArg)
          : [{ kind: "ref", stepId: "", index: 0 }],
        recipient:
          typeof (step as { recipient?: unknown }).recipient === "string"
            ? (step as { recipient: string }).recipient
            : "",
      };
    default:
      return null;
  }
}

export function normalizePtbDraft(raw: unknown): PtbDraft {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_PTB_DRAFT, updatedAt: Date.now() };
  }

  const draft = raw as Partial<PtbDraft>;
  const steps = Array.isArray(draft.steps)
    ? draft.steps
        .map(normalizePtbStep)
        .filter((step): step is PtbStep => step != null)
    : [];

  return {
    name:
      typeof draft.name === "string" ? draft.name : DEFAULT_PTB_DRAFT.name,
    steps,
    updatedAt:
      typeof draft.updatedAt === "number" && Number.isFinite(draft.updatedAt)
        ? draft.updatedAt
        : Date.now(),
  };
}

export function loadPtbDraft(): PtbDraft {
  try {
    const raw = localStorage.getItem(PTB_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PTB_DRAFT };
    const parsed = JSON.parse(raw) as unknown;
    const normalized = normalizePtbDraft(parsed);
    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      localStorage.setItem(PTB_STORAGE_KEY, JSON.stringify(normalized));
    }
    return normalized;
  } catch {
    return { ...DEFAULT_PTB_DRAFT };
  }
}

let ptbDraftSaveDepth = 0;

export function savePtbDraft(draft: PtbDraft, options?: { notify?: boolean }) {
  const next = normalizePtbDraft({ ...draft, updatedAt: Date.now() });
  localStorage.setItem(PTB_STORAGE_KEY, JSON.stringify(next));
  if (options?.notify !== false) {
    ptbDraftSaveDepth += 1;
    window.dispatchEvent(new CustomEvent("beluga-ptb-draft-changed"));
    ptbDraftSaveDepth -= 1;
  }
  return next;
}

export function isPtbDraftSaveInProgress() {
  return ptbDraftSaveDepth > 0;
}

export function loadPtbHistory(): PtbExecutionRecord[] {
  try {
    const raw = localStorage.getItem(PTB_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PtbExecutionRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendPtbHistory(record: Omit<PtbExecutionRecord, "id">) {
  const entry: PtbExecutionRecord = { id: uid(), ...record };
  const history = [entry, ...loadPtbHistory()].slice(0, MAX_HISTORY);
  localStorage.setItem(PTB_HISTORY_KEY, JSON.stringify(history));
  window.dispatchEvent(new CustomEvent("beluga-ptb-history-changed"));
  return entry;
}

export function createStep(kind: PtbStep["kind"]): PtbStep {
  const id = uid();
  switch (kind) {
    case "moveCall":
      return {
        id,
        kind: "moveCall",
        target: "0xPACKAGE_ID::module::function_name",
        typeArguments: [],
        arguments: [{ kind: "pure", pureType: "u64", value: "1" }],
      };
    case "splitCoins":
      return {
        id,
        kind: "splitCoins",
        coin: { kind: "gas" },
        amounts: ["100000000"],
      };
    case "mergeCoins":
      return {
        id,
        kind: "mergeCoins",
        destination: { kind: "gas" },
        sources: [{ kind: "object", objectId: "" }],
      };
    case "transferObjects":
      return {
        id,
        kind: "transferObjects",
        objects: [{ kind: "ref", stepId: "", index: 0 }],
        recipient: "",
      };
    default:
      throw new Error(`Unknown step kind: ${kind}`);
  }
}