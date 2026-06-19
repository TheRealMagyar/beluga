import React from "react";

interface FieldRowProps {
  label: string;
  value: string;
  display: string;
  copied: boolean;
  onCopy: (e: React.MouseEvent) => void;
  trailing?: React.ReactNode;
}

export function FieldRow({
  label,
  value,
  display,
  copied,
  onCopy,
  trailing,
}: FieldRowProps) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div
        style={{
          fontSize: 10.5,
          color: "var(--text-faint)",
          marginBottom: 3,
          textTransform: "uppercase",
          letterSpacing: ".5px",
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div
          style={{
            flex: 1,
            fontFamily: "var(--font-mono)",
            fontSize: 11.5,
            background: "var(--surface-2)",
            padding: "6px 9px",
            borderRadius: 7,
            color: "var(--text-dim)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {display}
        </div>
        {trailing}
        <button
          className="wm-btn wm-btn-ghost wm-btn-icon"
          onClick={onCopy}
          title="Copy"
          style={{ fontSize: 12 }}
        >
          {copied ? "✓" : "⧉"}
        </button>
      </div>
    </div>
  );
}
