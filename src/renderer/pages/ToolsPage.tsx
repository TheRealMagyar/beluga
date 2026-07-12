import { useState } from "react";
import { Coins, GitBranch, Image, ShieldAlert, Terminal, Wrench } from "lucide-react";
import { useWallet } from "../components/Walletcontext";
import { NetworkSwitcher } from "../components/NetworkSwitcher";
import { TransactionVisualizer } from "./toolsComponents/TransactionVisualizer";
import { TokenScanner } from "./toolsComponents/TokenScanner";
import { RpcQueryBuilder } from "./toolsComponents/RpcQueryBuilder";
import { TokenGenerator } from "./toolsComponents/TokenGenerator";
import { NftManager } from "./toolsComponents/NftManager";

type ToolId = "visualizer" | "scanner" | "rpc" | "token" | "nft";

const TOOLS: Array<{
  id: ToolId;
  name: string;
  description: string;
  icon: typeof GitBranch;
}> = [
  {
    id: "visualizer",
    name: "Transaction Visualizer",
    description: "Map incoming and outgoing transfers for any Sui address.",
    icon: GitBranch,
  },
  {
    id: "scanner",
    name: "Token Scanner",
    description: "Check mint authority, upgrades, and liquidity risk for any token.",
    icon: ShieldAlert,
  },
  {
    id: "rpc",
    name: "RPC Query Builder",
    description: "Build and run Sui gRPC queries with JSON request bodies.",
    icon: Terminal,
  },
  {
    id: "token",
    name: "Token Generator",
    description: "Create and deploy a custom Sui coin with metadata and supply controls.",
    icon: Coins,
  },
  {
    id: "nft",
    name: "NFT Manager",
    description: "Generative layers, rarity, Walrus storage, and collection contract deploy.",
    icon: Image,
  },
];

export function ToolsPage() {
  const { walletInfo, network } = useWallet();
  const [activeTool, setActiveTool] = useState<ToolId>("visualizer");

  return (
    <div className="flex h-full min-h-0 bg-[#0a0a0f]">
      <aside className="w-[240px] flex-shrink-0 border-r border-white/[0.06] bg-[#12121a] flex flex-col">
        <div className="px-4 py-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 mb-1">
            <Wrench size={16} className="text-[#4ca3ff]" />
            <h1 className="text-[15px] font-semibold text-[#f0f0f5]">Tools</h1>
          </div>
          <p className="text-[11px] text-[#8888a0] leading-relaxed">
            Utility tools for exploring and working with Sui on-chain data.
          </p>
          <div className="mt-3">
            <NetworkSwitcher />
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            const active = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                onClick={() => setActiveTool(tool.id)}
                className={`w-full text-left rounded-xl border px-3 py-3 cursor-pointer transition-colors ${
                  active
                    ? "border-[#4ca3ff]/35 bg-[#4ca3ff]/10"
                    : "border-[#2a2a3c] bg-[#1e1e1e] hover:border-[#444466]"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon
                    size={14}
                    className={active ? "text-[#4ca3ff]" : "text-[#8888a0]"}
                  />
                  <span
                    className={`text-[13px] font-medium ${
                      active ? "text-[#f0f0f5]" : "text-[#c7c7d8]"
                    }`}
                  >
                    {tool.name}
                  </span>
                </div>
                <p className="text-[11px] text-[#8888a0] leading-relaxed">
                  {tool.description}
                </p>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 min-w-0 min-h-0">
        {activeTool === "visualizer" && (
          <TransactionVisualizer
            network={network}
            walletAddress={walletInfo?.address ?? null}
          />
        )}
        {activeTool === "scanner" && <TokenScanner network={network} />}
        {activeTool === "rpc" && <RpcQueryBuilder network={network} />}
        {activeTool === "token" && (
          <TokenGenerator
            network={network}
            walletAddress={walletInfo?.address ?? null}
          />
        )}
        {activeTool === "nft" && (
          <NftManager
            network={network}
            walletAddress={walletInfo?.address ?? null}
          />
        )}
      </main>
    </div>
  );
}

export default ToolsPage;