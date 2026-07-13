import { Transaction, type TransactionObjectArgument } from "@mysten/sui/transactions";
import type { PlaygroundNetwork } from "./types";
import {
  createSuiClient,
  signAndExecuteTransaction,
  type PlaygroundSignerId,
} from "./utils";
import type { PtbArg, PtbDraft, PtbStep } from "./ptb-playground-types";
import {
  formatPtbExecutionError,
  preparePtbDraftForExecution,
} from "./ptb-playground-validation";

type StepOutput = TransactionObjectArgument | TransactionObjectArgument[];

function resolveCoinArg(
  tx: Transaction,
  arg: PtbArg,
  outputs: Map<string, StepOutput>,
): TransactionObjectArgument {
  const resolved = resolveArg(tx, arg, outputs);
  if (!resolved || typeof resolved !== "object") {
    throw new Error("Expected a coin or object argument.");
  }
  return resolved as TransactionObjectArgument;
}

function resolveObjectArgs(
  tx: Transaction,
  args: PtbArg[],
  outputs: Map<string, StepOutput>,
): TransactionObjectArgument[] {
  return args.map((arg) => resolveCoinArg(tx, arg, outputs));
}

function resolvePureArg(tx: Transaction, arg: PtbArg) {
  if (arg.kind !== "pure") {
    throw new Error("Expected a pure value argument.");
  }

  const value = arg.value.trim();
  switch (arg.pureType) {
    case "u64":
      return tx.pure.u64(value || "0");
    case "u32":
      return tx.pure.u32(Number(value || "0"));
    case "u8":
      return tx.pure.u8(Number(value || "0"));
    case "bool":
      return tx.pure.bool(value === "true");
    case "address":
      return tx.pure.address(value || "0x0");
    case "string": {
      const bytes = Array.from(new TextEncoder().encode(value));
      return tx.pure.vector("u8", bytes);
    }
    default:
      throw new Error(`Unsupported pure type: ${arg.pureType}`);
  }
}

function resolveMoveCallArg(
  tx: Transaction,
  arg: PtbArg,
  outputs: Map<string, StepOutput>,
) {
  if (arg.kind === "pure") {
    return resolvePureArg(tx, arg);
  }
  return resolveCoinArg(tx, arg, outputs);
}

export function resolveArg(
  tx: Transaction,
  arg: PtbArg,
  outputs: Map<string, StepOutput>,
): TransactionObjectArgument | ReturnType<typeof resolvePureArg> {
  switch (arg.kind) {
    case "gas":
      return tx.gas;
    case "object": {
      const id = arg.objectId.trim();
      if (!id) throw new Error("Object ID is required.");
      return tx.object(id);
    }
    case "pure":
      return resolvePureArg(tx, arg);
    case "ref": {
      const result = outputs.get(arg.stepId);
      if (!result) {
        throw new Error(`Step output "${arg.stepId}" is not available yet.`);
      }
      const index = arg.index ?? 0;
      if (Array.isArray(result)) {
        const value = result[index];
        if (!value) {
          throw new Error(`Step "${arg.stepId}" has no output at index ${index}.`);
        }
        return value;
      }
      if (index !== 0) {
        throw new Error(`Step "${arg.stepId}" returns a single value (use index 0).`);
      }
      return result;
    }
    default:
      throw new Error("Unknown argument kind.");
  }
}

function applyStep(
  tx: Transaction,
  step: PtbStep,
  outputs: Map<string, StepOutput>,
) {
  switch (step.kind) {
    case "moveCall": {
      const target = step.target.trim();
      if (!target.includes("::")) {
        throw new Error(`Move call target must be package::module::function — got "${target}"`);
      }
      const args = step.arguments.map((arg) => resolveMoveCallArg(tx, arg, outputs));
      tx.moveCall({
        target,
        typeArguments: step.typeArguments.map((typeArg) => typeArg.trim()).filter(Boolean),
        arguments: args,
      });
      break;
    }
    case "splitCoins": {
      const amounts = step.amounts.map((amount) => amount.trim()).filter(Boolean);
      if (amounts.length === 0) {
        throw new Error("splitCoins requires at least one amount.");
      }
      const coin = resolveCoinArg(tx, step.coin, outputs);
      const coins = tx.splitCoins(
        coin,
        amounts.map((amount) => tx.pure.u64(amount)),
      );
      outputs.set(step.id, coins);
      break;
    }
    case "mergeCoins": {
      const destination = resolveCoinArg(
        tx,
        step.destination ?? { kind: "gas" },
        outputs,
      );
      const sources = resolveObjectArgs(tx, step.sources ?? [], outputs);
      if (sources.length === 0) {
        throw new Error("mergeCoins requires at least one source coin.");
      }
      tx.mergeCoins(destination, sources);
      outputs.set(step.id, destination);
      break;
    }
    case "transferObjects": {
      const objects = resolveObjectArgs(tx, step.objects, outputs);
      const recipient = step.recipient.trim();
      if (!recipient) throw new Error("transferObjects requires a recipient address.");
      if (objects.length === 0) {
        throw new Error("transferObjects requires at least one object.");
      }
      tx.transferObjects(objects, recipient);
      break;
    }
    default:
      throw new Error("Unknown PTB step kind.");
  }
}

export function buildTransactionFromDraft(draft: PtbDraft): Transaction {
  const tx = new Transaction();
  const outputs = new Map<string, StepOutput>();

  for (const step of draft.steps) {
    applyStep(tx, step, outputs);
  }

  return tx;
}

export function describeArg(arg: PtbArg, stepIndexById: Map<string, number>): string {
  switch (arg.kind) {
    case "gas":
      return "gas";
    case "object":
      return `object(${arg.objectId || "?"})`;
    case "pure":
      return `${arg.pureType}(${arg.value || ""})`;
    case "ref": {
      const idx = stepIndexById.get(arg.stepId);
      const stepLabel = idx != null ? `step${idx + 1}` : arg.stepId.slice(0, 6);
      const suffix = arg.index != null && arg.index > 0 ? `[${arg.index}]` : "";
      return `$${stepLabel}${suffix}`;
    }
    default:
      return "?";
  }
}

export function describeDraft(draft: PtbDraft): string {
  const stepIndexById = new Map(draft.steps.map((step, index) => [step.id, index]));

  return draft.steps
    .map((step, index) => {
      switch (step.kind) {
        case "moveCall":
          return `${index + 1}. moveCall ${step.target}(${step.arguments
            .map((arg) => describeArg(arg, stepIndexById))
            .join(", ")})`;
        case "splitCoins":
          return `${index + 1}. splitCoins ${describeArg(step.coin, stepIndexById)} → [${step.amounts.join(", ")}]`;
        case "mergeCoins":
          return `${index + 1}. mergeCoins → ${describeArg(step.destination, stepIndexById)} ← ${(step.sources ?? [])
            .map((arg) => describeArg(arg, stepIndexById))
            .join(", ")}`;
        case "transferObjects":
          return `${index + 1}. transfer [${step.objects
            .map((arg) => describeArg(arg, stepIndexById))
            .join(", ")}] → ${step.recipient || "?"}`;
        default:
          return `${index + 1}. unknown`;
      }
    })
    .join("\n");
}

export async function executePtbDraft(params: {
  draft: PtbDraft;
  address: string;
  network: PlaygroundNetwork;
  signerId?: PlaygroundSignerId;
}) {
  const { draft: finalized, autoAdded, appliedDefaults } = preparePtbDraftForExecution(
    params.draft,
    params.address,
  );
  const tx = buildTransactionFromDraft(finalized);

  const client = createSuiClient(params.network);
  try {
    const result = await signAndExecuteTransaction(
      client,
      params.address,
      tx,
      params.network,
      params.signerId ?? "beluga",
    );
    return { ...result, autoAdded: [...appliedDefaults, ...autoAdded] };
  } catch (error: unknown) {
    const raw = error instanceof Error ? error.message : String(error);
    throw new Error(formatPtbExecutionError(raw));
  }
}

export function summarizeObjectChanges(
  changes: Array<{ type?: string; objectType?: string; objectId?: string }> | null | undefined,
) {
  return (changes ?? []).map((change) => ({
    type: change.type ?? "unknown",
    objectType: change.objectType ?? null,
    objectId: change.objectId ?? null,
  }));
}