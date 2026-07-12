import { useState } from "react";
import { Eye, FileText, Save } from "lucide-react";
import {
  AlertBanner,
  CodePreview,
  FieldLabel,
  IconButton,
  PrimaryButton,
  TextArea,
  TextInput,
} from "./skills-ui";

export interface SkillDraft {
  name: string;
  description: string;
  content: string;
}

export function SkillEditor({
  draft,
  onChange,
  onSave,
  onCancel,
  saving,
  error,
  isNew,
}: {
  draft: SkillDraft;
  onChange: (next: SkillDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
  isNew: boolean;
}) {
  const [showPreview, setShowPreview] = useState(false);

  const previewText = `---
name: ${draft.name || "skill-name"}
description: ${draft.description || "..."}
---

${draft.content || "(empty)"}`;

  return (
    <div className="flex flex-col h-full min-h-0 max-w-3xl packages-panel-in">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-[22px] font-semibold tracking-[-0.35px] text-[#f4f4fa] mb-1">
            {isNew ? "New skill" : "Edit skill"}
          </h2>
          <p className="text-[13px] text-[#8888a0] leading-relaxed max-w-xl">
            Instruction sets for AI agents — linked to projects via beluga.json.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <IconButton
            onClick={() => setShowPreview((v) => !v)}
            title={showPreview ? "Back to editor" : "Preview"}
          >
            {showPreview ? (
              <FileText size={14} />
            ) : (
              <Eye size={14} />
            )}
            {showPreview ? "Editor" : "Preview"}
          </IconButton>
          <IconButton onClick={onCancel} title="Cancel">
            Cancel
          </IconButton>
          <PrimaryButton tone="blue" onClick={onSave} loading={saving}>
            {!saving ? <Save size={14} className="flex-shrink-0" /> : null}
            {saving ? "Saving..." : "Save skill"}
          </PrimaryButton>
        </div>
      </div>

      {error ? <AlertBanner tone="error">{error}</AlertBanner> : null}

      {showPreview ? (
        <CodePreview>{previewText}</CodePreview>
      ) : (
        <div className="flex flex-1 min-h-0 flex-col gap-5">
          <div>
            <FieldLabel>Name</FieldLabel>
            <TextInput
              value={draft.name}
              onChange={(name) => onChange({ ...draft, name })}
              placeholder="e.g. Sui Move Reviewer"
            />
          </div>
          <div>
            <FieldLabel>Description</FieldLabel>
            <TextInput
              value={draft.description}
              onChange={(description) => onChange({ ...draft, description })}
              placeholder="What this skill does and when agents should use it"
            />
          </div>
          <div className="flex flex-1 min-h-0 flex flex-col">
            <FieldLabel>Instructions (markdown)</FieldLabel>
            <TextArea
              value={draft.content}
              onChange={(content) => onChange({ ...draft, content })}
              placeholder="# Skill instructions&#10;&#10;Write step-by-step guidance for the agent..."
              className="flex-1 min-h-[300px]"
            />
          </div>
        </div>
      )}
    </div>
  );
}