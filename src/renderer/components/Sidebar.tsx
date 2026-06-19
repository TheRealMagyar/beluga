import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import WalletExtension from "./WalletExtension";
import { useWallet } from "./Walletcontext";
import { CONFIG } from "../../config";

const NAV_ITEMS = CONFIG.sidebar.NAV_ITEMS;

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [walletOpen, setWalletOpen] = useState(false);
  const [hasWallet, setHasWallet] = useState(false);
  const walletRef = useRef<HTMLDivElement>(null);
  const { walletInfo } = useWallet();

  useEffect(() => {
    window.sui
      ?.getWalletInfo?.()
      .then((res: any) => {
        if (res?.address) setHasWallet(true);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (walletRef.current && !walletRef.current.contains(e.target as Node)) {
        setWalletOpen(false);
      }
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
        onClick={() => navigate(path)}
        title={collapsed ? label : undefined}
        className={`flex items-center gap-2.5 w-full px-2 py-2 rounded-lg text-sm transition-colors duration-100 border-none cursor-pointer
          ${active ? "bg-white/[0.08] text-neutral-200" : "text-neutral-500 hover:bg-white/5 hover:text-neutral-200"}
          ${collapsed ? "justify-center" : ""}
        `}
      >
        <span className="text-base w-5 text-center flex-shrink-0">
          <img className="h-10 w-10" src={icon} />
        </span>
        {!collapsed && <span className="whitespace-nowrap">{label}</span>}
      </button>
    );
  };

  return (
    <aside
      className={`flex flex-col flex-shrink-0 h-full z-50 border-r border-white/[0.06] transition-all duration-200
    ${collapsed ? "w-14" : "w-[220px]"}
  `}
      style={{ background: CONFIG.sidebar.backgroundcolor }}
    >
      <nav className="flex-1 flex flex-col gap-0.5 p-2 overflow-y-auto overflow-x-hidden">
        {!collapsed && (
          <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest px-2 pt-1 pb-1">
            Managers
          </div>
        )}
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.path} {...item} />
        ))}

        <div className="h-px bg-white/[0.06] my-1.5" />

        {!collapsed && (
          <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest px-2 pt-1 pb-1">
            More
          </div>
        )}
        <NavItem path="/docs" icon={CONFIG.sidebar.docsIcon} label="Docs" />
      </nav>

      {/* Bottom: Wallet + Settings */}
      <div
        className={`p-2 border-t border-white/[0.06] flex gap-1.5 ${collapsed ? "flex-col" : "flex-row"}`}
      >
        {/* Wallet button + popup */}
        <div className="relative flex-1" ref={walletRef}>
          <button
            onClick={() => setWalletOpen((v) => !v)}
            title="Wallet"
            className={`flex items-center justify-center gap-1.5 w-full h-9 rounded-[9px] text-sm font-medium border cursor-pointer transition-all duration-150
        ${
          walletOpen
            ? "bg-[#4ca3ff]/20 border-[#4ca3ff]/40 text-[#4ca3ff]"
            : "bg-[#4ca3ff]/08 border-[#4ca3ff]/18 text-[#4ca3ff] hover:bg-[#4ca3ff]/16 hover:border-[#4ca3ff]/32"
        }`}
          >
            <img src={CONFIG.sidebar.walletIcon} className="h-4 w-4" />
            {!collapsed && <span>Wallet</span>}
          </button>

          {walletOpen && (
            <WalletExtension onClose={() => setWalletOpen(false)} />
          )}
        </div>

        {/* Settings */}
        <button
          onClick={() => navigate("/settings")}
          title={collapsed ? "Settings" : undefined}
          className={`flex items-center justify-center gap-1.5 h-9 rounded-[9px] text-sm border cursor-pointer transition-colors
      ${collapsed ? "w-9" : "flex-1"}
      ${
        location.pathname === "/settings"
          ? "bg-white/[0.08] border-white/[0.12] text-neutral-200"
          : "bg-white/[0.04] border-white/[0.08] text-neutral-500 hover:bg-white/[0.08] hover:text-neutral-200 hover:border-white/[0.14]"
      }`}
        >
          <img src={CONFIG.sidebar.settingsIcon} className="h-4 w-4" />
          {!collapsed && <span>Settings</span>}
        </button>
      </div>
    </aside>
  );
}
