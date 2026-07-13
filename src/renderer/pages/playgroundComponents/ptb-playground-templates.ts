import { uid } from "./utils";
import type { PtbDraft } from "./ptb-playground-types";

export interface PtbTemplate {
  id: string;
  name: string;
  description: string;
  draft: PtbDraft;
}

function stepId() {
  return uid();
}

export const PTB_TEMPLATES: PtbTemplate[] = [
  {
    id: "split-transfer-sui",
    name: "Split & transfer SUI",
    description: "Split 0.1 SUI from gas coin and send to a recipient.",
    draft: {
      name: "Split & transfer SUI",
      updatedAt: Date.now(),
      steps: (() => {
        const splitId = stepId();
        return [
          {
            id: splitId,
            kind: "splitCoins" as const,
            coin: { kind: "gas" as const },
            amounts: ["100000000"],
          },
          {
            id: stepId(),
            kind: "transferObjects" as const,
            objects: [{ kind: "ref" as const, stepId: splitId, index: 0 }],
            recipient: "",
          },
        ];
      })(),
    },
  },
  {
    id: "merge-coins",
    name: "Merge coins into gas",
    description: "Merge a coin object into the wallet gas coin.",
    draft: {
      name: "Merge coins",
      updatedAt: Date.now(),
      steps: [
        {
          id: stepId(),
          kind: "mergeCoins",
          destination: { kind: "gas" },
          sources: [{ kind: "object", objectId: "" }],
        },
      ],
    },
  },
  {
    id: "move-call",
    name: "Custom move call",
    description: "Call any published entry function with typed arguments.",
    draft: {
      name: "Custom move call",
      updatedAt: Date.now(),
      steps: [
        {
          id: stepId(),
          kind: "moveCall",
          target: "0xPACKAGE_ID::module::function_name",
          typeArguments: [],
          arguments: [
            { kind: "pure", pureType: "u64", value: "1" },
          ],
        },
      ],
    },
  },
  {
    id: "split-merge-transfer",
    name: "Split → merge → transfer",
    description: "Split SUI, merge into another coin, then transfer that coin.",
    draft: {
      name: "Split merge transfer",
      updatedAt: Date.now(),
      steps: (() => {
        const splitId = stepId();
        const mergeId = stepId();
        return [
          {
            id: splitId,
            kind: "splitCoins" as const,
            coin: { kind: "gas" as const },
            amounts: ["50000000"],
          },
          {
            id: mergeId,
            kind: "mergeCoins" as const,
            destination: { kind: "object" as const, objectId: "" },
            sources: [{ kind: "ref" as const, stepId: splitId, index: 0 }],
          },
          {
            id: stepId(),
            kind: "transferObjects" as const,
            objects: [{ kind: "ref" as const, stepId: mergeId, index: 0 }],
            recipient: "",
          },
        ];
      })(),
    },
  },
];

export function findPtbTemplate(id: string): PtbTemplate | undefined {
  return PTB_TEMPLATES.find((template) => template.id === id);
}