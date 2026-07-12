import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { useWallet, SUI_NETWORKS } from "./Walletcontext";
import type { SuiNetwork } from "../types/network";

interface NetworkSwitcherProps {
  compact?: boolean;
  placement?: "top" | "bottom" | "auto";
}

type MenuPlacement = "top" | "bottom";

interface MenuPosition {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  placement: MenuPlacement;
}

const MENU_ITEM_HEIGHT = 40;
const MENU_PADDING = 4;

export function NetworkSwitcher({
  compact = false,
  placement = "auto",
}: NetworkSwitcherProps) {
  const { network, setNetwork, localNetRunning } = useWallet();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const config = SUI_NETWORKS[network];

  const availableNetworks = (Object.keys(SUI_NETWORKS) as SuiNetwork[]).filter(
    (id) => id !== "localnet" || localNetRunning,
  );

  const menuHeight =
    availableNetworks.length * MENU_ITEM_HEIGHT + MENU_PADDING * 2;

  const resolvePlacement = useCallback(
    (rect: DOMRect): MenuPlacement => {
      if (placement === "top") return "top";
      if (placement === "bottom") return "bottom";

      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      if (spaceBelow < menuHeight + 12 && spaceAbove > spaceBelow) {
        return "top";
      }
      return "bottom";
    },
    [placement, menuHeight],
  );

  const updateMenuPosition = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const width = compact ? 168 : Math.max(rect.width, 168);
    const left = compact
      ? Math.min(rect.right - width, window.innerWidth - width - 8)
      : rect.left;
    const resolved = resolvePlacement(rect);

    if (resolved === "top") {
      setMenuPos({
        bottom: window.innerHeight - rect.top + 8,
        left: Math.max(8, left),
        width,
        placement: "top",
      });
    } else {
      setMenuPos({
        top: rect.bottom + 8,
        left: Math.max(8, left),
        width,
        placement: "bottom",
      });
    }
  }, [compact, resolvePlacement]);

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();
  }, [open, updateMenuPosition, availableNetworks.length]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        ref.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onReposition = () => updateMenuPosition();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, updateMenuPosition]);

  const menu =
    open && menuPos
      ? createPortal(
          <div
            ref={menuRef}
            data-network-switcher-menu
            className="playground-fade-in fixed z-[10050] rounded-xl border border-white/10 bg-[#14141f]/98 backdrop-blur-md shadow-[0_12px_40px_rgba(0,0,0,0.45)] overflow-hidden"
            style={{
              top: menuPos.top,
              bottom: menuPos.bottom,
              left: menuPos.left,
              width: menuPos.width,
              transformOrigin:
                menuPos.placement === "top" ? "bottom right" : "top right",
            }}
          >
            {availableNetworks.map((id) => {
              const item = SUI_NETWORKS[id];
              const active = id === network;
              return (
                <button
                  key={id}
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => {
                    setNetwork(id);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-[11px] border-none cursor-pointer transition-colors ${
                    active
                      ? "bg-white/[0.07] text-neutral-100"
                      : "bg-transparent text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-200"
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: item.accent }}
                  />
                  <span className="font-medium">{item.label}</span>
                  {item.faucet && (
                    <span className="ml-auto text-[9px] text-neutral-600">
                      Faucet
                    </span>
                  )}
                </button>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-full border font-semibold cursor-pointer transition-all duration-200 ${
          compact
            ? "text-[10px] px-2.5 py-1"
            : "text-[11px] px-3 py-1.5 w-full"
        } ${open ? "ring-2 ring-white/10" : ""}`}
        style={{
          color: config.accent,
          borderColor: `${config.accent}40`,
          background: `${config.accent}14`,
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: config.accent }}
        />
        {config.label}
        <ChevronDown
          size={compact ? 10 : 12}
          className={`opacity-70 transition-transform duration-200 ${
            open && menuPos?.placement === "bottom" ? "rotate-180" : ""
          }`}
        />
      </button>
      {menu}
    </div>
  );
}