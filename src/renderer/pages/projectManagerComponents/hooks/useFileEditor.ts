import { useState, useEffect } from "react";

const getFs = () => (window as any).fs;

// ── useFileEditor ─────────────────────────────────────────────────────────────

export function useFileEditor() {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [editContent, setEditContent] = useState<string>("");
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fs = getFs();

  const handleSelectFile = async (path: string) => {
    if (isDirty) {
      const ok = window.confirm("You have unsaved changes. Discard them?");
      if (!ok) return;
    }
    setSelectedPath(path);
    setIsDirty(false);
    setSaveError(null);
    try {
      const content: string = await fs.readFileContent(path);
      setFileContent(content);
      setEditContent(content);
    } catch {
      setFileContent("Failed to read the file.");
      setEditContent("");
    }
  };

  const handleSave = async () => {
    if (!selectedPath) return;
    setSaving(true);
    setSaveError(null);
    try {
      await fs.writeFileContent(selectedPath, editContent);
      setFileContent(editContent);
      setIsDirty(false);
    } catch (e: any) {
      setSaveError(e.message || "Save error.");
    }
    setSaving(false);
  };

  // Ctrl+S shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (isDirty) handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isDirty, editContent, selectedPath]);

  return {
    selectedPath,
    setSelectedPath,
    fileContent,
    setFileContent,
    editContent,
    setEditContent,
    isDirty,
    setIsDirty,
    saving,
    saveError,
    handleSelectFile,
    handleSave,
  };
}