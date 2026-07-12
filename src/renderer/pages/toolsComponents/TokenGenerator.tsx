import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  Coins,
  Loader2,
  Rocket,
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react";
import { Transaction } from "@mysten/sui/transactions";
import type { SuiNetwork } from "../../types/network";
import { SUI_NETWORKS } from "../../types/network";
import { CopyButton } from "../../components/CopyButton";
import {
  createSuiClient,
  publishPackage,
  resolvePackageIdFromPublish,
  signAndExecuteTransaction,
} from "../playgroundComponents/utils";
import {
  generateTokenPackageFiles,
  validateTokenConfig,
  type TokenGeneratorConfig,
  type TokenMintRecipientMode,
  type TokenSupplyMode,
} from "../../../helper/token-generator-core";

type BuildResult = Awaited<ReturnType<typeof window.tools.buildTokenPackage>>;

type DeployResult = {
  packageId: string;
  coinType: string;
  digest: string;
  treasuryCapId: string | null;
  mintDigest: string | null;
  network: SuiNetwork;
};

const DEFAULT_CONFIG: TokenGeneratorConfig = {
  name: "Beluga Token",
  symbol: "BLG",
  description: "A custom fungible token created with Beluga.",
  iconUrl: "",
  decimals: 9,
  moduleName: "beluga_token",
  coinTypeName: "BELUGA_TOKEN",
  supplyMode: "unlimited",
  freezeMetadata: true,
  initialMint: {
    enabled: true,
    amount: "1000000",
    recipientMode: "publisher",
    recipient: "",
  },
};

function slugifyModuleName(value: string) {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned.match(/^[a-z]/) ? cleaned : `token_${cleaned || "coin"}`;
}

function symbolToCoinType(symbol: string) {
  const cleaned = symbol.replace(/[^A-Za-z0-9_]/g, "_").toUpperCase();
  return cleaned.match(/^[A-Z]/) ? cleaned : `COIN_${cleaned || "TOKEN"}`;
}

function extractTreasuryCapId(
  objectChanges: Array<{
    type?: string;
    objectType?: string;
    objectId?: string;
  }> | undefined,
  coinType: string,
): string | null {
  if (!objectChanges?.length) return null;

  const exact = objectChanges.find(
    (change) =>
      change.type === "created" &&
      typeof change.objectType === "string" &&
      change.objectType.includes("TreasuryCap") &&
      change.objectType.includes(coinType),
  );
  if (exact?.objectId) return exact.objectId;

  const fallback = objectChanges.find(
    (change) =>
      change.type === "created" &&
      typeof change.objectType === "string" &&
      change.objectType.includes("TreasuryCap"),
  );
  return fallback?.objectId ?? null;
}

function FieldLabel({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <div>
        <span className="text-[12px] font-medium text-[#c7c7d8]">{label}</span>
        {hint ? (
          <p className="text-[11px] text-[#666680] leading-relaxed mt-0.5">{hint}</p>
        ) : null}
      </div>
      {children}
    </label>
  );
}

const inputClass =
  "w-full h-10 px-3 rounded-xl bg-[#1e1e1e] border border-[#2a2a3c] text-sm outline-none focus:border-[#4ca3ff]/40";

export function TokenGenerator({
  network,
  walletAddress,
}: {
  network: SuiNetwork;
  walletAddress: string | null;
}) {
  const [config, setConfig] = useState<TokenGeneratorConfig>(DEFAULT_CONFIG);
  const [showPreview, setShowPreview] = useState(false);
  const [previewSource, setPreviewSource] = useState<string | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DeployResult | null>(null);

  const update = useCallback(
    <K extends keyof TokenGeneratorConfig>(key: K, value: TokenGeneratorConfig[K]) => {
      setConfig((prev) => ({ ...prev, [key]: value }));
      setResult(null);
      setError(null);
    },
    [],
  );

  const updateInitialMint = useCallback(
    <K extends keyof TokenGeneratorConfig["initialMint"]>(
      key: K,
      value: TokenGeneratorConfig["initialMint"][K],
    ) => {
      setConfig((prev) => ({
        ...prev,
        initialMint: { ...prev.initialMint, [key]: value },
      }));
      setResult(null);
      setError(null);
    },
    [],
  );

  const coinTypePreview = useMemo(
    () => `0x…::${config.moduleName}::${config.coinTypeName}`,
    [config.moduleName, config.coinTypeName],
  );

  const validation = useMemo(() => validateTokenConfig(config), [config]);

  const handlePreview = () => {
    setError(null);
    try {
      const preview = generateTokenPackageFiles(config);
      const moveFile = preview.files.find((f) => f.path.endsWith(".move"));
      setPreviewSource(moveFile?.content ?? null);
      setShowPreview(true);
    } catch (e: any) {
      setError(e.message || "Failed to generate preview.");
      setPreviewSource(null);
    }
  };

  const handleDeploy = async () => {
    if (!walletAddress) {
      setError("Connect a wallet before deploying.");
      return;
    }

    setDeploying(true);
    setError(null);
    setResult(null);

    try {
      setStep("Building Move package…");
      const build: BuildResult = await window.tools.buildTokenPackage(config);

      setStep(`Publishing to ${SUI_NETWORKS[network].label}…`);
      const suiClient = createSuiClient(network);
      const publishResult = await publishPackage(
        suiClient,
        walletAddress,
        build.modules,
        build.dependencies,
        network,
      );

      setStep("Waiting for package to index…");
      const packageId = await resolvePackageIdFromPublish(
        suiClient,
        publishResult,
      );

      const coinType = `${packageId}::${config.moduleName}::${config.coinTypeName}`;
      const treasuryCapId = extractTreasuryCapId(
        publishResult.objectChanges,
        coinType,
      );

      let mintDigest: string | null = null;

      const needsPostMint =
        config.supplyMode === "unlimited" &&
        config.initialMint.enabled &&
        build.preview.initialMintBaseUnits;

      if (needsPostMint) {
        if (!treasuryCapId) {
          throw new Error(
            "Publish succeeded but TreasuryCap was not found for the initial mint.",
          );
        }

        const recipient =
          config.initialMint.recipientMode === "custom" &&
          config.initialMint.recipient?.trim()
            ? config.initialMint.recipient.trim()
            : walletAddress;

        setStep("Minting initial supply…");
        const mintTx = new Transaction();
        mintTx.moveCall({
          package: packageId,
          module: config.moduleName,
          function: "mint",
          arguments: [
            mintTx.object(treasuryCapId),
            mintTx.pure.u64(BigInt(build.preview.initialMintBaseUnits!)),
            mintTx.pure.address(recipient),
          ],
        });

        const mintResult = await signAndExecuteTransaction(
          suiClient,
          walletAddress,
          mintTx,
          network,
        );
        mintDigest = mintResult.digest;
      }

      setResult({
        packageId,
        coinType,
        digest: publishResult.digest,
        treasuryCapId,
        mintDigest,
        network,
      });
      setStep(null);
    } catch (e: any) {
      setError(e.message || "Token deployment failed.");
      setStep(null);
    }

    setDeploying(false);
  };

  const supplyHint =
    config.supplyMode === "fixed"
      ? "TreasuryCap is destroyed after publish — no further minting is possible."
      : "TreasuryCap stays with your wallet — you can mint more later via the on-chain mint entry.";

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-shrink-0 px-6 py-5 border-b border-white/[0.06]">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[280px]">
            <h2 className="text-xl font-bold text-[#f0f0f5] mb-1">Token Generator</h2>
            <p className="text-sm text-[#8888a0] max-w-2xl">
              Configure token metadata and supply, build a Move package, and deploy it
              to the active network in one flow.
            </p>
          </div>
          <div className="text-[12px] px-3 py-1.5 rounded-full border border-[#4ca3ff]/25 text-[#4ca3ff] bg-[#4ca3ff]/10">
            {SUI_NETWORKS[network].label}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-6 py-5 grid grid-cols-1 xl:grid-cols-2 gap-6">
          <section className="space-y-4 rounded-2xl border border-[#2a2a3c] bg-[#12121a] p-4">
            <div className="flex items-center gap-2 text-[#f0f0f5]">
              <Coins size={16} className="text-[#4ca3ff]" />
              <h3 className="text-[14px] font-semibold">Token identity</h3>
            </div>

            <FieldLabel label="Name" hint="Displayed in wallets and explorers.">
              <input
                className={inputClass}
                value={config.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="My Token"
              />
            </FieldLabel>

            <div className="grid grid-cols-2 gap-3">
              <FieldLabel label="Symbol" hint="Short ticker, max 10 chars.">
                <input
                  className={inputClass}
                  value={config.symbol}
                  onChange={(e) => update("symbol", e.target.value.toUpperCase())}
                  placeholder="MTK"
                />
              </FieldLabel>
              <FieldLabel label="Decimals" hint="Usually 6 or 9 on Sui.">
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  max={18}
                  value={config.decimals}
                  onChange={(e) => update("decimals", Number(e.target.value))}
                />
              </FieldLabel>
            </div>

            <FieldLabel label="Description">
              <textarea
                className={`${inputClass} min-h-[88px] py-2 resize-y`}
                value={config.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="What is this token for?"
              />
            </FieldLabel>

            <FieldLabel
              label="Icon URL"
              hint="HTTPS image URL stored in on-chain CoinMetadata."
            >
              <input
                className={inputClass}
                value={config.iconUrl ?? ""}
                onChange={(e) => update("iconUrl", e.target.value)}
                placeholder="https://example.com/icon.png"
              />
            </FieldLabel>

            <label className="flex items-center gap-2 text-[12px] text-[#c7c7d8] cursor-pointer">
              <input
                type="checkbox"
                checked={config.freezeMetadata}
                onChange={(e) => update("freezeMetadata", e.target.checked)}
                className="accent-[#4ca3ff]"
              />
              Freeze metadata after publish (recommended)
            </label>
          </section>

          <section className="space-y-4 rounded-2xl border border-[#2a2a3c] bg-[#12121a] p-4">
            <h3 className="text-[14px] font-semibold text-[#f0f0f5]">On-chain structure</h3>

            <FieldLabel
              label="Module name"
              hint="Move package/module identifier (lowercase)."
            >
              <input
                className={`${inputClass} font-mono`}
                value={config.moduleName}
                onChange={(e) => update("moduleName", slugifyModuleName(e.target.value))}
              />
            </FieldLabel>

            <FieldLabel
              label="Coin type name"
              hint="One-time witness struct name — becomes the coin type suffix."
            >
              <input
                className={`${inputClass} font-mono`}
                value={config.coinTypeName}
                onChange={(e) =>
                  update("coinTypeName", symbolToCoinType(e.target.value))
                }
              />
            </FieldLabel>

            <div className="rounded-xl border border-[#2a2a3c] bg-[#1a1a24] px-3 py-2.5">
              <p className="text-[11px] text-[#666680] mb-1">Coin type after deploy</p>
              <p className="text-[12px] font-mono text-[#4ca3ff] break-all">{coinTypePreview}</p>
            </div>

            <FieldLabel label="Supply mode" hint={supplyHint}>
              <select
                className={inputClass}
                value={config.supplyMode}
                onChange={(e) =>
                  update("supplyMode", e.target.value as TokenSupplyMode)
                }
              >
                <option value="unlimited">Unlimited — keep TreasuryCap</option>
                <option value="fixed">Fixed — destroy TreasuryCap after publish</option>
              </select>
            </FieldLabel>

            <label className="flex items-center gap-2 text-[12px] text-[#c7c7d8] cursor-pointer">
              <input
                type="checkbox"
                checked={config.initialMint.enabled}
                onChange={(e) => updateInitialMint("enabled", e.target.checked)}
                className="accent-[#4ca3ff]"
              />
              Mint an initial supply
            </label>

            {config.initialMint.enabled ? (
              <div className="space-y-3 pl-1 border-l border-[#2a2a3c] ml-1 pl-4">
                <FieldLabel
                  label="Initial amount"
                  hint={`Human-readable amount (${config.decimals} decimals).`}
                >
                  <input
                    className={inputClass}
                    value={config.initialMint.amount}
                    onChange={(e) => updateInitialMint("amount", e.target.value)}
                    placeholder="1000000"
                  />
                </FieldLabel>

                <FieldLabel label="Mint recipient">
                  <select
                    className={inputClass}
                    value={config.initialMint.recipientMode}
                    onChange={(e) =>
                      updateInitialMint(
                        "recipientMode",
                        e.target.value as TokenMintRecipientMode,
                      )
                    }
                  >
                    <option value="publisher">Publisher wallet</option>
                    <option value="custom">Custom address</option>
                  </select>
                </FieldLabel>

                {config.initialMint.recipientMode === "custom" ? (
                  <FieldLabel label="Recipient address">
                    <input
                      className={`${inputClass} font-mono`}
                      value={config.initialMint.recipient ?? ""}
                      onChange={(e) => updateInitialMint("recipient", e.target.value)}
                      placeholder="0x…"
                    />
                  </FieldLabel>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>

        {showPreview && previewSource ? (
          <div className="px-6 pb-4">
            <div className="rounded-2xl border border-[#2a2a3c] bg-[#0d0d14] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-[#2a2a3c]">
                <span className="text-[12px] text-[#8888a0]">Generated Move source</span>
                <button
                  type="button"
                  onClick={() => setShowPreview(false)}
                  className="text-[11px] text-[#8888a0] hover:text-[#f0f0f5] flex items-center gap-1 cursor-pointer bg-transparent border-none"
                >
                  <EyeOff size={12} /> Hide
                </button>
              </div>
              <pre className="p-4 text-[11px] leading-relaxed font-mono text-[#c7c7d8] overflow-x-auto max-h-[280px]">
                {previewSource}
              </pre>
            </div>
          </div>
        ) : null}

        {validation.errors.length ? (
          <div className="px-6 pb-4 space-y-2">
            {validation.errors.map((item) => (
              <div
                key={item}
                className="rounded-xl border border-[#ff4d6d]/25 bg-[#ff4d6d]/8 px-4 py-2.5 text-[12px] text-[#ffb4c0]"
              >
                {item}
              </div>
            ))}
          </div>
        ) : null}

        {validation.warnings.length ? (
          <div className="px-6 pb-4 space-y-2">
            {validation.warnings.map((warning) => (
              <div
                key={warning}
                className="rounded-xl border border-[#ffb347]/25 bg-[#ffb347]/8 px-4 py-2.5 text-[12px] text-[#ffd9a0]"
              >
                {warning}
              </div>
            ))}
          </div>
        ) : null}

        {error ? (
          <div className="px-6 pb-4">
            <div className="rounded-xl border border-[#ff4d6d]/30 bg-[#ff4d6d]/10 px-4 py-3 text-[13px] text-[#ffb4c0] flex items-start gap-2">
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
              <span className="whitespace-pre-wrap">{error}</span>
            </div>
          </div>
        ) : null}

        {result ? (
          <div className="px-6 pb-6">
            <div className="rounded-2xl border border-[#00d4aa]/30 bg-[#00d4aa]/8 p-4 space-y-3">
              <div className="flex items-center gap-2 text-[#00d4aa]">
                <CheckCircle2 size={18} />
                <h3 className="text-[14px] font-semibold">Token deployed</h3>
              </div>

              <div className="grid gap-2 text-[12px]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[#8888a0] w-28">Coin type</span>
                  <code className="font-mono text-[#f0f0f5] break-all flex-1">
                    {result.coinType}
                  </code>
                  <CopyButton text={result.coinType} label="Copy" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[#8888a0] w-28">Package</span>
                  <code className="font-mono text-[#f0f0f5] break-all flex-1">
                    {result.packageId}
                  </code>
                  <CopyButton text={result.packageId} label="Copy" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[#8888a0] w-28">Publish tx</span>
                  <code className="font-mono text-[#f0f0f5] break-all flex-1">
                    {result.digest}
                  </code>
                  <CopyButton text={result.digest} label="Copy" />
                </div>
                {result.treasuryCapId ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[#8888a0] w-28">TreasuryCap</span>
                    <code className="font-mono text-[#f0f0f5] break-all flex-1">
                      {result.treasuryCapId}
                    </code>
                    <CopyButton text={result.treasuryCapId} label="Copy" />
                  </div>
                ) : null}
                {result.mintDigest ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[#8888a0] w-28">Mint tx</span>
                    <code className="font-mono text-[#f0f0f5] break-all flex-1">
                      {result.mintDigest}
                    </code>
                    <CopyButton text={result.mintDigest} label="Copy" />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex-shrink-0 px-6 py-4 border-t border-white/[0.06] bg-[#0a0a0f] flex flex-wrap items-center gap-3">
        {!walletAddress ? (
          <p className="text-[12px] text-[#ffb347] mr-auto">
            Connect your wallet to deploy on {SUI_NETWORKS[network].label}.
          </p>
        ) : (
          <p className="text-[12px] text-[#666680] mr-auto font-mono truncate max-w-md">
            Publisher: {walletAddress}
          </p>
        )}

        <button
          type="button"
          onClick={handlePreview}
          disabled={deploying}
          className="h-10 px-4 rounded-xl border border-[#2a2a3c] text-[#c7c7d8] text-sm hover:border-[#444466] cursor-pointer disabled:opacity-50 flex items-center gap-2"
        >
          <Eye size={14} />
          Preview Move
        </button>

        <button
          type="button"
          onClick={handleDeploy}
          disabled={deploying || !walletAddress || !validation.valid}
          className="h-10 px-5 rounded-xl bg-[#4ca3ff] text-white text-sm font-medium cursor-pointer disabled:opacity-50 flex items-center gap-2"
        >
          {deploying ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              {step ?? "Deploying…"}
            </>
          ) : (
            <>
              <Rocket size={15} />
              Build & Deploy
            </>
          )}
        </button>
      </div>
    </div>
  );
}