import { Sparkles } from "lucide-react";
import { useAiAssistant } from "../../../context/AiAssistantContext";

type ExplainWithAiButtonProps = {
  prompt: string;
  label?: string;
  variant?: "primary" | "subtle" | "inline";
  className?: string;
};

export function ExplainWithAiButton({
  prompt,
  label = "Explain with AI",
  variant = "subtle",
  className = "",
}: ExplainWithAiButtonProps) {
  const { aiReady, openAssistant } = useAiAssistant();

  if (!aiReady) return null;

  const base =
    "inline-flex items-center gap-1.5 font-medium cursor-pointer transition-colors";

  const styles = {
    primary:
      "px-4 py-2.5 rounded-xl text-[13px] bg-[#6c63ff]/18 border border-solid border-[#6c63ff]/35 text-[#c4c0ff] hover:bg-[#6c63ff]/28",
    subtle:
      "px-3 py-2 rounded-xl text-[12px] bg-[#6c63ff]/10 border border-[#6c63ff]/25 text-[#9d97ff] hover:bg-[#6c63ff]/18 hover:text-[#c4c0ff]",
    inline:
      "px-2 py-1 rounded-lg text-[11px] text-[#9d97ff] hover:text-[#c4c0ff] hover:bg-[#6c63ff]/10 bg-transparent border-none",
  }[variant];

  return (
    <button
      type="button"
      onClick={() => openAssistant(prompt)}
      className={`${base} ${styles} ${className}`}
      title="Open Beluga AI with this lesson as context"
    >
      <Sparkles size={variant === "inline" ? 12 : 14} className="flex-shrink-0" />
      {label}
    </button>
  );
}