export type PlaygroundTab = "move" | "ika" | "defi" | "ptb";

const TAB_STYLES: Record<PlaygroundTab, { active: string; idle: string }> = {
  move: {
    active: "bg-[#4ca3ff]/14 text-[#4ca3ff] font-medium",
    idle: "bg-transparent text-[#8888a0] hover:text-[#f0f0f5]",
  },
  ika: {
    active: "bg-[#00e5ff]/14 text-[#00e5ff] font-medium",
    idle: "bg-transparent text-[#8888a0] hover:text-[#f0f0f5]",
  },
  defi: {
    active: "bg-[#34d399]/14 text-[#34d399] font-medium",
    idle: "bg-transparent text-[#8888a0] hover:text-[#f0f0f5]",
  },
  ptb: {
    active: "bg-[#c084fc]/14 text-[#c084fc] font-medium",
    idle: "bg-transparent text-[#8888a0] hover:text-[#f0f0f5]",
  },
};

export function PlaygroundTabs({
  active,
  onChange,
  ikaReady,
}: {
  active: PlaygroundTab;
  onChange: (tab: PlaygroundTab) => void;
  ikaReady: boolean;
}) {
  const tabs: Array<{ id: PlaygroundTab; label: string; visible: boolean }> = [
    { id: "move", label: "Move", visible: true },
    { id: "ptb", label: "PTB", visible: true },
    { id: "defi", label: "DeFi", visible: true },
    { id: "ika", label: "Ika", visible: ikaReady },
  ];

  return (
    <div className="flex items-center rounded-xl border border-[#2a2a3c] bg-[#0d0d14] p-0.5">
      {tabs
        .filter((tab) => tab.visible)
        .map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`h-7 px-3 rounded-lg text-[11px] border-none cursor-pointer transition-colors ${
              active === tab.id ? TAB_STYLES[tab.id].active : TAB_STYLES[tab.id].idle
            }`}
          >
            {tab.label}
          </button>
        ))}
    </div>
  );
}