import { Loader2, Play } from "lucide-react";
import { CopyButton } from "../../components/CopyButton";
import type { MoveEntryFunction, MoveEntryParam } from "./project-loader";
import {
  callableParams,
  entryKey,
  paramInputHint,
  paramInputLabel,
  paramValueKey,
  type EntryArgsState,
} from "./entry-test-ui";

function ParamField({
  param,
  value,
  createdObjectIds,
  onChange,
}: {
  param: MoveEntryParam;
  value: string;
  createdObjectIds: string[];
  onChange: (value: string) => void;
}) {
  const fieldKey = paramValueKey(param);
  const hint = paramInputHint(param);

  if (param.kind === "bool") {
    return (
      <div className="space-y-1">
        <label className="text-[11px] text-[#8888a0]">
          {paramInputLabel(param)}
        </label>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-9 px-3 rounded-lg text-[12px] font-mono bg-[#1e1e1e] border border-[#2a2a3c] text-[#f0f0f5] outline-none"
        >
          <option value="false">false</option>
          <option value="true">true</option>
        </select>
      </div>
    );
  }

  if (param.kind === "object") {
    return (
      <div className="space-y-1">
        <label className="text-[11px] text-[#8888a0]">
          {paramInputLabel(param)}
        </label>
        <div className="flex items-center gap-2">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="0x… object ID"
            className="flex-1 h-9 px-3 rounded-lg text-[12px] font-mono bg-[#1e1e1e] border border-[#2a2a3c] text-[#f0f0f5] outline-none placeholder:text-[#55556a]"
          />
          <CopyButton text={value} label="Copy" disabled={!value.trim()} />
        </div>
        {createdObjectIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {createdObjectIds.map((id) => (
              <button
                key={`${fieldKey}-${id}`}
                type="button"
                onClick={() => onChange(id)}
                className="h-6 px-2 rounded-md border border-[#4ca3ff]/25 bg-[#4ca3ff]/10 text-[10px] font-mono text-[#4ca3ff] cursor-pointer hover:bg-[#4ca3ff]/20"
                title={id}
              >
                Use {id.slice(0, 6)}…{id.slice(-4)}
              </button>
            ))}
          </div>
        )}
        {hint && <p className="text-[10px] text-[#666680]">{hint}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <label className="text-[11px] text-[#8888a0]">
        {paramInputLabel(param)}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          param.kind === "address"
            ? "0x…"
            : param.kind === "string"
              ? "text value"
              : param.kind === "coin" || param.kind === "u64"
                ? "1000000000"
                : "0"
        }
        className="w-full h-9 px-3 rounded-lg text-[12px] font-mono bg-[#1e1e1e] border border-[#2a2a3c] text-[#f0f0f5] outline-none placeholder:text-[#55556a]"
      />
      {hint && <p className="text-[10px] text-[#666680]">{hint}</p>}
    </div>
  );
}

export function EntryTestCard({
  entry,
  entryArgs,
  createdObjectIds,
  calling,
  disabled,
  onEntryArgsChange,
  onCall,
}: {
  entry: MoveEntryFunction;
  entryArgs: EntryArgsState;
  createdObjectIds: string[];
  calling: boolean;
  disabled: boolean;
  onEntryArgsChange: (next: EntryArgsState) => void;
  onCall: (entry: MoveEntryFunction) => void;
}) {
  const key = entryKey(entry);
  const params = callableParams(entry);
  const values = entryArgs[key] ?? {};

  const setParamValue = (param: MoveEntryParam, value: string) => {
    onEntryArgsChange({
      ...entryArgs,
      [key]: {
        ...values,
        [paramValueKey(param)]: value,
      },
    });
  };

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#12121a] overflow-hidden">
      <div className="px-3 py-2.5 border-b border-white/[0.06]">
        <p className="text-[12px] font-mono text-[#e8e8f0]">
          {entry.module}::{entry.name}
        </p>
        {params.length > 0 ? (
          <p className="text-[10px] text-[#666680] mt-1 leading-relaxed">
            {params.map((p) => `${p.name}: ${p.typeText}`).join(" · ")}
          </p>
        ) : (
          <p className="text-[10px] text-[#666680] mt-1">No arguments (TxContext only)</p>
        )}
      </div>

      {params.length > 0 && (
        <div className="p-3 space-y-3 border-b border-white/[0.04]">
          {params.map((param) => (
            <ParamField
              key={paramValueKey(param)}
              param={param}
              value={values[paramValueKey(param)] ?? ""}
              createdObjectIds={createdObjectIds}
              onChange={(value) => setParamValue(param, value)}
            />
          ))}
        </div>
      )}

      <div className="p-3">
        <button
          type="button"
          onClick={() => onCall(entry)}
          disabled={disabled || calling}
          className="w-full flex items-center justify-center gap-2 h-9 rounded-xl text-[12px] font-medium border border-[#4ca3ff]/30 bg-[#4ca3ff]/10 text-[#4ca3ff] cursor-pointer disabled:opacity-50"
        >
          {calling ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Play size={13} />
          )}
          Run {entry.name}
        </button>
      </div>
    </div>
  );
}