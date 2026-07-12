import { useState } from "react";
import { Wrench, Boxes, Layers } from "lucide-react";
import { SdkCatalogTab } from "./packagesComponents/SdkCatalogTab";
import { CustomPackagesTab } from "./packagesComponents/CustomPackagesTab";
import { ToolchainTab } from "./packagesComponents/ToolchainTab";
import { PackagesPanel } from "./packagesComponents/packages-ui";

type PackagesTab = "catalog" | "custom" | "toolchain";

const TABS: Array<{
  id: PackagesTab;
  name: string;
  description: string;
  icon: typeof Boxes;
  accent: string;
}> = [
  {
    id: "catalog",
    name: "SDK Catalog",
    description: "Sui ecosystem npm packages for your projects.",
    icon: Boxes,
    accent: "#4ca3ff",
  },
  {
    id: "custom",
    name: "Custom Packages",
    description: "Bundle multiple npm deps into reusable project stacks.",
    icon: Layers,
    accent: "#ff9f43",
  },
  {
    id: "toolchain",
    name: "Toolchain",
    description: "Rust, suiup, and Sui CLI installers.",
    icon: Wrench,
    accent: "#00e5ff",
  },
];

export function PackagesPage() {
  const [activeTab, setActiveTab] = useState<PackagesTab>("catalog");

  return (
    <div className="flex h-full min-h-0 bg-[#0a0a0f] text-[#f0f0f5]">
      <aside className="w-[264px] flex-shrink-0 border-r border-white/[0.06] packages-sidebar-glow flex flex-col">
        <nav className="flex-1 p-3 pt-4 space-y-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left rounded-2xl border px-3.5 py-3.5 cursor-pointer transition-all duration-200 ease-out ${
                  active
                    ? "border-white/[0.12] bg-white/[0.06]"
                    : "border-transparent bg-transparent hover:bg-white/[0.03] hover:border-white/[0.06]"
                }`}
              >
                <div className="flex items-center gap-2.5 mb-1.5">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors duration-200 ${
                      active ? "bg-white/[0.08]" : "bg-white/[0.03]"
                    }`}
                  >
                    <Icon
                      size={14}
                      className="transition-colors duration-200"
                      style={{ color: active ? tab.accent : "#8888a0" }}
                    />
                  </div>
                  <span
                    className={`text-[13px] font-medium transition-colors duration-200 ${
                      active ? "text-[#f4f4fa]" : "text-[#b8b8cc]"
                    }`}
                  >
                    {tab.name}
                  </span>
                </div>
                <p
                  className={`text-[11px] leading-relaxed transition-colors duration-200 ${
                    active ? "text-[#8888a0]" : "text-[#55556a]"
                  }`}
                >
                  {tab.description}
                </p>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto packages-main-glow">
        <div className="px-8 py-8 max-w-[1280px] mx-auto min-h-full">
          {activeTab === "catalog" ? (
            <PackagesPanel key="catalog">
              <SdkCatalogTab />
            </PackagesPanel>
          ) : activeTab === "custom" ? (
            <PackagesPanel key="custom">
              <CustomPackagesTab />
            </PackagesPanel>
          ) : (
            <PackagesPanel key="toolchain">
              <ToolchainTab />
            </PackagesPanel>
          )}
        </div>
      </main>
    </div>
  );
}

export default PackagesPage;