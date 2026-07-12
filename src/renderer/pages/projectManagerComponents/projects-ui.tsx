import type { ReactNode } from "react";
import { LayoutGrid, List, Loader2 } from "lucide-react";

export {
  SearchField,
  AlertBanner,
  PrimaryButton,
  IconButton,
} from "../packagesComponents/packages-ui";

export function ProjectsPanel({ children }: { children: ReactNode }) {
  return <div className="packages-panel-in h-full min-h-0">{children}</div>;
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div>
        <h2 className="text-[22px] font-semibold tracking-[-0.35px] text-[#f4f4fa] mb-1">
          {title}
        </h2>
        {subtitle ? (
          <p className="text-[13px] text-[#8888a0] leading-relaxed max-w-2xl">
            {subtitle}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
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

export function FilterChip({
  active,
  onClick,
  children,
  count,
  compact = false,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  count?: number;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg border cursor-pointer whitespace-nowrap ${
        compact ? "px-2.5 py-1.5" : "w-full justify-between rounded-xl px-3 py-2.5 text-left"
      } ${
        active
          ? "border-[#4ca3ff]/35 bg-[#4ca3ff]/10 text-[#9ed0ff]"
          : "border-[#2a2a2a] bg-[#1e1e1e]/60 text-[#a8a8c0] hover:border-[#3a3a48] hover:bg-[#1e1e1e]"
      }`}
    >
      <span className={`font-medium truncate ${compact ? "text-[11px]" : "text-[12px]"}`}>
        {children}
      </span>
      {count != null ? (
        <span
          className={`text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-md ${
            active ? "bg-[#4ca3ff]/20" : "bg-[#262626] text-[#8888a0]"
          }`}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

export function SortSelect({
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
      <option value="recent">Recently updated</option>
      <option value="name">Name (A–Z)</option>
      <option value="files">Most files</option>
    </select>
  );
}

export function ViewToggle({
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
            ? "bg-[#4ca3ff]/15 text-[#7ec4ff]"
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
            ? "bg-[#4ca3ff]/15 text-[#7ec4ff]"
            : "text-[#8888a0] hover:text-[#d6d6e8]"
        }`}
      >
        <List size={14} />
      </button>
    </div>
  );
}

export function ResourceBadge({
  tone,
  icon,
  children,
}: {
  tone: "memory" | "package" | "skill" | "muted";
  icon?: ReactNode;
  children: ReactNode;
}) {
  const styles = {
    memory: "border-[#6c63ff]/30 text-[#b8b0ff] bg-[#6c63ff]/10",
    package: "border-[#4ca3ff]/30 text-[#9ed0ff] bg-[#4ca3ff]/10",
    skill: "border-[#00d4aa]/30 text-[#5eecc8] bg-[#00d4aa]/10",
    muted: "border-[#2a2a2a] text-[#8888a0] bg-[#262626]",
  }[tone];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${styles}`}
    >
      {icon}
      {children}
    </span>
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="rounded-2xl border border-[#2a2a2a] bg-[#1e1e1e] p-5 packages-shimmer">
      <div className="flex gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl bg-[#262626]" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 rounded-lg bg-[#262626]" />
          <div className="h-3 w-1/2 rounded-lg bg-[#222]" />
        </div>
      </div>
      <div className="h-12 rounded-xl bg-[#222] mb-4" />
      <div className="h-6 w-24 rounded-lg bg-[#262626]" />
    </div>
  );
}

export function ProjectsLoading() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-[#8888a0]">
      <Loader2 size={24} className="animate-spin text-[#4ca3ff]" />
      <span className="text-[13px]">Loading projects...</span>
    </div>
  );
}

export function ProjectsEmpty({
  search,
  onCreate,
}: {
  search: string;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="w-14 h-14 mb-4 rounded-2xl border border-[#2a2a2a] bg-[#1e1e1e] flex items-center justify-center text-[#4ca3ff]">
        <LayoutGrid size={24} />
      </div>
      <p className="text-[16px] font-semibold text-[#f0f0f5] mb-2">
        {search ? "No results found" : "No projects yet"}
      </p>
      <p className="text-[13px] text-[#8888a0] max-w-sm leading-relaxed mb-5">
        {search
          ? `No projects matched "${search}".`
          : "Create a project workspace for Move packages, linked memories, and agent skills."}
      </p>
      {!search ? (
        <button
          type="button"
          onClick={onCreate}
          className="h-9 px-4 rounded-xl text-[12px] font-semibold text-white cursor-pointer border border-[#4ca3ff]/40 bg-[#4ca3ff]/20 text-[#9ed0ff] hover:bg-[#4ca3ff]/28"
        >
          Create first project
        </button>
      ) : null}
    </div>
  );
}