import {
  useCallback,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Check, Copy } from "lucide-react";

async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  }
}

export function DefiCopyIcon({
  value,
  className = "",
  title = "Copy",
}: {
  value: string;
  className?: string;
  title?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      const ok = await copyToClipboard(value);
      if (!ok) return;
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    },
    [value],
  );

  return (
    <button
      type="button"
      onClick={(e) => void handleCopy(e)}
      title={copied ? "Copied!" : title}
      className={`h-6 w-6 inline-flex items-center justify-center rounded-md text-[#55556a] hover:text-[#f0f0f5] hover:bg-white/[0.06] cursor-pointer flex-shrink-0 transition-colors ${className}`}
    >
      {copied ? (
        <Check size={12} className="text-[#34d399]" />
      ) : (
        <Copy size={12} />
      )}
    </button>
  );
}

export function DefiCopyableText({
  value,
  display,
  truncate = false,
  className = "",
  textClassName = "text-[#c7c7d8]",
}: {
  value: string;
  display?: string;
  truncate?: boolean;
  className?: string;
  textClassName?: string;
}) {
  const [copied, setCopied] = useState(false);
  const shown = display ?? value;

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(value);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }, [value]);

  return (
    <span className={`inline-flex items-center gap-1 min-w-0 max-w-full ${className}`}>
      <button
        type="button"
        onClick={() => void handleCopy()}
        title={copied ? "Copied!" : `${value}\nClick to copy`}
        className={`font-mono text-left bg-transparent border-none p-0 cursor-pointer hover:opacity-85 transition-opacity ${
          truncate ? "truncate min-w-0" : "break-all"
        } ${textClassName} ${copied ? "text-[#34d399]" : ""}`}
      >
        {copied ? "Copied" : shown}
      </button>
      <DefiCopyIcon value={value} />
    </span>
  );
}

export function DefiAddressField({
  label,
  value,
  display,
}: {
  label: string;
  value: string;
  display?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[#55556a] uppercase tracking-wide text-[10px] mb-1.5">
        {label}
      </dt>
      <dd>
        <DefiCopyableText
          value={value}
          display={display}
          textClassName="text-[12px] text-[#c7c7d8]"
        />
      </dd>
    </div>
  );
}

export type SandboxTab = "pools" | "swap" | "faucet" | "setup";

export function DefiTabContent({
  tabKey,
  children,
}: {
  tabKey: string;
  children: ReactNode;
}) {
  return (
    <div
      key={tabKey}
      className="animate-in fade-in slide-in-from-bottom-1 duration-200"
      style={{
        animation: "defiTabIn 0.22s ease-out",
      }}
    >
      {children}
      <style>{`
        @keyframes defiTabIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export function DefiSkeleton({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl bg-[#1a1a26] animate-pulse ${className}`}
    />
  );
}

export function DefiPoolCardSkeleton() {
  return (
    <div className="rounded-xl border border-[#2a2a3c] bg-[#0d0d14]/60 p-4 space-y-3">
      <DefiSkeleton className="h-4 w-24" />
      <DefiSkeleton className="h-3 w-full" />
      <DefiSkeleton className="h-3 w-2/3" />
    </div>
  );
}

const SANDBOX_TAB_STYLES: Record<
  SandboxTab,
  { active: string; idle: string; icon: string }
> = {
  pools: {
    active: "bg-[#4ca3ff]/14 text-[#4ca3ff] border-[#4ca3ff]/25",
    idle: "bg-transparent text-[#8888a0] hover:text-[#f0f0f5] hover:bg-white/[0.03]",
    icon: "#4ca3ff",
  },
  swap: {
    active: "bg-[#34d399]/14 text-[#34d399] border-[#34d399]/25",
    idle: "bg-transparent text-[#8888a0] hover:text-[#f0f0f5] hover:bg-white/[0.03]",
    icon: "#34d399",
  },
  faucet: {
    active: "bg-[#a78bfa]/14 text-[#a78bfa] border-[#a78bfa]/25",
    idle: "bg-transparent text-[#8888a0] hover:text-[#f0f0f5] hover:bg-white/[0.03]",
    icon: "#a78bfa",
  },
  setup: {
    active: "bg-[#8888a0]/14 text-[#c7c7d8] border-[#8888a0]/25",
    idle: "bg-transparent text-[#8888a0] hover:text-[#f0f0f5] hover:bg-white/[0.03]",
    icon: "#8888a0",
  },
};

export function DefiSandboxTabs({
  active,
  onChange,
  tabs,
}: {
  active: SandboxTab;
  onChange: (tab: SandboxTab) => void;
  tabs: Array<{ id: SandboxTab; label: string; icon: ReactNode }>;
}) {
  return (
    <nav className="min-w-0 max-w-full overflow-x-auto rounded-2xl border border-[#2a2a3c] bg-[#0d0d14] p-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      <div className="flex items-center gap-1 w-max min-w-full sm:min-w-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 h-9 px-3 sm:px-4 rounded-xl text-[12px] font-medium border border-transparent cursor-pointer transition-all duration-200 active:scale-[0.98] whitespace-nowrap flex-shrink-0 ${
              active === tab.id
                ? SANDBOX_TAB_STYLES[tab.id].active
                : SANDBOX_TAB_STYLES[tab.id].idle
            }`}
          >
            <span
              className="flex items-center justify-center flex-shrink-0"
              style={{
                color:
                  active === tab.id
                    ? SANDBOX_TAB_STYLES[tab.id].icon
                    : undefined,
              }}
            >
              {tab.icon}
            </span>
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

export function DefiHeaderButton({
  children,
  onClick,
  disabled,
  icon,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-medium whitespace-nowrap flex-shrink-0 border border-[#2a2a3c] bg-[#0d0d14] text-[#8888a0] hover:text-[#f0f0f5] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

export function DefiHeaderLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center h-8 px-1 text-[11px] font-medium whitespace-nowrap flex-shrink-0 text-[#8888a0] hover:text-[#f0f0f5] bg-transparent border-none cursor-pointer transition-colors"
    >
      {children}
    </button>
  );
}

export function DefiPanel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-[#2a2a3c] bg-[#12121a] overflow-hidden ${className}`}
    >
      <div className="px-5 py-4 border-b border-[#2a2a3c]/80">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold text-[#f0f0f5] leading-snug">
              {title}
            </h2>
            {subtitle && (
              <p className="text-[12px] text-[#8888a0] mt-1 leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
          {action ? (
            <div className="flex flex-shrink-0 sm:pt-0.5">{action}</div>
          ) : null}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function DefiPrimaryButton({
  children,
  disabled,
  onClick,
  loading,
  variant = "green",
  className = "",
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
  loading?: boolean;
  variant?: "green" | "blue" | "ghost";
  className?: string;
}) {
  const styles = {
    green:
      "border-[#34d399]/35 bg-gradient-to-b from-[#34d399]/18 to-[#34d399]/8 text-[#34d399] hover:from-[#34d399]/24",
    blue: "border-[#4ca3ff]/35 bg-gradient-to-b from-[#4ca3ff]/18 to-[#4ca3ff]/8 text-[#4ca3ff] hover:from-[#4ca3ff]/24",
    ghost:
      "border-[#2a2a3c] bg-[#0d0d14] text-[#8888a0] hover:text-[#f0f0f5]",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`h-11 px-5 rounded-xl text-[13px] font-semibold border cursor-pointer transition-all duration-200 active:scale-[0.98] disabled:opacity-45 disabled:cursor-not-allowed disabled:active:scale-100 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function DefiStatGrid({
  items,
}: {
  items: Array<{ label: string; value: string; accent?: string }>;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-[#2a2a3c] bg-[#0d0d14]/70 px-3 py-2.5"
        >
          <p className="text-[10px] text-[#55556a] uppercase tracking-wide">
            {item.label}
          </p>
          <p
            className="text-[12px] font-medium mt-1 truncate"
            style={{ color: item.accent ?? "#d8d8ea" }}
            title={item.value}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

export function DefiAlert({
  tone,
  children,
}: {
  tone: "warn" | "info";
  children: ReactNode;
}) {
  const styles =
    tone === "warn"
      ? "border-[#ffb347]/30 bg-[#ffb347]/8 text-[#c7a56a]"
      : "border-[#4ca3ff]/30 bg-[#4ca3ff]/8 text-[#9ec5ff]";
  return (
    <div className={`rounded-2xl border px-4 py-3 text-[12px] leading-relaxed ${styles}`}>
      {children}
    </div>
  );
}