import React from "react";
import { Copy, Check, Eye, EyeOff, Pencil, Trash2, Building2, Database, FlaskConical, Server, Box } from "lucide-react";
import type { MemoryEntry } from "./types";
import { shortHex, hueFromString } from "./utils";

interface ManagerViewProps {
  entries: MemoryEntry[];
  walletAddress: string | null;
  onOpen: (id: string) => void;
  onRename: (id: string, current: string) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
  showCreateMenu: boolean;
  onPickCreate: () => void;
  onPickImport: () => void;
  revealedKeyId: string | null;
  setRevealedKeyId: (id: string | null) => void;
  copiedField: string | null;
  copyToClipboard: (text: string, field: string) => void;
}

type AccentDef = { from: string; to: string; Icon: React.FC<{ size?: number; color?: string }>; iconColor: string; iconBg: string };

const ACCENT: Record<string, AccentDef> = {
  purple: { from: "#6c63ff", to: "#5148d4", Icon: Building2,     iconColor: "#9d97ff", iconBg: "#6c63ff22" },
  teal:   { from: "#00d4aa", to: "#00a07a", Icon: Database,       iconColor: "#00d4aa", iconBg: "#00d4aa1a" },
  amber:  { from: "#ffb347", to: "#e07b00", Icon: FlaskConical,   iconColor: "#ffb347", iconBg: "#ffb34722" },
  blue:   { from: "#4ca3ff", to: "#1a6fd4", Icon: Server,         iconColor: "#4ca3ff", iconBg: "#4ca3ff1a" },
  coral:  { from: "#ff6b6b", to: "#c0392b", Icon: Box,            iconColor: "#ff6b6b", iconBg: "#ff6b6b1a" },
};

function accentForHue(hue: number) {
  if (hue < 40)  return ACCENT.coral;
  if (hue < 80)  return ACCENT.amber;
  if (hue < 160) return ACCENT.teal;
  if (hue < 260) return ACCENT.blue;
  return ACCENT.purple;
}

export function ManagerView({
  entries,
  walletAddress,
  onOpen,
  onRename,
  onDelete,
  onCreate,
  showCreateMenu,
  onPickCreate,
  onPickImport,
  revealedKeyId,
  setRevealedKeyId,
  copiedField,
  copyToClipboard,
}: ManagerViewProps) {
  return (
    <div className="max-w-[1180px] mx-auto px-7 py-10 pb-20">
      {/* Header */}
      <div className="flex justify-between items-end mb-8 gap-4 flex-wrap">
        <div>
          <div className="text-[30px] font-semibold tracking-[-0.4px] text-[#f0f0f5] mb-1.5">
            Memory Fragments
          </div>
          <div className="text-[14px] text-[#8888a0] max-w-[520px] leading-relaxed">
            Each fragment is a standalone Walrus Memory account: its own key,
            its own namespace, its own history. Open one to start working, or
            add a new one.
          </div>
        </div>
      </div>

      {/* Empty state */}
      {entries.length === 0 ? (
        <div className="border border-dashed border-[#2a2a3c] rounded-[18px] py-16 px-6 text-center text-[#8888a0]">
          <div className="text-[40px] mb-3.5">🧩</div>
          <div className="text-[18px] font-semibold text-[#f0f0f5] mb-2">
            You don't have any memory fragments yet
          </div>
          <div className="text-[13.5px] max-w-[360px] mx-auto">
            Create one using the button above, or import an existing account
            with its delegate key.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-[22px]">
          {entries.map((entry) => {
            const hue = hueFromString(entry.id);
            const accent = accentForHue(hue);
            const keyRevealed = revealedKeyId === entry.id;
            const isMainnet = entry.network === "mainnet";

            return (
              <div
                key={entry.id}
                className="relative bg-[#1e1e1e] border border-[#2a2a3c] rounded-[18px] p-5 cursor-pointer overflow-hidden hover:border-[#444466] hover:bg-[#222234] transition-colors"
                onClick={() => onOpen(entry.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") onOpen(entry.id); }}
              >
                {/* Top accent bar */}
                <div
                  className="absolute top-0 left-0 right-0 h-[3px] rounded-t-[18px]"
                  style={{ background: `linear-gradient(90deg, ${accent.from}, ${accent.to})` }}
                />

                {/* Card header */}
                <div className="flex justify-between items-start mb-4 mt-1">
                  <div
                    className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0"
                    style={{ background: accent.iconBg }}
                  >
                    <accent.Icon size={17} color={accent.iconColor} />
                  </div>
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.8px] px-2 py-[3px] rounded-[6px]"
                    style={
                      isMainnet
                        ? { background: "#00d4aa1a", color: "#00d4aa" }
                        : { background: "#ffd66b1a", color: "#ffb347" }
                    }
                  >
                    {isMainnet ? "Mainnet" : "Testnet"}
                  </span>
                </div>

                {/* Title + namespace */}
                <div className="text-[15px] font-semibold text-[#f0f0f5] mb-[3px]">
                  {entry.label}
                </div>
                <div className="text-[11px] font-mono text-[#555570] mb-3">
                  ns: {entry.namespace || "default"}
                </div>

                {/* Account ID row */}
                <div className="border-b border-[#2a2a3c] py-[7px] flex items-center justify-between">
                  <span className="text-[11px] text-[#555570] w-20">Account ID</span>
                  <span className="flex-1 text-right text-[12px] font-mono text-[#a0a0c0] pr-1 overflow-hidden text-ellipsis whitespace-nowrap">
                    {shortHex(entry.accountId, 10, 6)}
                  </span>
                  <button
                    className="text-[#555570] hover:text-[#a0a0c0] hover:bg-[#2a2a3c] rounded-[6px] px-1 py-[3px] text-[13px] transition-colors"
                    aria-label="Copy account ID"
                    onClick={(e) => { e.stopPropagation(); copyToClipboard(entry.accountId, `${entry.id}-acc`); }}
                  >
                    {copiedField === `${entry.id}-acc` ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </div>

                {/* Delegate key row */}
                <div className="pt-[7px] flex items-center justify-between">
                  <span className="text-[11px] text-[#555570] w-20">Delegate key</span>
                  <span className="flex-1 text-right text-[12px] font-mono text-[#a0a0c0] pr-1 overflow-hidden text-ellipsis whitespace-nowrap">
                    {keyRevealed ? shortHex(entry.delegateKey, 10, 6) : "••••••••••••••"}
                  </span>
                  <button
                    className="text-[#555570] hover:text-[#a0a0c0] hover:bg-[#2a2a3c] rounded-[6px] px-1 py-[3px] text-[13px] transition-colors"
                    aria-label={keyRevealed ? "Hide key" : "Show key"}
                    onClick={(e) => { e.stopPropagation(); setRevealedKeyId(keyRevealed ? null : entry.id); }}
                  >
                    {keyRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                  <button
                    className="text-[#555570] hover:text-[#a0a0c0] hover:bg-[#2a2a3c] rounded-[6px] px-1 py-[3px] text-[13px] transition-colors"
                    aria-label="Copy delegate key"
                    onClick={(e) => { e.stopPropagation(); copyToClipboard(entry.delegateKey, `${entry.id}-key`); }}
                  >
                    {copiedField === `${entry.id}-key` ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </div>

                {/* Footer actions */}
                <div className="flex gap-2 mt-3 pt-3 border-t border-[#2a2a3c]">
                  <button
                    className="flex-1 flex items-center justify-center gap-1 text-[12px] font-medium px-3 py-[7px] rounded-[10px] border border-[#2a2a3c] bg-[#111111] text-[#8888a0] hover:border-[#444466] hover:text-[#f0f0f5] hover:bg-[#1e1e2e] transition-colors"
                    onClick={(e) => { e.stopPropagation(); onRename(entry.id, entry.label); }}
                  >
                    <Pencil size={13} aria-hidden="true" />
                    Rename
                  </button>
                  <button
                    className="flex items-center justify-center px-3 py-[7px] rounded-[10px] border border-[#2a2a3c] bg-[#111111] text-[#ff4d6d] hover:border-[#ff4d6d44] hover:bg-[#ff4d6d0a] transition-colors"
                    aria-label="Delete"
                    onClick={(e) => { e.stopPropagation(); onDelete(entry.id); }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}