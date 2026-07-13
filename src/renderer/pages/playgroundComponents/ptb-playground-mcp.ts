import { loadWalletNetwork } from "../../types/network";
import {
  describeDraft,
  executePtbDraft,
  summarizeObjectChanges,
} from "./ptb-playground-builder";
import {
  formatPtbExecutionError,
  getPtbDraftValidationIssues,
} from "./ptb-playground-validation";
import {
  loadPtbDraft,
  normalizePtbDraft,
  savePtbDraft,
} from "./ptb-playground-storage";
import { findPtbTemplate, PTB_TEMPLATES } from "./ptb-playground-templates";
import type { PtbDraft } from "./ptb-playground-types";
import type { PlaygroundNetwork } from "./types";
import { getWalletAddress } from "./utils";

function resolveNetwork(requested?: string): PlaygroundNetwork {
  const network = (requested?.trim() || loadWalletNetwork()) as PlaygroundNetwork;
  return network;
}

function parseDraftInput(raw: unknown): PtbDraft {
  if (!raw || typeof raw !== "object") {
    throw new Error("draft must be an object with name and steps.");
  }
  const draft = normalizePtbDraft(raw);
  if (!Array.isArray(draft.steps)) {
    throw new Error("draft.steps must be an array.");
  }
  return draft;
}

export async function mcpPtbGetDraft() {
  const draft = loadPtbDraft();
  return {
    draft,
    preview: describeDraft(draft),
    stepCount: draft.steps.length,
  };
}

export async function mcpPtbSetDraft(params: { draft: PtbDraft }) {
  const draft = parseDraftInput(params.draft);
  const saved = savePtbDraft(draft);
  return {
    message: `Saved PTB draft "${saved.name}" (${saved.steps.length} steps)`,
    draft: saved,
    preview: describeDraft(saved),
  };
}

export async function mcpPtbLoadTemplate(params: { template_id: string }) {
  const template = findPtbTemplate(params.template_id.trim());
  if (!template) {
    throw new Error(
      `Unknown template "${params.template_id}". Use playground_ptb_list_templates.`,
    );
  }
  const saved = savePtbDraft({
    ...template.draft,
    updatedAt: Date.now(),
  });
  return {
    message: `Loaded template: ${template.name}`,
    draft: saved,
    preview: describeDraft(saved),
  };
}

export async function mcpPtbListTemplates() {
  return {
    templates: PTB_TEMPLATES.map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      stepCount: template.draft.steps.length,
    })),
  };
}

export async function mcpPtbPreview(params?: { draft?: PtbDraft }) {
  const address = await getWalletAddress();
  const draft = params?.draft ? parseDraftInput(params.draft) : loadPtbDraft();
  return {
    preview: describeDraft(draft),
    draft,
    stepCount: draft.steps.length,
    validationIssues: getPtbDraftValidationIssues(draft, {
      senderAddress: address ?? undefined,
    }),
  };
}

export async function mcpPtbExecute(params?: {
  draft?: PtbDraft;
  network?: string;
}) {
  const address = await getWalletAddress();
  if (!address) {
    throw new Error("Connect or create a Beluga wallet first.");
  }

  const draft = params?.draft ? parseDraftInput(params.draft) : loadPtbDraft();
  if (draft.steps.length === 0) {
    throw new Error("PTB draft has no steps.");
  }

  const network = resolveNetwork(params?.network);
  try {
    const result = await executePtbDraft({
      draft,
      address,
      network,
    });

    if (!params?.draft) {
      savePtbDraft(draft);
    }

    return {
      message: `PTB executed on ${network}`,
      digest: result.digest,
      preview: describeDraft(draft),
      autoAdded: result.autoAdded ?? [],
      objectChanges: summarizeObjectChanges(result.objectChanges),
    };
  } catch (error: unknown) {
    const raw = error instanceof Error ? error.message : String(error);
    throw new Error(formatPtbExecutionError(raw));
  }
}