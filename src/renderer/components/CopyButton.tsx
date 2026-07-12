import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyButton({
  text,
  label = "Copy",
  className = "",
  disabled = false,
}: {
  text: string;
  label?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!text || disabled) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={disabled || !text}
      title={copied ? "Copied!" : `Copy ${label.toLowerCase()}`}
      className={`h-7 px-2.5 flex items-center gap-1.5 rounded-lg border border-[#2a2a3c] text-[11px] text-[#8888a0] hover:text-[#f0f0f5] bg-[#1e1e1e] cursor-pointer disabled:opacity-40 flex-shrink-0 ${className}`}
    >
      {copied ? <Check size={12} className="text-[#00d4aa]" /> : <Copy size={12} />}
      {copied ? "Copied" : label}
    </button>
  );
}