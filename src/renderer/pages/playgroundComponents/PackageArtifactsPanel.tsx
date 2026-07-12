import { CopyButton } from "../../components/CopyButton";
import type { PlaygroundBuildResult, PlaygroundDeployment } from "./types";
import { formatArtifactsClipboard } from "./package-artifacts";

function ArtifactRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  if (!value) return null;

  return (
    <div className="rounded-xl border border-[#2a2a3c] bg-[#1e1e1e] p-3">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-[10px] uppercase tracking-wide text-[#55556a]">
          {label}
        </p>
        <CopyButton text={value} label="Copy" />
      </div>
      <p className="text-[11px] font-mono text-[#a8b0c8] break-all leading-relaxed">
        {value}
      </p>
      {hint && (
        <p className="text-[10px] text-[#666680] mt-1.5 leading-relaxed">{hint}</p>
      )}
    </div>
  );
}

function TargetList({
  title,
  items,
  hint,
}: {
  title: string;
  items: string[];
  hint?: string;
}) {
  if (!items.length) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wide text-[#55556a]">
          {title}
        </p>
        <CopyButton text={items.join("\n")} label="Copy all" />
      </div>
      {hint && (
        <p className="text-[10px] text-[#666680] leading-relaxed">{hint}</p>
      )}
      <div className="space-y-1.5 max-h-40 overflow-y-auto">
        {items.map((item) => (
          <div
            key={item}
            className="flex items-start justify-between gap-2 rounded-lg border border-[#2a2a3c]/80 bg-[#16161f] px-2.5 py-2"
          >
            <span className="text-[10px] font-mono text-[#c7c7d8] break-all leading-relaxed">
              {item}
            </span>
            <CopyButton text={item} label="Copy" className="mt-0.5" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function BuildArtifactsPanel({
  buildResult,
  packageName,
  moduleNames,
}: {
  buildResult: PlaygroundBuildResult;
  packageName: string | null;
  moduleNames: string[];
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[#00d4aa]/20 bg-[#00d4aa]/5 p-3 text-[11px] text-[#8888a0]">
        Build OK — {buildResult.modules.length} bytecode module(s). Publish to get
        on-chain package and module addresses.
      </div>
      {packageName && (
        <ArtifactRow
          label="Package name (Move.toml)"
          value={packageName}
          hint="Logical name before publish assigns the on-chain package ID."
        />
      )}
      {moduleNames.length > 0 && (
        <TargetList
          title="Source modules"
          items={moduleNames}
          hint="Module segment names from .move files — not yet on-chain."
        />
      )}
    </div>
  );
}

export function DeploymentArtifactsPanel({
  deployment,
}: {
  deployment: PlaygroundDeployment;
}) {
  const clipboard = formatArtifactsClipboard(deployment);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-[#8888a0]">
          Copy package ID, module paths, and entry targets for PTBs / SDK calls.
        </p>
        <CopyButton text={clipboard} label="Copy all" />
      </div>

      <ArtifactRow label="Package ID" value={deployment.packageId} />
      {deployment.packageName && (
        <ArtifactRow label="Package name" value={deployment.packageName} />
      )}
      <ArtifactRow
        label="Transaction digest"
        value={deployment.digest}
        hint={`Published on ${deployment.network}`}
      />
      {deployment.upgradeCapId && (
        <ArtifactRow
          label="UpgradeCap object"
          value={deployment.upgradeCapId}
          hint="Use for package upgrades."
        />
      )}

      <TargetList
        title="Module addresses"
        items={deployment.moduleTargets ?? []}
        hint="Format: packageId::module — use as moveCall package segment."
      />

      <TargetList
        title="Entry function targets"
        items={deployment.entryTargets ?? []}
        hint="Format: packageId::module::function — paste into moveCall target."
      />

      <p className="text-[10px] text-[#666680] leading-relaxed">
        Shared object IDs (e.g. Lottery) appear after you call create_* entry
        functions — check the console log or Explorer for created objects.
      </p>
    </div>
  );
}