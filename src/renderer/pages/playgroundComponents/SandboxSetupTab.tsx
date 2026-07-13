import { CheckCircle2, Package, Trash2 } from "lucide-react";
import {
  formatPoolPairLabel,
  listSandboxPools,
  type DefiSandboxDeployment,
} from "./defi-playground";
import { shortObjectId } from "./defi-sandbox-utils";
import { NETWORK_CONFIG } from "./constants";
import type { PlaygroundNetwork } from "./types";
import { CopyButton } from "../../components/CopyButton";
import {
  DefiAddressField,
  DefiAlert,
  DefiCopyableText,
  DefiPanel,
  DefiPrimaryButton,
} from "./defi-ui";


export function SandboxSetupTab({
  deployment,
  network,
  busy,
  walletConnected,
  onDeploy,
  onReset,
}: {
  deployment: DefiSandboxDeployment | null;
  network: PlaygroundNetwork;
  busy: string | null;
  walletConnected: boolean;
  onDeploy: () => void;
  onReset: () => void;
}) {
  const steps = [
    {
      label: "Deploy package",
      done: Boolean(deployment?.packageId),
      detail: deployment?.packageId
        ? shortObjectId(deployment.packageId, 10, 8)
        : "Publish beluga_defi Move package",
    },
    {
      label: "Faucet objects",
      done: Boolean(deployment?.faucetAId && deployment?.faucetBId),
      detail:
        deployment?.faucetAId && deployment?.faucetBId
          ? "TA + TB faucets ready"
          : "Created on publish",
    },
    {
      label: "Pools",
      done: Boolean(deployment && listSandboxPools(deployment).length > 0),
      detail: deployment
        ? `${listSandboxPools(deployment).length} pool(s) — create in Pools tab`
        : "Create in Pools tab",
    },
  ];

  const copyAllText = deployment?.packageId
    ? [
        `Package: ${deployment.packageId}`,
        deployment.faucetAId ? `Token A faucet: ${deployment.faucetAId}` : null,
        deployment.faucetBId ? `Token B faucet: ${deployment.faucetBId}` : null,
        ...listSandboxPools(deployment).map(
          (pool) =>
            `Pool ${formatPoolPairLabel(pool)}: ${pool.poolId}\n  Coin A: ${pool.coinA.coinType}\n  Coin B: ${pool.coinB.coinType}`,
        ),
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {network === "mainnet" && (
        <DefiAlert tone="warn">
          Deploy the sandbox on <strong>Localnet</strong> or <strong>Testnet</strong>{" "}
          — not mainnet.
        </DefiAlert>
      )}

      <DefiPanel
        title="Package deployment"
        subtitle={`Publish the generic AMM pool + TA/TB faucet modules on ${NETWORK_CONFIG[network].label}.`}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-[#2a2a3c] bg-[#0d0d14] p-4 flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#34d399]/12 flex items-center justify-center text-[#34d399] flex-shrink-0">
              <Package size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-[#f0f0f5]">beluga_defi</p>
              <p className="text-[11px] text-[#55556a] mt-1 leading-relaxed">
                Modules: pool (constant-product AMM), token_a, token_b. Redeploy
                after template updates in Beluga source.
              </p>
            </div>
          </div>

          {!walletConnected && (
            <DefiAlert tone="info">Connect your wallet to deploy.</DefiAlert>
          )}

          <DefiPrimaryButton
            onClick={onDeploy}
            disabled={!!busy || !walletConnected || network === "mainnet"}
            loading={busy === "deploy"}
            className="w-full sm:w-auto"
          >
            {busy === "deploy" ? "Deploying…" : deployment?.packageId ? "Redeploy package" : "Deploy sandbox"}
          </DefiPrimaryButton>
        </div>
      </DefiPanel>

      <DefiPanel title="Setup progress" subtitle="Track what's configured for this wallet.">
        <div className="space-y-2">
          {steps.map((step) => (
            <div
              key={step.label}
              className="flex items-center gap-3 rounded-xl border border-[#2a2a3c] bg-[#0d0d14]/60 px-4 py-3"
            >
              <CheckCircle2
                size={16}
                className={step.done ? "text-[#34d399]" : "text-[#44445a]"}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium text-[#f0f0f5]">{step.label}</p>
                <p className="text-[10px] font-mono text-[#55556a] truncate">
                  {step.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </DefiPanel>

      {deployment?.packageId && (
        <DefiPanel
          title="On-chain objects"
          action={<CopyButton text={copyAllText} label="Copy all" />}
        >
          <dl className="space-y-4">
            <DefiAddressField label="Package" value={deployment.packageId} />
            {deployment.faucetAId && (
              <DefiAddressField
                label="Token A faucet"
                value={deployment.faucetAId}
              />
            )}
            {deployment.faucetBId && (
              <DefiAddressField
                label="Token B faucet"
                value={deployment.faucetBId}
              />
            )}
            {listSandboxPools(deployment).length > 0 && (
              <div>
                <dt className="text-[#55556a] uppercase tracking-wide text-[10px] mb-2">
                  Pools ({listSandboxPools(deployment).length})
                </dt>
                <dd className="space-y-2">
                  {listSandboxPools(deployment).map((pool) => (
                    <div
                      key={pool.poolId}
                      className="rounded-lg border border-[#2a2a3c] bg-[#0d0d14]/50 px-3 py-2.5 space-y-2"
                    >
                      <p className="text-[12px] text-[#c7c7d8]">
                        {pool.coinA.symbol}/{pool.coinB.symbol}
                        {deployment.activePoolId === pool.poolId && (
                          <span className="text-[#4ca3ff] ml-2">(active)</span>
                        )}
                      </p>
                      <DefiCopyableText
                        value={pool.poolId}
                        display={shortObjectId(pool.poolId, 10, 8)}
                        textClassName="text-[11px] text-[#8888a0]"
                      />
                      <DefiCopyableText
                        value={pool.coinA.coinType}
                        display={`A: ${pool.coinA.symbol}`}
                        truncate
                        textClassName="text-[10px] text-[#55556a]"
                      />
                      <DefiCopyableText
                        value={pool.coinB.coinType}
                        display={`B: ${pool.coinB.symbol}`}
                        truncate
                        textClassName="text-[10px] text-[#55556a]"
                      />
                    </div>
                  ))}
                </dd>
              </div>
            )}
          </dl>

          <button
            onClick={onReset}
            className="mt-5 inline-flex items-center gap-2 text-[11px] text-[#8888a0] hover:text-[#ff6b6b] bg-transparent border-none cursor-pointer"
          >
            <Trash2 size={13} />
            Reset sandbox state
          </button>
        </DefiPanel>
      )}
    </div>
  );
}