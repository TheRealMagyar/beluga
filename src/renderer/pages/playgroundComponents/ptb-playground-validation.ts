import { uid } from "./utils";
import type { PtbArg, PtbDraft, PtbStep } from "./ptb-playground-types";

function visitArgs(step: PtbStep, visit: (arg: PtbArg) => void) {
  switch (step.kind) {
    case "moveCall":
      step.arguments.forEach(visit);
      break;
    case "splitCoins":
      visit(step.coin);
      break;
    case "mergeCoins":
      visit(step.destination);
      step.sources.forEach(visit);
      break;
    case "transferObjects":
      step.objects.forEach(visit);
      break;
  }
}

export function collectStepRefs(step: PtbStep): Array<{ stepId: string; index: number }> {
  const refs: Array<{ stepId: string; index: number }> = [];
  visitArgs(step, (arg) => {
    if (arg.kind === "ref" && arg.stepId.trim()) {
      refs.push({ stepId: arg.stepId, index: arg.index ?? 0 });
    }
  });
  return refs;
}

function stepProducesOutput(step: PtbStep): boolean {
  return step.kind === "splitCoins" || step.kind === "mergeCoins";
}

function isLikelySuiAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{2,64}$/.test(value.trim());
}

function isValidObjectId(value: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(value.trim());
}

function isPlaceholderAddress(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    !normalized ||
    normalized === "0x0" ||
    normalized === "0x" ||
    normalized.includes("package_id") ||
    normalized.includes("0x...")
  );
}

function validateCoinArg(label: string, arg: PtbArg, errors: string[]) {
  if (arg.kind === "pure") {
    errors.push(
      `${label}: coin arguments must be Gas, an object ID, or a prior step result — not a pure value.`,
    );
  }
  if (arg.kind === "object") {
    const id = arg.objectId.trim();
    if (!id) {
      errors.push(`${label}: coin object ID is required.`);
    } else if (!isValidObjectId(id)) {
      errors.push(
        `${label}: coin object ID must be a 64-character hex ID (copy from wallet assets).`,
      );
    }
  }
}

export function applyPtbDraftDefaults(
  draft: PtbDraft,
  senderAddress: string,
): { draft: PtbDraft; applied: string[] } {
  const applied: string[] = [];
  const steps = draft.steps.map((step) => {
    if (step.kind !== "transferObjects") return step;
    const recipient = step.recipient.trim();
    if (!isPlaceholderAddress(recipient) || !senderAddress.trim()) return step;
    applied.push(`Defaulted transfer recipient to ${senderAddress}`);
    return { ...step, recipient: senderAddress };
  });
  return {
    draft: applied.length > 0 ? { ...draft, steps } : draft,
    applied,
  };
}

export function getPtbDraftValidationIssues(
  draft: PtbDraft,
  options?: { senderAddress?: string },
): string[] {
  const draftToCheck = options?.senderAddress
    ? applyPtbDraftDefaults(draft, options.senderAddress).draft
    : draft;
  try {
    validatePtbDraft(draftToCheck, options);
    return [];
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return message.split("\n").filter(Boolean);
  }
}

export function validatePtbDraft(
  draft: PtbDraft,
  options?: { senderAddress?: string },
): void {
  const errors: string[] = [];
  const stepIndexById = new Map(draft.steps.map((step, index) => [step.id, index]));

  if (draft.steps.length === 0) {
    throw new Error("Add at least one PTB command.");
  }

  for (const [index, step] of draft.steps.entries()) {
    const label = `Step ${index + 1} (${step.kind})`;

    visitArgs(step, (arg) => {
      if (arg.kind === "gas" && step.kind === "transferObjects") {
        errors.push(
          `${label}: cannot transfer the gas coin — use a split/merge result or a coin object ID.`,
        );
      }
      if (arg.kind === "object") {
        const id = arg.objectId.trim();
        if (!id) {
          errors.push(`${label}: object ID is required.`);
        } else if (!isValidObjectId(id)) {
          errors.push(
            `${label}: object ID must be a 64-character hex ID (0x + 64 hex digits).`,
          );
        }
      }
      if (arg.kind === "ref") {
        if (!arg.stepId.trim()) {
          errors.push(`${label}: pick a prior step for the result reference.`);
          return;
        }
        const sourceIndex = stepIndexById.get(arg.stepId);
        if (sourceIndex == null) {
          errors.push(`${label}: referenced step "${arg.stepId}" was not found.`);
          return;
        }
        if (sourceIndex >= index) {
          errors.push(
            `${label}: can only reference outputs from earlier steps (step ${sourceIndex + 1}).`,
          );
          return;
        }
        const source = draft.steps[sourceIndex];
        if (!stepProducesOutput(source)) {
          errors.push(
            `${label}: step ${sourceIndex + 1} (${source.kind}) does not produce a reusable output.`,
          );
        }
        if (source.kind === "splitCoins" && (arg.index ?? 0) >= source.amounts.length) {
          errors.push(
            `${label}: split step ${sourceIndex + 1} only has ${source.amounts.length} output(s).`,
          );
        }
      }
    });

    if (step.kind === "moveCall") {
      if (!step.target.trim() || step.target.includes("PACKAGE_ID")) {
        errors.push(`${label}: set a real Move target (package::module::function).`);
      }
    }

    if (step.kind === "splitCoins") {
      validateCoinArg(`${label} (source coin)`, step.coin, errors);
      if (step.amounts.length === 0) {
        errors.push(`${label}: add at least one split amount in MIST.`);
      }
      for (const amount of step.amounts) {
        if (!/^\d+$/.test(amount.trim())) {
          errors.push(`${label}: amounts must be whole numbers in MIST (no decimals).`);
        }
      }
    }

    if (step.kind === "mergeCoins") {
      validateCoinArg(`${label} (destination)`, step.destination, errors);
      for (const [sourceIndex, source] of step.sources.entries()) {
        validateCoinArg(`${label} (source ${sourceIndex + 1})`, source, errors);
      }
      if (step.sources.length === 0) {
        errors.push(`${label}: add at least one source coin.`);
      }
    }

    if (step.kind === "transferObjects") {
      if (step.objects.length === 0) {
        errors.push(`${label}: add at least one object or coin to transfer.`);
      }
      const recipient = step.recipient.trim();
      if (isPlaceholderAddress(recipient)) {
        errors.push(
          `${label}: set a recipient address` +
            (options?.senderAddress
              ? ` (e.g. your wallet ${options.senderAddress}).`
              : "."),
        );
      } else if (!isLikelySuiAddress(recipient)) {
        errors.push(`${label}: recipient does not look like a valid 0x address.`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
}

export function preparePtbDraftForExecution(
  draft: PtbDraft,
  senderAddress: string,
): { draft: PtbDraft; autoAdded: string[]; appliedDefaults: string[] } {
  const { draft: withDefaults, applied } = applyPtbDraftDefaults(draft, senderAddress);
  validatePtbDraft(withDefaults, { senderAddress });
  const { draft: finalized, autoAdded } = finalizePtbDraft(withDefaults, senderAddress);
  return { draft: finalized, autoAdded, appliedDefaults: applied };
}

export function finalizePtbDraft(
  draft: PtbDraft,
  senderAddress: string,
): { draft: PtbDraft; autoAdded: string[] } {
  const usedRefs = new Set<string>();

  for (const step of draft.steps) {
    for (const ref of collectStepRefs(step)) {
      usedRefs.add(`${ref.stepId}:${ref.index}`);
    }
  }

  const unusedObjects: PtbArg[] = [];
  for (const step of draft.steps) {
    if (step.kind !== "splitCoins") continue;
    for (let index = 0; index < step.amounts.length; index += 1) {
      const key = `${step.id}:${index}`;
      if (!usedRefs.has(key)) {
        unusedObjects.push({ kind: "ref", stepId: step.id, index });
      }
    }
  }

  if (unusedObjects.length === 0) {
    return { draft, autoAdded: [] };
  }

  const transferStep: PtbStep = {
    id: uid(),
    kind: "transferObjects",
    objects: unusedObjects,
    recipient: senderAddress,
  };

  return {
    draft: {
      ...draft,
      steps: [...draft.steps, transferStep],
    },
    autoAdded: [
      `Auto-added transfer of ${unusedObjects.length} unused split coin(s) to ${senderAddress}`,
    ],
  };
}

export function formatPtbExecutionError(message: string): string {
  if (/UnusedValueWithoutDrop/i.test(message)) {
    return (
      "A command produced a coin/object that was never used. " +
      "After splitCoins, add transferObjects (or merge/moveCall) that references $stepN[0]. " +
      "The playground can also auto-transfer unused splits to your wallet when possible."
    );
  }
  if (/TypeMismatch/i.test(message)) {
    return (
      `Move argument type mismatch. ${message}\n` +
      "Tips: use Gas or a coin ref for Coin<T> parameters; use Object ID for shared/owned objects; " +
      "use Pure for numbers, bools, and addresses. mergeCoins sources must be coin object IDs."
    );
  }
  if (/CommandArgumentError/i.test(message)) {
    return `PTB argument error. ${message}`;
  }
  return message;
}