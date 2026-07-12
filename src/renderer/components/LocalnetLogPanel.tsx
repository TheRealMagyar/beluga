import { useEffect, useMemo, useRef } from "react";
import { CopyButton } from "./CopyButton";

export function LocalnetLogPanel({
  title,
  logs,
  maxLines = 32,
}: {
  title: string;
  logs: string[];
  maxLines?: number;
}) {
  const logRef = useRef<HTMLDivElement>(null);
  const visible = useMemo(() => logs.slice(-maxLines), [logs, maxLines]);
  const copyText = visible.join("\n");
  const tailSignature =
    visible.length > 0
      ? `${visible.length}:${visible[visible.length - 1]}`
      : "empty";

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [tailSignature]);

  return (
    <div className="mt-3 rounded-lg border border-[#2a2a3c] bg-[#0d0d18] overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-b border-[#2a2a3c] bg-[#12121a]">
        <span className="text-[10px] font-medium text-[#8888a0] uppercase tracking-[0.8px]">
          {title}
          {logs.length > 0 ? ` · ${logs.length}` : ""}
        </span>
        {logs.length > 0 && <CopyButton text={copyText} label="Copy logs" />}
      </div>
      <div ref={logRef} className="max-h-44 overflow-y-auto p-2">
        {visible.length === 0 ? (
          <p className="text-[10px] font-mono text-[#55556a]">
            No logs yet — start localnet to see output here.
          </p>
        ) : (
          visible.map((line, index) => (
            <p
              key={`${index}-${line.length}-${line.slice(-24)}`}
              className="text-[10px] font-mono text-[#55556a] leading-relaxed break-all"
            >
              {line}
            </p>
          ))
        )}
      </div>
    </div>
  );
}