import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

export function PackagesPanel({ children }: { children: ReactNode }) {
  return (
    <div className="packages-panel-in h-full min-h-0">{children}</div>
  );
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

export function StatusChip({
  tone,
  icon,
  children,
}: {
  tone: "ok" | "warn" | "info" | "neutral";
  icon?: ReactNode;
  children: ReactNode;
}) {
  const styles = {
    ok: "border-[#00d4aa]/30 text-[#00d4aa] bg-[#00d4aa]/10",
    warn: "border-[#ffb347]/30 text-[#ffb347] bg-[#ffb347]/10",
    info: "border-[#4ca3ff]/30 text-[#4ca3ff] bg-[#4ca3ff]/10",
    neutral: "border-white/[0.08] text-[#a8a8c0] bg-white/[0.03]",
  }[tone];

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors duration-200 ${styles}`}
    >
      {icon}
      {children}
    </span>
  );
}

export function IconButton({
  onClick,
  disabled,
  children,
  title,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="h-9 px-3.5 flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] text-[12px] text-[#8888a0] hover:text-[#f0f0f5] hover:border-white/[0.14] hover:bg-white/[0.06] cursor-pointer disabled:opacity-50 transition-all duration-200 ease-out"
    >
      {children}
    </button>
  );
}

export function PrimaryButton({
  onClick,
  disabled,
  loading,
  tone = "blue",
  size = "default",
  title,
  children,
  className = "",
}: {
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone?: "blue" | "green" | "red" | "ghost";
  size?: "default" | "icon";
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    blue: "border-[#4ca3ff]/35 bg-[#4ca3ff]/12 text-[#7ec4ff] hover:bg-[#4ca3ff]/20 hover:border-[#4ca3ff]/50",
    green: "border-[#00d4aa]/35 bg-[#00d4aa]/12 text-[#5eecc8] hover:bg-[#00d4aa]/20 hover:border-[#00d4aa]/50",
    red: "border-[#ff4d6d]/30 bg-[#ff4d6d]/10 text-[#ff7b93] hover:bg-[#ff4d6d]/18 hover:border-[#ff4d6d]/45",
    ghost:
      "border-white/[0.08] bg-white/[0.03] text-[#c7c7d8] hover:bg-white/[0.06] hover:border-white/[0.14]",
  };

  const sizes = {
    default: "h-9 px-4 gap-2",
    icon: "h-8 w-8 p-0 gap-0",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      className={`rounded-xl text-[12px] font-medium border cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all duration-200 ease-out active:scale-[0.98] ${sizes[size]} ${tones[tone]} ${className}`}
    >
      {loading ? (
        <Loader2
          size={size === "icon" ? 13 : 14}
          className="animate-spin flex-shrink-0"
        />
      ) : null}
      {children}
    </button>
  );
}

export function AlertBanner({
  tone,
  children,
  action,
}: {
  tone: "error" | "success";
  children: ReactNode;
  action?: ReactNode;
}) {
  const styles =
    tone === "error"
      ? "border-[#ff4d6d]/25 bg-[#ff4d6d]/[0.08] text-[#ff8fa3]"
      : "border-[#00d4aa]/25 bg-[#00d4aa]/[0.08] text-[#5eecc8]";

  return (
    <div
      className={`mb-4 px-4 py-3 rounded-2xl border text-[13px] leading-relaxed packages-banner-in ${styles}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span>{children}</span>
        {action}
      </div>
    </div>
  );
}

export function CategoryPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 px-3.5 rounded-full text-[11px] font-medium border cursor-pointer transition-all duration-200 ease-out ${
        active
          ? "bg-[#4ca3ff]/18 border-[#4ca3ff]/40 text-[#9ed0ff] shadow-[0_0_20px_rgba(76,163,255,0.12)]"
          : "bg-transparent border-white/[0.08] text-[#8888a0] hover:text-[#d6d6e8] hover:border-white/[0.14] hover:bg-white/[0.03]"
      }`}
    >
      {children}
    </button>
  );
}

export function PackageCardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#14141c]/80 p-5 packages-shimmer">
      <div className="h-9 w-9 rounded-xl bg-white/[0.06] mb-4" />
      <div className="h-4 w-2/3 rounded-lg bg-white/[0.06] mb-2" />
      <div className="h-3 w-full rounded-lg bg-white/[0.04] mb-1" />
      <div className="h-3 w-4/5 rounded-lg bg-white/[0.04] mb-5" />
      <div className="h-8 w-20 rounded-lg bg-white/[0.05]" />
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  icon,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  icon: ReactNode;
}) {
  return (
    <div className="relative flex-1 min-w-[220px] max-w-md group">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#666688] group-focus-within:text-[#4ca3ff] transition-colors duration-200">
        {icon}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-10 pl-10 pr-4 rounded-2xl bg-[#12121a]/90 border border-white/[0.08] text-[13px] text-[#e8e8f0] outline-none transition-all duration-200 ease-out placeholder:text-[#55556a] focus:border-[#4ca3ff]/40 focus:bg-[#14141f] focus:shadow-[0_0_0_3px_rgba(76,163,255,0.1)]"
      />
    </div>
  );
}

export function ProgressBar({
  value,
  indeterminate = false,
  gradient = "from-[#4ca3ff] to-[#00d4aa]",
}: {
  value: number;
  indeterminate?: boolean;
  gradient?: string;
}) {
  return (
    <div className="h-2 rounded-full bg-[#1a1a24] overflow-hidden border border-white/[0.04]">
      {indeterminate ? (
        <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-[#00e5ff]/20 via-[#00e5ff]/60 to-[#00e5ff]/20 packages-progress-indeterminate" />
      ) : (
        <div
          className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-700 ease-out packages-progress-fill`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      )}
    </div>
  );
}