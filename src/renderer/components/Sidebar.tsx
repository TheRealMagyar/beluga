import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import WalletExtension from "./WalletExtension";
import { useWallet } from "./Walletcontext";
import { CONFIG } from "../../config";

const NAV_ITEMS = CONFIG.sidebar.NAV_ITEMS;

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

function NavIcon({ src, active }: { src: string; active: boolean }) {
  return (
    <div
      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border ${
        active
          ? "border-white/[0.1] bg-white/[0.07]"
          : "border-transparent bg-white/[0.03]"
      }`}
    >
      <img
        src={src}
        alt=""
        className={`h-4 w-4 ${active ? "opacity-90" : "opacity-45"}`}
        draggable={false}
      />
    </div>
  );
}

function SectionLabel({ children, collapsed }: { children: string; collapsed: boolean }) {
  if (collapsed) {
    return <div className="h-2" />;
  }
  return (
    <div className="px-2.5 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[1.2px] text-[#55556a]">
      {children}
    </div>
  );
}

function isWalletOverlayTarget(target: Node) {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest("[data-wallet-extension]") ||
      target.closest("[data-network-switcher-menu]"),
  );
}

export function Sidebar({ collapsed }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [walletOpen, setWalletOpen] = useState(false);
  const walletAnchorRef = useRef<HTMLButtonElement>(null);
  const [walletPos, setWalletPos] = useState<{ left: number; bottom: number } | null>(
    null,
  );
  const { walletInfo } = useWallet();
  const walletConnected = Boolean(walletInfo?.address);

  const updateWalletPosition = () => {
    const anchor = walletAnchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    setWalletPos({
      left: rect.right + 8,
      bottom: window.innerHeight - rect.bottom + 48,
    });
  };

  useLayoutEffect(() => {
    if (!walletOpen) {
      setWalletPos(null);
      return;
    }
    updateWalletPosition();
    window.addEventListener("resize", updateWalletPosition);
    window.addEventListener("scroll", updateWalletPosition, true);
    return () => {
      window.removeEventListener("resize", updateWalletPosition);
      window.removeEventListener("scroll", updateWalletPosition, true);
    };
  }, [walletOpen, collapsed]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (walletAnchorRef.current?.contains(target)) return;
      if (isWalletOverlayTarget(target)) return;
      setWalletOpen(false);
    }
    if (walletOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [walletOpen]);

  const NavItem = ({
    path,
    icon,
    label,
  }: {
    path: string;
    icon: string;
    label: string;
  }) => {
    const active = location.pathname === path;

    return (
      <button
        type="button"
        onClick={() => navigate(path)}
        title={collapsed ? label : undefined}
        className={`w-full cursor-pointer border ${
          collapsed
            ? "flex justify-center rounded-xl px-2 py-2"
            : "rounded-xl px-2.5 py-2 text-left"
        } ${
          active
            ? "border-white/[0.12] bg-white/[0.06]"
            : "border-transparent bg-transparent hover:border-white/[0.06] hover:bg-white/[0.03]"
        }`}
      >
        <div
          className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`}
        >
          <NavIcon src={icon} active={active} />
          {!collapsed ? (
            <span
              className={`whitespace-nowrap text-[13px] font-medium ${
                active ? "text-[#f4f4fa]" : "text-[#8888a0]"
              }`}
            >
              {label}
            </span>
          ) : null}
        </div>
      </button>
    );
  };

  const settingsActive = location.pathname === "/settings";

  return (
    <aside
      className={`app-sidebar-glow z-50 flex h-full flex-shrink-0 flex-col border-r border-white/[0.06] ${
        collapsed ? "w-[60px]" : "w-[232px]"
      }`}
    >
      <nav className="app-sidebar-nav flex flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden p-2.5">
        <SectionLabel collapsed={collapsed}>Managers</SectionLabel>
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.path} {...item} />
        ))}

        <div className="my-2 h-px bg-white/[0.05]" />

        <SectionLabel collapsed={collapsed}>More</SectionLabel>
        <NavItem path="/docs" icon={CONFIG.sidebar.docsIcon} label="Guide" />
        <NavItem
          path="/learning"
          icon={CONFIG.sidebar.learningIcon}
          label="Learning"
        />
      </nav>

      <div
        className={`border-t border-white/[0.06] p-2.5 ${
          collapsed ? "flex flex-col gap-2" : "flex gap-2"
        }`}
      >
        <div className={collapsed ? "" : "flex-1"}>
          <button
            ref={walletAnchorRef}
            type="button"
            onClick={() => setWalletOpen((v) => !v)}
            title="Wallet"
            className={`flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border text-[12px] font-medium ${
              walletOpen
                ? "border-white/[0.14] bg-white/[0.08] text-[#e8e8f0]"
                : "border-white/[0.08] bg-white/[0.03] text-[#a8a8c0] hover:border-white/[0.14] hover:bg-white/[0.06] hover:text-[#e8e8f0]"
            } ${collapsed ? "px-0" : "px-3"}`}
          >
            <span className="relative flex-shrink-0">
              <img
                src={CONFIG.sidebar.walletIcon}
                alt=""
                className="h-4 w-4 opacity-90"
                draggable={false}
              />
              {walletConnected ? (
                <span
                  className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-[#00d4aa] ring-[1.5px] ring-[#141418]"
                  title="Wallet connected"
                />
              ) : null}
            </span>
            {!collapsed ? <span>Wallet</span> : null}
          </button>
        </div>

        <button
          type="button"
          onClick={() => navigate("/settings")}
          title={collapsed ? "Settings" : undefined}
          className={`flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border text-[12px] font-medium ${
            collapsed ? "w-full px-0" : "flex-1 px-3"
          } ${
            settingsActive
              ? "border-white/[0.14] bg-white/[0.08] text-[#e8e8f0]"
              : "border-white/[0.08] bg-white/[0.03] text-[#8888a0] hover:border-white/[0.14] hover:bg-white/[0.06] hover:text-[#e8e8f0]"
          }`}
        >
          <img
            src={CONFIG.sidebar.settingsIcon}
            alt=""
            className="h-4 w-4 flex-shrink-0 opacity-80"
            draggable={false}
          />
          {!collapsed ? <span>Settings</span> : null}
        </button>
      </div>

      {walletOpen && walletPos
        ? createPortal(
            <div
              className="fixed z-[9999]"
              style={{
                left: walletPos.left,
                bottom: walletPos.bottom,
              }}
            >
              <WalletExtension onClose={() => setWalletOpen(false)} />
            </div>,
            document.body,
          )
        : null}
    </aside>
  );
}