import type { ReactNode } from "react";
import { Brain, LayoutGrid, Loader2 } from "lucide-react";

export {
  SearchField,
  AlertBanner,
  PrimaryButton,
  IconButton,
  StatusChip,
} from "../packagesComponents/packages-ui";

export function MemoryPanel({ children }: { children: ReactNode }) {
  return <div className="packages-panel-in h-full min-h-0">{children}</div>;
}

export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#1e1e1e]/80 px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-[1px] text-[#666688] mb-1">
        {label}
      </p>
      <p className="text-[18px] font-semibold text-[#f0f0f5] tabular-nums">
        {value}
      </p>
      {hint ? (
        <p className="text-[10px] text-[#55556a] mt-0.5">{hint}</p>
      ) : null}
    </div>
  );
}

export function MemoryFilterChip({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg border cursor-pointer whitespace-nowrap px-2.5 py-1.5 ${
        active
          ? "border-[#6c63ff]/35 bg-[#6c63ff]/10 text-[#b8b0ff]"
          : "border-[#2a2a2a] bg-[#1e1e1e]/60 text-[#a8a8c0] hover:border-[#3a3a48] hover:bg-[#1e1e1e]"
      }`}
    >
      <span className="font-medium truncate text-[11px]">{children}</span>
      {count != null ? (
        <span
          className={`text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-md ${
            active ? "bg-[#6c63ff]/20" : "bg-[#262626] text-[#8888a0]"
          }`}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

export function MemorySortSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 pl-3 pr-8 rounded-xl border border-[#2a2a2a] bg-[#1e1e1e] text-[12px] text-[#c7c7d8] outline-none cursor-pointer appearance-none bg-[length:12px] bg-[right_10px_center] bg-no-repeat"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238888a0' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
      }}
    >
      <option value="recent">Recently created</option>
      <option value="name">Name (A–Z)</option>
      <option value="network">Network</option>
    </select>
  );
}

export function MemoryViewToggle({
  view,
  onChange,
}: {
  view: "grid" | "list";
  onChange: (view: "grid" | "list") => void;
}) {
  return (
    <div className="flex rounded-xl border border-[#2a2a2a] bg-[#1e1e1e] p-0.5">
      <button
        type="button"
        title="Grid view"
        onClick={() => onChange("grid")}
        className={`h-8 w-8 flex items-center justify-center rounded-lg cursor-pointer ${
          view === "grid"
            ? "bg-[#6c63ff]/15 text-[#b8b0ff]"
            : "text-[#8888a0] hover:text-[#d6d6e8]"
        }`}
      >
        <LayoutGrid size={14} />
      </button>
      <button
        type="button"
        title="List view"
        onClick={() => onChange("list")}
        className={`h-8 w-8 flex items-center justify-center rounded-lg cursor-pointer ${
          view === "list"
            ? "bg-[#6c63ff]/15 text-[#b8b0ff]"
            : "text-[#8888a0] hover:text-[#d6d6e8]"
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
      </button>
    </div>
  );
}

export function NetworkBadge({ network }: { network: "mainnet" | "testnet" }) {
  const isMainnet = network === "mainnet";
  return (
    <span
      className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
        isMainnet
          ? "border-[#00d4aa]/30 text-[#00d4aa] bg-[#00d4aa]/10"
          : "border-[#ffb347]/30 text-[#ffb347] bg-[#ffb347]/10"
      }`}
    >
      {isMainnet ? "Mainnet" : "Testnet"}
    </span>
  );
}

export function MemoryCardSkeleton() {
  return (
    <div className="rounded-2xl border border-[#2a2a2a] bg-[#1e1e1e] p-5 packages-shimmer">
      <div className="flex gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl bg-[#262626]" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 rounded-lg bg-[#262626]" />
          <div className="h-3 w-1/2 rounded-lg bg-[#222]" />
        </div>
      </div>
      <div className="space-y-2 mb-4">
        <div className="h-3 w-full rounded-lg bg-[#222]" />
        <div className="h-3 w-4/5 rounded-lg bg-[#222]" />
      </div>
      <div className="h-8 rounded-xl bg-[#262626]" />
    </div>
  );
}

export function MemoryEmpty({
  search,
  onCreate,
  onImport,
  walletConnected,
}: {
  search: string;
  onCreate: () => void;
  onImport: () => void;
  walletConnected: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="w-14 h-14 mb-4 rounded-2xl border border-[#2a2a2a] bg-[#1e1e1e] flex items-center justify-center text-[#6c63ff]">
        <Brain size={24} />
      </div>
      <p className="text-[16px] font-semibold text-[#f0f0f5] mb-2">
        {search ? "No results found" : "No memory fragments yet"}
      </p>
      <p className="text-[13px] text-[#8888a0] max-w-sm leading-relaxed mb-5">
        {search
          ? `No fragments matched "${search}".`
          : "Each fragment is a standalone Walrus Memory account with its own key, namespace, and history."}
      </p>
      {!search ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={onCreate}
            disabled={!walletConnected}
            className="h-9 px-4 rounded-xl text-[12px] font-semibold cursor-pointer border border-[#6c63ff]/40 bg-[#6c63ff]/20 text-[#b8b0ff] hover:bg-[#6c63ff]/28 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Create fragment
          </button>
          <button
            type="button"
            onClick={onImport}
            className="h-9 px-4 rounded-xl text-[12px] font-semibold cursor-pointer border border-[#2a2a2a] bg-[#1e1e1e] text-[#a8a8c0] hover:border-[#3a3a48] hover:text-[#f0f0f5]"
          >
            Import existing
          </button>
        </div>
      ) : null}
    </div>
  );
}