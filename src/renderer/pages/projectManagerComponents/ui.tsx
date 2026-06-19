import { useEffect } from "react";

// ── Badge ─────────────────────────────────────────────────────────────────────

export function Badge({
  children,
  color = "accent",
}: {
  children: React.ReactNode;
  color?: "accent" | "success" | "muted";
}) {
  const cls =
    color === "accent"
      ? "bg-[#6c63ff]/10 text-[#6c63ff] border border-[#6c63ff]/20"
      : color === "success"
      ? "bg-[#00d4aa]/10 text-[#00d4aa] border border-[#00d4aa]/20"
      : "bg-[#2a2a3c] text-[#8888a0] border border-[#2a2a3c]";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${cls}`}
    >
      {children}
    </span>
  );
}

// ── IconButton ────────────────────────────────────────────────────────────────

export function IconButton({
  onClick,
  title,
  children,
  danger = false,
}: {
  onClick: (e: React.MouseEvent) => void;
  title: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-lg border transition-all duration-150 text-sm
        ${
          danger
            ? "border-transparent text-[#8888a0] hover:border-[#ff4d6d]/40 hover:text-[#ff4d6d] hover:bg-[#ff4d6d]/08"
            : "border-transparent text-[#8888a0] hover:border-[#2a2a3c] hover:text-[#f0f0f5] hover:bg-[#1c1c2a]"
        }`}
    >
      {children}
    </button>
  );
}

// ── ModalWrapper ──────────────────────────────────────────────────────────────

export function ModalWrapper({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[#2a2a3c] bg-[#14141f] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
