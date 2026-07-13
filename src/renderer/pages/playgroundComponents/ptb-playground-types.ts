export const PTB_STORAGE_KEY = "beluga-ptb-playground-draft-v1";
export const PTB_HISTORY_KEY = "beluga-ptb-playground-history-v1";

export type PtbPureType = "u64" | "u8" | "u32" | "bool" | "address" | "string";

export type PtbArg =
  | { kind: "gas" }
  | { kind: "object"; objectId: string }
  | { kind: "pure"; pureType: PtbPureType; value: string }
  | { kind: "ref"; stepId: string; index?: number };

export type PtbStepKind =
  | "moveCall"
  | "splitCoins"
  | "mergeCoins"
  | "transferObjects";

export interface PtbMoveCallStep {
  id: string;
  kind: "moveCall";
  target: string;
  typeArguments: string[];
  arguments: PtbArg[];
}

export interface PtbSplitCoinsStep {
  id: string;
  kind: "splitCoins";
  coin: PtbArg;
  amounts: string[];
}

export interface PtbMergeCoinsStep {
  id: string;
  kind: "mergeCoins";
  destination: PtbArg;
  sources: PtbArg[];
}

export interface PtbTransferObjectsStep {
  id: string;
  kind: "transferObjects";
  objects: PtbArg[];
  recipient: string;
}

export type PtbStep =
  | PtbMoveCallStep
  | PtbSplitCoinsStep
  | PtbMergeCoinsStep
  | PtbTransferObjectsStep;

export interface PtbDraft {
  name: string;
  steps: PtbStep[];
  updatedAt: number;
}

export interface PtbExecutionRecord {
  id: string;
  digest: string;
  network: string;
  executedAt: number;
  stepCount: number;
  status: "success" | "failed";
  error?: string;
}

export const PTB_STEP_LABELS: Record<PtbStepKind, string> = {
  moveCall: "Move call",
  splitCoins: "Split coins",
  mergeCoins: "Merge coins",
  transferObjects: "Transfer objects",
};

export function ptbStepKindLabel(step: Pick<PtbStep, "kind">): string {
  return PTB_STEP_LABELS[step.kind] ?? "Unknown step";
}