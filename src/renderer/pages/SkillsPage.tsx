import { useState } from "react";
import { LayoutTemplate, Library } from "lucide-react";
import { LibraryTab } from "./skillsComponents/LibraryTab";
import { TemplatesTab } from "./skillsComponents/TemplatesTab";
import { SkillsPanel } from "./skillsComponents/skills-ui";

type SkillsTab = "library" | "templates";

const TABS: Array<{
  id: SkillsTab;
  name: string;
  description: string;
  icon: typeof Library;
  accent: string;
}> = [
  {
    id: "library",
    name: "My Skills",
    description: "Create and manage agent instruction sets.",
    icon: Library,
    accent: "#4ca3ff",
  },
  {
    id: "templates",
    name: "Templates",
    description: "Beluga templates and official Mysten Walrus skills.",
    icon: LayoutTemplate,
    accent: "#c4c0ff",
  },
];

export function SkillsPage() {
  const [activeTab, setActiveTab] = useState<SkillsTab>("library");
  const [pendingSkillId, setPendingSkillId] = useState<string | null>(null);

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-[#0a0a0f] text-[#f0f0f5]">
      <aside className="w-[264px] flex-shrink-0 border-r border-white/[0.06] skills-sidebar-glow flex flex-col">
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

      <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden skills-main-glow">
        {activeTab === "library" ? (
          <LibraryTab
            pendingSkillId={pendingSkillId}
            onPendingHandled={() => setPendingSkillId(null)}
          />
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="px-8 py-8 max-w-[1280px] mx-auto min-h-full">
              <SkillsPanel key="templates">
                <TemplatesTab
                  onImported={(skillId) => {
                    setPendingSkillId(skillId);
                    setActiveTab("library");
                  }}
                />
              </SkillsPanel>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default SkillsPage;