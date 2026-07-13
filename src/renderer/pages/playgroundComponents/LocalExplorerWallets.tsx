import { useCallback, useEffect, useState } from "react";
import {
  Coins,
  ImageIcon,
  Loader2,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { CopyBtn, short } from "./LocalExplorer";

type WalletAssets = Awaited<
  ReturnType<typeof window.playground.getLocalWalletAssets>
>;
type PlaygroundSigner = Awaited<
  ReturnType<typeof window.playground.getTestWallets>
>["signers"][number];

function shortCoinType(coinType: string): string {
  const parts = coinType.split("::");
  if (parts.length >= 2) {
    return `${parts[parts.length - 2]}::${parts[parts.length - 1]}`;
  }
  return short(coinType, 12, 8);
}

function AssetSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="p-5 border-b border-white/[0.06]">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#8888a0] mb-3">
        {title}
        <span className="ml-2 text-[#55556a] font-mono normal-case">({count})</span>
      </h3>
      {children}
    </section>
  );
}

function WalletAssetsView({
  assets,
  loading,
}: {
  assets: WalletAssets | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#8888a0] gap-2">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-[13px]">Loading wallet assets…</span>
      </div>
    );
  }

  if (!assets) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#55556a] text-[13px] px-8 text-center leading-relaxed">
        Select a playground wallet or enter an address to inspect coins, token
        balances, and owned objects.
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="p-5 border-b border-white/[0.06]">
        <div className="flex items-start gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-[#7dd3fc]/12 flex items-center justify-center text-[#7dd3fc] flex-shrink-0">
            <Wallet size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-[#f0f0f5]">Wallet</p>
            <div className="flex items-start gap-2 mt-1">
              <p className="flex-1 text-[12px] font-mono text-[#c7c7d8] break-all leading-relaxed">
                {assets.address}
              </p>
              <CopyBtn value={assets.address} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "SUI", value: `${assets.suiBalance.toFixed(4)}` },
            { label: "Coin types", value: String(assets.balances.length) },
            { label: "Objects", value: String(assets.objects.length) },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-white/[0.06] bg-[#12121a] px-3 py-2.5"
            >
              <p className="text-[10px] uppercase tracking-wide text-[#55556a]">
                {stat.label}
              </p>
              <p className="text-[14px] font-semibold text-[#f0f0f5] mt-0.5 font-mono">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      <AssetSection title="Balances by coin type" count={assets.balances.length}>
        {assets.balances.length === 0 ? (
          <p className="text-[12px] text-[#55556a]">No coin balances found.</p>
        ) : (
          <div className="space-y-2">
            {assets.balances.map((balance) => (
              <div
                key={balance.coinType}
                className="rounded-xl border border-white/[0.06] bg-[#12121a] p-3"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#f0f0f5]">
                      {balance.symbol}
                      {balance.name ? (
                        <span className="text-[#8888a0] font-normal ml-2">
                          {balance.name}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-[15px] font-mono text-[#7dd3fc] mt-1">
                      {balance.formattedBalance}
                    </p>
                  </div>
                  <CopyBtn value={balance.coinType} />
                </div>
                <div className="flex items-start gap-2 rounded-lg bg-[#0d0d14] px-2.5 py-2">
                  <p className="flex-1 text-[11px] font-mono text-[#8888a0] break-all">
                    {balance.coinType}
                  </p>
                  <CopyBtn value={balance.coinType} />
                </div>
              </div>
            ))}
          </div>
        )}
      </AssetSection>

      <AssetSection title="Coin objects" count={assets.coins.length}>
        {assets.coins.length === 0 ? (
          <p className="text-[12px] text-[#55556a]">No coin objects in wallet.</p>
        ) : (
          <div className="space-y-2">
            {assets.coins.map((coin) => (
              <div
                key={coin.coinObjectId}
                className="rounded-xl border border-white/[0.06] bg-[#12121a] p-3"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[12px] font-medium text-[#f0f0f5]">
                    {coin.symbol}
                    <span className="text-[#7dd3fc] font-mono ml-2">
                      {coin.formattedBalance}
                    </span>
                  </span>
                  <span className="text-[10px] font-mono text-[#55556a]">
                    {shortCoinType(coin.coinType)}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <p className="flex-1 text-[11px] font-mono text-[#a8b0c8] break-all">
                    {coin.coinObjectId}
                  </p>
                  <CopyBtn value={coin.coinObjectId} />
                </div>
                <div className="flex items-start gap-2 mt-2">
                  <p
                    className="flex-1 text-[10px] font-mono text-[#55556a] break-all"
                    title={coin.coinType}
                  >
                    {coin.coinType}
                  </p>
                  <CopyBtn value={coin.coinType} />
                </div>
              </div>
            ))}
          </div>
        )}
      </AssetSection>

      <AssetSection title="NFTs & objects" count={assets.objects.length}>
        {assets.objects.length === 0 ? (
          <p className="text-[12px] text-[#55556a]">
            No owned objects besides coins.
          </p>
        ) : (
          <div className="space-y-2">
            {assets.objects.map((object) => (
              <div
                key={object.objectId}
                className="rounded-xl border border-white/[0.06] bg-[#12121a] p-3"
              >
                <div className="flex items-start gap-3">
                  {object.displayImageUrl ? (
                    <img
                      src={object.displayImageUrl}
                      alt=""
                      className="h-12 w-12 rounded-lg object-cover border border-white/[0.08] flex-shrink-0"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-[#c084fc]/10 border border-[#c084fc]/20 flex items-center justify-center text-[#c084fc] flex-shrink-0">
                      <ImageIcon size={18} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-[#f0f0f5] truncate">
                      {object.displayName ?? shortCoinType(object.objectType ?? "Object")}
                    </p>
                    {object.displayDescription && (
                      <p className="text-[11px] text-[#8888a0] mt-0.5 line-clamp-2">
                        {object.displayDescription}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  <div className="flex items-start gap-2 rounded-lg bg-[#0d0d14] px-2.5 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-[#666680] mb-0.5">Object ID</p>
                      <p className="text-[11px] font-mono text-[#a8b0c8] break-all">
                        {object.objectId}
                      </p>
                    </div>
                    <CopyBtn value={object.objectId} />
                  </div>

                  {object.objectType && (
                    <div className="flex items-start gap-2 rounded-lg bg-[#0d0d14] px-2.5 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-[#666680] mb-0.5">Type</p>
                        <p className="text-[11px] font-mono text-[#8888a0] break-all">
                          {object.objectType}
                        </p>
                      </div>
                      <CopyBtn value={object.objectType} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </AssetSection>
    </div>
  );
}

export function LocalExplorerWallets({
  walletAddress,
  onLog,
}: {
  walletAddress: string | null;
  onLog: (level: "info" | "success" | "warn" | "error", message: string) => void;
}) {
  const [signers, setSigners] = useState<PlaygroundSigner[]>([]);
  const [activeSignerId, setActiveSignerId] = useState<string | null>(null);
  const [selectedAddress, setSelectedAddress] = useState("");
  const [customAddress, setCustomAddress] = useState("");
  const [assets, setAssets] = useState<WalletAssets | null>(null);
  const [walletsLoading, setWalletsLoading] = useState(false);
  const [assetsLoading, setAssetsLoading] = useState(false);

  const loadSigners = useCallback(async () => {
    setWalletsLoading(true);
    try {
      const result = await window.playground.getTestWallets();
      setSigners(result.signers);
      setActiveSignerId(result.activeSignerId);
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Failed to load playground wallets.";
      onLog("error", message);
    }
    setWalletsLoading(false);
  }, [onLog]);

  const loadAssets = useCallback(
    async (address: string) => {
      const target = address.trim();
      if (!target) {
        setAssets(null);
        return;
      }

      setAssetsLoading(true);
      setSelectedAddress(target);
      try {
        setAssets(await window.playground.getLocalWalletAssets({ address: target }));
      } catch (e: unknown) {
        setAssets(null);
        const message =
          e instanceof Error ? e.message : "Failed to load wallet assets.";
        if (!/localnet rpc unreachable|local network is not running/i.test(message)) {
          onLog("error", message);
        }
      }
      setAssetsLoading(false);
    },
    [onLog],
  );

  useEffect(() => {
    void loadSigners();
  }, [loadSigners]);

  useEffect(() => {
    if (walletAddress) {
      void loadAssets(walletAddress);
    }
  }, [walletAddress, loadAssets]);

  return (
    <div className="flex-1 min-h-0 flex">
      <aside className="w-[min(340px,38%)] flex-shrink-0 border-r border-white/[0.08] flex flex-col bg-[#0d0d14]">
        <div className="flex-shrink-0 p-3 border-b border-white/[0.06] flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8888a0]">
            Playground wallets
          </span>
          <button
            type="button"
            onClick={() => void loadSigners()}
            disabled={walletsLoading}
            className="h-7 w-7 flex items-center justify-center rounded-lg border border-[#2a2a3c] text-[#8888a0] hover:text-[#f0f0f5] cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={12} className={walletsLoading ? "animate-spin" : ""} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {walletsLoading && signers.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-16 text-[#8888a0] text-[13px]">
              <Loader2 size={16} className="animate-spin" />
              Loading wallets…
            </div>
          ) : signers.length === 0 ? (
            <p className="px-4 py-16 text-[13px] text-[#55556a] text-center leading-relaxed">
              No wallets found. Start localnet to provision test wallets.
            </p>
          ) : (
            signers.map((signer) => {
              const selected = selectedAddress === signer.address;
              const isActive = activeSignerId === signer.id;
              return (
                <button
                  key={signer.id}
                  type="button"
                  onClick={() => void loadAssets(signer.address)}
                  className={`w-full text-left px-4 py-3 border-b border-white/[0.04] cursor-pointer transition-colors ${
                    selected
                      ? "bg-[#7dd3fc]/[0.08] border-l-2 border-l-[#7dd3fc]"
                      : "hover:bg-white/[0.03] border-l-2 border-l-transparent"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[12px] font-medium text-[#f0f0f5] truncate">
                      {signer.label}
                    </span>
                    {isActive && (
                      <span className="text-[9px] uppercase tracking-wide text-[#7dd3fc] flex-shrink-0">
                        active
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-mono text-[#8888a0] break-all">
                    {signer.address}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-[#7dd3fc]">
                    <Coins size={11} />
                    <span className="font-mono">
                      {signer.balanceSui != null
                        ? `${signer.balanceSui.toFixed(4)} SUI`
                        : "—"}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="flex-shrink-0 p-3 border-t border-white/[0.06] space-y-2">
          <input
            value={customAddress}
            onChange={(e) => setCustomAddress(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void loadAssets(customAddress);
            }}
            placeholder="Custom 0x address…"
            className="w-full h-9 px-3 rounded-lg text-[12px] font-mono bg-[#1e1e1e] border border-[#2a2a3c] text-[#f0f0f5] outline-none placeholder:text-[#55556a]"
          />
          <button
            type="button"
            onClick={() => void loadAssets(customAddress)}
            disabled={!customAddress.trim()}
            className="w-full h-8 rounded-lg text-[11px] font-medium border border-[#2a2a3c] bg-[#12121a] text-[#7dd3fc] hover:bg-[#7dd3fc]/10 cursor-pointer disabled:opacity-40"
          >
            Inspect address
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col bg-[#0a0a0f]">
        <WalletAssetsView assets={assets} loading={assetsLoading} />
      </main>
    </div>
  );
}