import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

export {
  SectionHeader,
  StatusChip,
  IconButton,
  PrimaryButton,
  AlertBanner,
  SearchField,
} from "../packagesComponents/packages-ui";

export function SkillsPanel({ children }: { children: ReactNode }) {
  return (
    <div className="packages-panel-in h-full min-h-0">{children}</div>
  );
}

export function SkillCardSkeleton({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-[#14141c]/80 px-3 py-2.5 packages-shimmer">
        <div className="h-3.5 w-2/3 rounded-md bg-white/[0.06] mb-1.5" />
        <div className="h-3 w-full rounded-md bg-white/[0.04] mb-1" />
        <div className="h-2.5 w-1/2 rounded-md bg-white/[0.04]" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#14141c]/80 p-4 packages-shimmer">
      <div className="h-4 w-2/3 rounded-lg bg-white/[0.06] mb-2" />
      <div className="h-3 w-full rounded-lg bg-white/[0.04] mb-1" />
      <div className="h-3 w-1/2 rounded-lg bg-white/[0.04]" />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-6">
      <div className="w-14 h-14 mb-4 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-[#444466]">
        {icon}
      </div>
      <p className="text-[15px] font-semibold text-[#e8e8f0] mb-2">{title}</p>
      <p className="text-[13px] text-[#8888a0] leading-relaxed max-w-sm mb-5">
        {description}
      </p>
      {action}
    </div>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="block text-[10px] font-bold uppercase tracking-[1.1px] text-[#666688] mb-2">
      {children}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  mono = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full h-10 rounded-xl bg-[#12121a]/90 border border-white/[0.08] px-3.5 text-[13px] text-[#e8e8f0] outline-none transition-all duration-200 placeholder:text-[#55556a] focus:border-[#4ca3ff]/40 focus:bg-[#14141f] focus:shadow-[0_0_0_3px_rgba(76,163,255,0.1)] ${
        mono ? "font-mono" : ""
      }`}
    />
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full resize-none rounded-xl bg-[#12121a]/90 border border-white/[0.08] px-3.5 py-3 text-[13px] text-[#e8e8f0] outline-none font-mono leading-relaxed transition-all duration-200 placeholder:text-[#55556a] focus:border-[#4ca3ff]/40 focus:bg-[#14141f] focus:shadow-[0_0_0_3px_rgba(76,163,255,0.1)] ${className}`}
    />
  );
}

export function CodePreview({ children }: { children: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c14]/90 p-5 overflow-y-auto">
      <pre className="text-[13px] text-[#b8c0d8] whitespace-pre-wrap font-mono leading-relaxed">
        {children}
      </pre>
    </div>
  );
}

export function LoadingSpinner({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-[#8888a0]">
      <Loader2 size={22} className="animate-spin text-[#4ca3ff]" />
      <span className="text-[12px]">{label}</span>
    </div>
  );
}