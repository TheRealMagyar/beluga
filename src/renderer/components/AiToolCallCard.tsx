import { useEffect, useState } from "react";
import { ChevronDown, Wrench, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import type { ToolActivity } from "../hooks/useAiChat";

function formatJson(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatToolArgs(tool: ToolActivity): string {
  if (tool.argsDisplay?.trim()) return tool.argsDisplay;
  if (tool.args && Object.keys(tool.args).length > 0) {
    return formatJson(tool.args);
  }
  return "{}";
}

export function AiToolCallCard({ tool }: { tool: ToolActivity }) {
  const [open, setOpen] = useState(tool.status === "running");
  const hasDetails =
    Boolean(tool.argsDisplay?.trim()) ||
    (tool.args != null && Object.keys(tool.args).length > 0) ||
    Boolean(tool.result?.trim()) ||
    Boolean(tool.preview?.trim());

  useEffect(() => {
    if (tool.status === "running") setOpen(true);
  }, [tool.status, tool.id]);

  const argsText = formatToolArgs(tool);
  const resultText = formatJson(tool.result ?? tool.preview ?? "");

  return (
    <div
      className={`max-w-full min-w-0 rounded-lg border overflow-hidden transition-colors ${
        tool.status === "running"
          ? "ai-tool-running border-[#6c63ff]/35 bg-[#6c63ff]/08"
          : tool.status === "error"
            ? "border-red-500/25 bg-red-500/08"
            : "border-white/[0.08] bg-[#0d0d14]"
      }`}
    >
      <button
        type="button"
        onClick={() => hasDetails && setOpen((v) => !v)}
        disabled={!hasDetails}
        className={`w-full flex items-center gap-2 px-2.5 py-2 text-left bg-transparent border-none ${
          hasDetails ? "cursor-pointer hover:bg-white/[0.03]" : "cursor-default"
        }`}
      >
        {tool.status === "running" ? (
          <Loader2 size={12} className="text-[#6c63ff] animate-spin flex-shrink-0" />
        ) : tool.status === "error" ? (
          <AlertCircle size={12} className="text-red-400 flex-shrink-0" />
        ) : (
          <CheckCircle2 size={12} className="text-[#00d4aa] flex-shrink-0" />
        )}
        <Wrench size={10} className="text-neutral-500 flex-shrink-0" />
        <span className="flex-1 min-w-0 font-mono text-[11px] text-neutral-300 truncate">
          {tool.toolName}
        </span>
        {tool.status === "running" && (
          <span className="text-[10px] text-[#6c63ff] ai-thinking-dots flex-shrink-0">
            running
          </span>
        )}
        {hasDetails && (
          <ChevronDown
            size={12}
            className={`text-neutral-500 flex-shrink-0 transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
          />
        )}
      </button>

      <div
        className={`grid transition-all duration-300 ease-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-2.5 pb-2.5 space-y-2 border-t border-white/[0.06]">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500 mb-1">
                Arguments
              </p>
              <pre className="text-[10px] font-mono text-neutral-400 bg-black/25 rounded-md px-2 py-1.5 m-0 overflow-x-auto whitespace-pre-wrap break-words max-h-36 overflow-y-auto min-h-[1.5rem]">
                {argsText}
              </pre>
            </div>
            {(tool.result || tool.preview) && (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500 mb-1">
                  Response
                </p>
                <pre className="text-[10px] font-mono text-[#a8b0c8] bg-black/25 rounded-md px-2 py-1.5 m-0 overflow-x-auto whitespace-pre-wrap break-all max-h-52 overflow-y-auto">
                  {resultText}
                </pre>
              </div>
            )}
            {tool.status === "running" && !tool.result && (
              <p className="text-[10px] text-neutral-500 italic ai-thinking-dots">
                Waiting for tool response
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AiThinkingIndicator({ label = "Thinking" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-neutral-500 ai-thinking">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full rounded-full bg-[#6c63ff]/40 ai-thinking-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#6c63ff]" />
      </span>
      <span>{label}</span>
      <span className="ai-thinking-dots inline-flex gap-0.5">
        <span>.</span>
        <span>.</span>
        <span>.</span>
      </span>
    </div>
  );
}