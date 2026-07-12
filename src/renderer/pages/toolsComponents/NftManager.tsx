import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  Image,
  Layers,
  Loader2,
  Rocket,
  Settings2,
  Database,
  FolderKanban,
  Plus,
  Trash2,
  Upload,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
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
  buildEditionsMetadata,
  generateNftCollection,
  uid,
  validateNftGenerationConfig,
  type GeneratedNftMetadata,
  type NftGenerationConfig,
  type NftLayer,
  type NftTrait,
} from "../../../helper/nft-generator-core";
import {
  validateNftContractConfig,
  type NftContractConfig as ContractConfig,
  type NftContractMode,
} from "../../../helper/nft-contract-core";
import { dataUrlToBase64, renderPreviewForItem } from "../../lib/nft-compositor";

type TabId = "art" | "contract" | "storage" | "deploy" | "manage";

type StoredBlob = Awaited<ReturnType<typeof window.tools.finalizeWalrusUpload>>;

type NftProject = {
  id: string;
  name: string;
  updatedAt: number;
  artMode: "generative" | "editions";
  generation: NftGenerationConfig;
  contract: ContractConfig;
  metadata: GeneratedNftMetadata[];
  blobs: StoredBlob[];
  deployment: {
    packageId: string;
    digest: string;
    network: SuiNetwork;
    collectionCapId: string | null;
  } | null;
};

const PROJECTS_KEY = "beluga-nft-projects-v1";

const inputClass =
  "w-full h-10 px-3 rounded-xl bg-[#1e1e1e] border border-[#2a2a3c] text-sm outline-none focus:border-[#4ca3ff]/40";

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

function loadProjects(): NftProject[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as NftProject[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveProjects(projects: NftProject[]) {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

function defaultContract(name: string): ContractConfig {
  return {
    mode: "generative-collection",
    name,
    symbol: "NFT",
    description: "A Beluga-managed NFT collection.",
    moduleName: "beluga_nft",
    typeName: "BELUGA_NFT",
    maxSupply: 100,
    royaltyBps: 500,
    mintPriceMist: 0,
    transferable: true,
    frozenDisplay: false,
  };
}

function defaultGeneration(name: string): NftGenerationConfig {
  return {
    collectionName: name,
    collectionDescription: "Generative NFT collection created in Beluga.",
    symbol: "NFT",
    baseImageUri: "walrus://pending",
    supply: 100,
    startIndex: 1,
    layers: [],
  };
}

function extractCollectionCapId(
  objectChanges: Array<{ type?: string; objectType?: string; objectId?: string }> | undefined,
  moduleName: string,
): string | null {
  return (
    objectChanges?.find(
      (change) =>
        change.type === "created" &&
        typeof change.objectType === "string" &&
        change.objectType.includes("CollectionCap") &&
        change.objectType.includes(moduleName),
    )?.objectId ?? null
  );
}

export function NftManager({
  network,
  walletAddress,
}: {
  network: SuiNetwork;
  walletAddress: string | null;
}) {
  const [tab, setTab] = useState<TabId>("art");
  const [projects, setProjects] = useState<NftProject[]>(loadProjects);
  const [activeProjectId, setActiveProjectId] = useState(
    () => loadProjects()[0]?.id ?? uid(),
  );
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [extendEpochs, setExtendEpochs] = useState(5);

  const project = useMemo(() => {
    const existing = projects.find((entry) => entry.id === activeProjectId);
    if (existing) return existing;
    const created: NftProject = {
      id: activeProjectId,
      name: "New Collection",
      updatedAt: Date.now(),
      artMode: "generative",
      generation: defaultGeneration("New Collection"),
      contract: defaultContract("New Collection"),
      metadata: [],
      blobs: [],
      deployment: null,
    };
    return created;
  }, [projects, activeProjectId]);

  const persist = useCallback(
    (next: NftProject) => {
      const updated = { ...next, updatedAt: Date.now() };
      setProjects((prev) => {
        const list = prev.some((entry) => entry.id === updated.id)
          ? prev.map((entry) => (entry.id === updated.id ? updated : entry))
          : [...prev, updated];
        saveProjects(list);
        return list;
      });
    },
    [],
  );

  const updateProject = useCallback(
    (patch: Partial<NftProject>) => {
      persist({ ...project, ...patch });
    },
    [persist, project],
  );

  const updateGeneration = useCallback(
    (patch: Partial<NftGenerationConfig>) => {
      updateProject({
        generation: { ...project.generation, ...patch },
      });
    },
    [project.generation, updateProject],
  );

  const updateContract = useCallback(
    (patch: Partial<ContractConfig>) => {
      updateProject({
        contract: { ...project.contract, ...patch },
      });
    },
    [project.contract, updateProject],
  );

  const addLayer = () => {
    const layer: NftLayer = {
      id: uid(),
      name: `Layer ${project.generation.layers.length + 1}`,
      order: project.generation.layers.length,
      required: true,
      traits: [],
    };
    updateGeneration({ layers: [...project.generation.layers, layer] });
  };

  const updateLayer = (layerId: string, patch: Partial<NftLayer>) => {
    updateGeneration({
      layers: project.generation.layers.map((layer) =>
        layer.id === layerId ? { ...layer, ...patch } : layer,
      ),
    });
  };

  const removeLayer = (layerId: string) => {
    updateGeneration({
      layers: project.generation.layers.filter((layer) => layer.id !== layerId),
    });
  };

  const addTrait = async (layerId: string, file: File) => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Failed to read image."));
      reader.readAsDataURL(file);
    });
    const trait: NftTrait = {
      id: uid(),
      name: file.name.replace(/\.[^.]+$/, ""),
      imageData: dataUrl,
      weight: 100,
    };
    updateGeneration({
      layers: project.generation.layers.map((layer) =>
        layer.id === layerId
          ? { ...layer, traits: [...layer.traits, trait] }
          : layer,
      ),
    });
  };

  const handleGenerate = async () => {
    setError(null);
    try {
      if (project.artMode === "editions") {
        const items = buildEditionsMetadata({
          name: project.generation.collectionName,
          description: project.generation.collectionDescription,
          imageUri: project.generation.baseImageUri,
          maxEdition: project.contract.maxSupply,
        });
        updateProject({ metadata: items });
        setTab("storage");
        return;
      }
      const validation = validateNftGenerationConfig(project.generation);
      if (!validation.valid) throw new Error(validation.errors.join("\n"));
      const result = generateNftCollection(project.generation);
      updateProject({ metadata: result.items });
      if (result.items.length) {
        const first = result.items[0];
        const selections: Record<string, string> = {};
        for (const attr of first.attributes) {
          const layer = project.generation.layers.find((l) => l.name === attr.trait_type);
          const trait = layer?.traits.find((t) => t.name === attr.value);
          if (layer && trait) selections[layer.id] = trait.id;
        }
        const preview = await renderPreviewForItem(
          project.generation.layers,
          selections,
        );
        setPreviewDataUrl(preview);
      }
      setTab("storage");
    } catch (e: any) {
      setError(e.message || "Generation failed.");
    }
  };

  const uploadWalrusFile = async (fileName: string, base64: string) => {
    if (!walletAddress) throw new Error("Connect wallet before Walrus upload.");
    if (!window.tools?.prepareWalrusUpload) {
      throw new Error("Walrus API not loaded. Restart Beluga.");
    }
    const walrusNetwork =
      network === "mainnet" ? "mainnet" : "testnet";
    const prepared = await window.tools.prepareWalrusUpload({
      network: walrusNetwork,
      owner: walletAddress,
      fileName,
      contentBase64: base64,
      epochs: 5,
    });
    const suiClient = createSuiClient(network);
    const registerResult = await signAndExecuteTransaction(
      suiClient,
      walletAddress,
      Transaction.from(prepared.registerTxBytes),
      network,
    );
    const certifyPrep = await window.tools.completeWalrusRegister({
      flowId: prepared.flowId,
      registerDigest: registerResult.digest,
    });
    const certifyResult = await signAndExecuteTransaction(
      suiClient,
      walletAddress,
      Transaction.from(certifyPrep.certifyTxBytes),
      network,
    );
    void certifyResult;
    return window.tools.finalizeWalrusUpload({ flowId: prepared.flowId });
  };

  const handleUploadMetadataBundle = async () => {
    if (!project.metadata.length) {
      setError("Generate metadata first.");
      return;
    }
    setBusy("Uploading metadata bundle to Walrus…");
    setError(null);
    try {
      const json = JSON.stringify(project.metadata, null, 2);
      const base64 =
        typeof Buffer !== "undefined"
          ? Buffer.from(json, "utf-8").toString("base64")
          : btoa(unescape(encodeURIComponent(json)));
      const blob = await uploadWalrusFile(
        `${project.name.replace(/\s+/g, "_")}-metadata.json`,
        base64,
      );
      updateProject({ blobs: [...project.blobs, blob] });
    } catch (e: any) {
      setError(e.message || "Walrus metadata upload failed.");
    }
    setBusy(null);
  };

  const handleUploadPreviewImages = async () => {
    if (project.artMode !== "generative" || !project.metadata.length) {
      setError("Generate a generative collection first.");
      return;
    }
    setBusy("Compositing and uploading preview set…");
    setError(null);
    try {
      const uploaded: StoredBlob[] = [];
      const limit = Math.min(project.metadata.length, 10);
      for (let i = 0; i < limit; i += 1) {
        const item = project.metadata[i];
        const selections: Record<string, string> = {};
        for (const attr of item.attributes) {
          const layer = project.generation.layers.find(
            (l) => l.name === attr.trait_type,
          );
          const trait = layer?.traits.find((t) => t.name === attr.value);
          if (layer && trait) selections[layer.id] = trait.id;
        }
        const png = await renderPreviewForItem(project.generation.layers, selections);
        const blob = await uploadWalrusFile(
          `${project.name}-${item.tokenId}.png`,
          dataUrlToBase64(png),
        );
        uploaded.push(blob);
        item.image = `https://aggregator.walrus-testnet.walrus.space/v1/${blob.blobId}`;
        item.imageBlobId = blob.blobId;
      }
      updateProject({
        metadata: [...project.metadata],
        blobs: [...project.blobs, ...uploaded],
      });
    } catch (e: any) {
      setError(e.message || "Image upload failed.");
    }
    setBusy(null);
  };

  const handleDeploy = async () => {
    if (!walletAddress) {
      setError("Connect wallet before deploy.");
      return;
    }
    const contractValidation = validateNftContractConfig(project.contract);
    if (!contractValidation.valid) {
      setError(contractValidation.errors.join("\n"));
      return;
    }
    setBusy("Building NFT package…");
    setError(null);
    try {
      const build = await window.tools.buildNftPackage(project.contract);
      setBusy(`Publishing to ${SUI_NETWORKS[network].label}…`);
      const suiClient = createSuiClient(network);
      const publishResult = await publishPackage(
        suiClient,
        walletAddress,
        build.modules,
        build.dependencies,
        network,
      );
      const packageId = await resolvePackageIdFromPublish(suiClient, publishResult);
      const collectionCapId = extractCollectionCapId(
        publishResult.objectChanges,
        project.contract.moduleName,
      );
      updateProject({
        deployment: {
          packageId,
          digest: publishResult.digest,
          network,
          collectionCapId,
        },
      });
      setTab("manage");
    } catch (e: any) {
      setError(e.message || "Deploy failed.");
    }
    setBusy(null);
  };

  const handleMintSample = async () => {
    if (!walletAddress || !project.deployment?.packageId || !project.deployment.collectionCapId) {
      setError("Deploy contract and ensure CollectionCap is available.");
      return;
    }
    const item = project.metadata[0];
    if (!item) {
      setError("Generate metadata before minting.");
      return;
    }
    setBusy("Minting sample NFT…");
    setError(null);
    try {
      const suiClient = createSuiClient(network);
      const tx = new Transaction();
      const targetFn =
        project.contract.mode === "editions" ? "mint_edition" : "mint";
      const encoder = new TextEncoder();
      if (targetFn === "mint_edition") {
        tx.moveCall({
          package: project.deployment.packageId,
          module: project.contract.moduleName,
          function: "mint_edition",
          arguments: [
            tx.object(project.deployment.collectionCapId),
            tx.pure.vector("u8", Array.from(encoder.encode(item.name))),
            tx.pure.vector("u8", Array.from(encoder.encode(item.description))),
            tx.pure.vector("u8", Array.from(encoder.encode(item.image))),
            tx.pure.u64(BigInt(item.edition ?? item.tokenId)),
            tx.pure.address(walletAddress),
          ],
        });
      } else {
        tx.moveCall({
          package: project.deployment.packageId,
          module: project.contract.moduleName,
          function: "mint",
          arguments: [
            tx.object(project.deployment.collectionCapId),
            tx.pure.vector("u8", Array.from(encoder.encode(item.name))),
            tx.pure.vector("u8", Array.from(encoder.encode(item.description))),
            tx.pure.vector("u8", Array.from(encoder.encode(item.image))),
            tx.pure.vector(
              "u8",
              Array.from(encoder.encode(JSON.stringify(item.attributes))),
            ),
            tx.pure.address(walletAddress),
          ],
        });
      }
      await signAndExecuteTransaction(suiClient, walletAddress, tx, network);
    } catch (e: any) {
      setError(e.message || "Mint failed.");
    }
    setBusy(null);
  };

  const handleRenewBlob = async (blobObjectId: string) => {
    if (!walletAddress) return;
    setBusy("Preparing Walrus storage extension…");
    setError(null);
    try {
      const walrusNetwork = network === "mainnet" ? "mainnet" : "testnet";
      const prepared = await window.tools.prepareWalrusExtend({
        network: walrusNetwork,
        blobObjectId,
        epochs: extendEpochs,
        sender: walletAddress,
      });
      const suiClient = createSuiClient(network);
      await signAndExecuteTransaction(
        suiClient,
        walletAddress,
        Transaction.from(prepared.txBytes),
        network,
      );
    } catch (e: any) {
      setError(e.message || "Renew failed.");
    }
    setBusy(null);
  };

  const contractValidation = useMemo(
    () => validateNftContractConfig(project.contract),
    [project.contract],
  );

  const tabs: Array<{ id: TabId; label: string; icon: typeof Image }> = [
    { id: "art", label: "Art & Rarity", icon: Layers },
    { id: "contract", label: "Contract", icon: Settings2 },
    { id: "storage", label: "Walrus Storage", icon: Database },
    { id: "deploy", label: "Deploy", icon: Rocket },
    { id: "manage", label: "Manage", icon: FolderKanban },
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-shrink-0 px-6 py-5 border-b border-white/[0.06]">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[280px]">
            <h2 className="text-xl font-bold text-[#f0f0f5] mb-1">NFT Manager</h2>
            <p className="text-sm text-[#8888a0] max-w-3xl">
              Layered generative art, rarity tables, Walrus media storage, and
              deployable Sui collection or editions contracts.
            </p>
          </div>
          <div className="text-[12px] px-3 py-1.5 rounded-full border border-[#4ca3ff]/25 text-[#4ca3ff] bg-[#4ca3ff]/10">
            {SUI_NETWORKS[network].label}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {tabs.map((entry) => {
            const Icon = entry.icon;
            const active = tab === entry.id;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => setTab(entry.id)}
                className={`h-9 px-3 rounded-xl border text-[12px] flex items-center gap-2 cursor-pointer ${
                  active
                    ? "border-[#4ca3ff]/35 bg-[#4ca3ff]/10 text-[#f0f0f5]"
                    : "border-[#2a2a3c] bg-[#1e1e1e] text-[#8888a0]"
                }`}
              >
                <Icon size={14} />
                {entry.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            className={`${inputClass} max-w-xs`}
            value={activeProjectId}
            onChange={(e) => setActiveProjectId(e.target.value)}
          >
            {projects.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
            {!projects.some((entry) => entry.id === activeProjectId) ? (
              <option value={activeProjectId}>{project.name}</option>
            ) : null}
          </select>
          <button
            type="button"
            className="h-10 px-3 rounded-xl border border-[#2a2a3c] text-[12px] text-[#c7c7d8] cursor-pointer"
            onClick={() => {
              const id = uid();
              const name = `Collection ${projects.length + 1}`;
              const created: NftProject = {
                id,
                name,
                updatedAt: Date.now(),
                artMode: "generative",
                generation: defaultGeneration(name),
                contract: defaultContract(name),
                metadata: [],
                blobs: [],
                deployment: null,
              };
              setProjects((prev) => {
                const list = [...prev, created];
                saveProjects(list);
                return list;
              });
              setActiveProjectId(id);
            }}
          >
            <Plus size={14} className="inline mr-1" />
            New project
          </button>
        </div>

        {error ? (
          <div className="rounded-xl border border-[#ff4d6d]/30 bg-[#ff4d6d]/10 px-4 py-3 text-[13px] text-[#ffb4c0] flex gap-2">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
            <span className="whitespace-pre-wrap">{error}</span>
          </div>
        ) : null}

        {tab === "art" ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <section className="space-y-4 rounded-2xl border border-[#2a2a3c] bg-[#12121a] p-4">
              <FieldLabel label="Project name">
                <input
                  className={inputClass}
                  value={project.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    updateProject({
                      name,
                      generation: { ...project.generation, collectionName: name },
                      contract: { ...project.contract, name },
                    });
                  }}
                />
              </FieldLabel>
              <FieldLabel label="Art mode">
                <select
                  className={inputClass}
                  value={project.artMode}
                  onChange={(e) =>
                    updateProject({
                      artMode: e.target.value as "generative" | "editions",
                      contract: {
                        ...project.contract,
                        mode:
                          e.target.value === "editions"
                            ? "editions"
                            : "generative-collection",
                      },
                    })
                  }
                >
                  <option value="generative">Generative collection (layers)</option>
                  <option value="editions">Editions (same artwork)</option>
                </select>
              </FieldLabel>
              <FieldLabel label="Supply">
                <input
                  className={inputClass}
                  type="number"
                  min={1}
                  value={project.generation.supply}
                  onChange={(e) => {
                    const supply = Number(e.target.value);
                    updateGeneration({ supply });
                    updateContract({ maxSupply: supply });
                  }}
                />
              </FieldLabel>
              <FieldLabel label="Description">
                <textarea
                  className={`${inputClass} min-h-[80px] py-2 resize-y`}
                  value={project.generation.collectionDescription}
                  onChange={(e) =>
                    updateGeneration({ collectionDescription: e.target.value })
                  }
                />
              </FieldLabel>
              {project.artMode === "editions" ? (
                <FieldLabel label="Edition image URI">
                  <input
                    className={inputClass}
                    value={project.generation.baseImageUri}
                    onChange={(e) =>
                      updateGeneration({ baseImageUri: e.target.value })
                    }
                    placeholder="https:// or walrus aggregator URL"
                  />
                </FieldLabel>
              ) : null}
              <button
                type="button"
                onClick={() => void handleGenerate()}
                className="h-10 px-4 rounded-xl bg-[#4ca3ff] text-white text-sm font-medium cursor-pointer"
              >
                Generate metadata & rarity
              </button>
            </section>

            <section className="space-y-3 rounded-2xl border border-[#2a2a3c] bg-[#12121a] p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-[#f0f0f5]">Trait layers</h3>
                <button
                  type="button"
                  onClick={addLayer}
                  className="text-[12px] text-[#4ca3ff] cursor-pointer bg-transparent border-none"
                >
                  + Add layer
                </button>
              </div>
              {project.generation.layers.map((layer) => (
                <div
                  key={layer.id}
                  className="rounded-xl border border-[#2a2a3c] bg-[#1a1a24] p-3 space-y-2"
                >
                  <div className="flex gap-2">
                    <input
                      className={inputClass}
                      value={layer.name}
                      onChange={(e) => updateLayer(layer.id, { name: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => removeLayer(layer.id)}
                      className="h-10 w-10 rounded-xl border border-[#ff4d6d]/30 text-[#ff4d6d] cursor-pointer"
                    >
                      <Trash2 size={14} className="mx-auto" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {layer.traits.map((trait) => (
                      <div
                        key={trait.id}
                        className="rounded-lg border border-[#2a2a3c] p-2 w-[88px]"
                      >
                        <img
                          src={trait.imageData}
                          alt={trait.name}
                          className="w-full h-[64px] object-cover rounded-md mb-1"
                        />
                        <p className="text-[10px] truncate text-[#c7c7d8]">{trait.name}</p>
                        <input
                          className="w-full mt-1 h-7 px-1 rounded bg-[#1e1e1e] border border-[#2a2a3c] text-[10px]"
                          type="number"
                          min={1}
                          value={trait.weight}
                          onChange={(e) =>
                            updateLayer(layer.id, {
                              traits: layer.traits.map((entry) =>
                                entry.id === trait.id
                                  ? { ...entry, weight: Number(e.target.value) }
                                  : entry,
                              ),
                            })
                          }
                        />
                      </div>
                    ))}
                    <label className="w-[88px] h-[108px] rounded-lg border border-dashed border-[#444466] flex flex-col items-center justify-center text-[10px] text-[#8888a0] cursor-pointer">
                      <Upload size={14} />
                      Trait
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void addTrait(layer.id, file);
                        }}
                      />
                    </label>
                  </div>
                </div>
              ))}
              {previewDataUrl ? (
                <div>
                  <p className="text-[11px] text-[#8888a0] mb-2">Preview #1</p>
                  <img
                    src={previewDataUrl}
                    alt="Preview"
                    className="w-full max-w-[280px] rounded-xl border border-[#2a2a3c]"
                  />
                </div>
              ) : null}
            </section>

            {project.metadata.length ? (
              <section className="xl:col-span-2 rounded-2xl border border-[#2a2a3c] bg-[#12121a] p-4">
                <h3 className="text-[14px] font-semibold text-[#f0f0f5] mb-3">
                  Rarity snapshot ({project.metadata.length} items)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-[#8888a0] text-left">
                        <th className="py-2 pr-3">Token</th>
                        <th className="py-2 pr-3">Rank</th>
                        <th className="py-2 pr-3">Score</th>
                        <th className="py-2">Traits</th>
                      </tr>
                    </thead>
                    <tbody>
                      {project.metadata.slice(0, 25).map((item) => (
                        <tr key={item.tokenId} className="border-t border-[#2a2a3c]">
                          <td className="py-2 pr-3 font-mono">#{item.tokenId}</td>
                          <td className="py-2 pr-3">{item.rarityRank ?? "—"}</td>
                          <td className="py-2 pr-3">{item.rarityScore.toFixed(2)}</td>
                          <td className="py-2 text-[#c7c7d8]">
                            {item.attributes
                              .map((a) => `${a.trait_type}:${a.value}`)
                              .join(" · ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}
          </div>
        ) : null}

        {tab === "contract" ? (
          <section className="grid grid-cols-1 xl:grid-cols-2 gap-4 rounded-2xl border border-[#2a2a3c] bg-[#12121a] p-4">
            <FieldLabel label="Contract mode">
              <select
                className={inputClass}
                value={project.contract.mode}
                onChange={(e) =>
                  updateContract({ mode: e.target.value as NftContractMode })
                }
              >
                <option value="generative-collection">Generative collection</option>
                <option value="editions">Editions</option>
                <option value="open-editions">Open editions</option>
              </select>
            </FieldLabel>
            <FieldLabel label="Max supply">
              <input
                className={inputClass}
                type="number"
                min={1}
                value={project.contract.maxSupply}
                onChange={(e) =>
                  updateContract({ maxSupply: Number(e.target.value) })
                }
              />
            </FieldLabel>
            <FieldLabel label="Module name">
              <input
                className={inputClass}
                value={project.contract.moduleName}
                onChange={(e) => updateContract({ moduleName: e.target.value })}
              />
            </FieldLabel>
            <FieldLabel label="NFT type name">
              <input
                className={inputClass}
                value={project.contract.typeName}
                onChange={(e) => updateContract({ typeName: e.target.value })}
              />
            </FieldLabel>
            <FieldLabel label="Royalty (bps)">
              <input
                className={inputClass}
                type="number"
                min={0}
                max={10000}
                value={project.contract.royaltyBps}
                onChange={(e) =>
                  updateContract({ royaltyBps: Number(e.target.value) })
                }
              />
            </FieldLabel>
            <FieldLabel label="Mint price (MIST)">
              <input
                className={inputClass}
                type="number"
                min={0}
                value={project.contract.mintPriceMist}
                onChange={(e) =>
                  updateContract({ mintPriceMist: Number(e.target.value) })
                }
              />
            </FieldLabel>
            {!contractValidation.valid ? (
              <div className="xl:col-span-2 text-[12px] text-[#ffb4c0]">
                {contractValidation.errors.join(" ")}
              </div>
            ) : null}
          </section>
        ) : null}

        {tab === "storage" ? (
          <section className="space-y-4 rounded-2xl border border-[#2a2a3c] bg-[#12121a] p-4">
            {network === "localnet" ? (
              <p className="text-[12px] text-[#ffb347]">
                Walrus uploads use testnet/mainnet storage. Switch network for blob
                uploads, or keep metadata local until deploy.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void handleUploadMetadataBundle()}
                className="h-10 px-4 rounded-xl bg-[#4ca3ff] text-white text-sm cursor-pointer disabled:opacity-50"
              >
                Upload metadata JSON to Walrus
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void handleUploadPreviewImages()}
                className="h-10 px-4 rounded-xl border border-[#2a2a3c] text-[#c7c7d8] text-sm cursor-pointer disabled:opacity-50"
              >
                Upload first 10 images to Walrus
              </button>
            </div>
            {busy ? (
              <p className="text-[12px] text-[#4ca3ff] flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> {busy}
              </p>
            ) : null}
            <div className="space-y-2">
              {project.blobs.map((blob) => (
                <div
                  key={blob.id}
                  className="rounded-xl border border-[#2a2a3c] bg-[#1a1a24] p-3 text-[12px]"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[#f0f0f5] font-medium">{blob.fileName}</span>
                    <code className="font-mono text-[#8888a0]">{blob.blobId}</code>
                    <CopyButton text={blob.blobId} label="Copy" />
                  </div>
                  <p className="text-[#666680] mt-1">
                    Object {blob.blobObjectId} · {blob.epochs} epochs ·{" "}
                    {(blob.sizeBytes / 1024).toFixed(1)} KB
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {tab === "deploy" ? (
          <section className="space-y-4 rounded-2xl border border-[#2a2a3c] bg-[#12121a] p-4">
            <button
              type="button"
              disabled={!!busy || !walletAddress || !contractValidation.valid}
              onClick={() => void handleDeploy()}
              className="h-10 px-5 rounded-xl bg-[#4ca3ff] text-white text-sm font-medium cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
              Build & Deploy contract
            </button>
            <button
              type="button"
              disabled={!!busy || !project.deployment}
              onClick={() => void handleMintSample()}
              className="h-10 px-4 rounded-xl border border-[#2a2a3c] text-[#c7c7d8] text-sm cursor-pointer disabled:opacity-50"
            >
              Mint sample #1
            </button>
            {project.deployment ? (
              <div className="rounded-xl border border-[#00d4aa]/30 bg-[#00d4aa]/8 p-3 text-[12px] space-y-2">
                <div className="flex items-center gap-2 text-[#00d4aa]">
                  <CheckCircle2 size={16} /> Deployed
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[#8888a0]">Package</span>
                  <code className="font-mono">{project.deployment.packageId}</code>
                  <CopyButton text={project.deployment.packageId} />
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {tab === "manage" ? (
          <section className="space-y-4 rounded-2xl border border-[#2a2a3c] bg-[#12121a] p-4">
            <FieldLabel label="Extend storage epochs">
              <input
                className={inputClass}
                type="number"
                min={1}
                value={extendEpochs}
                onChange={(e) => setExtendEpochs(Number(e.target.value))}
              />
            </FieldLabel>
            {project.blobs.map((blob) => (
              <div
                key={`manage-${blob.id}`}
                className="rounded-xl border border-[#2a2a3c] p-3 flex flex-wrap items-center gap-3"
              >
                <div className="flex-1 min-w-[200px]">
                  <p className="text-[13px] text-[#f0f0f5]">{blob.fileName}</p>
                  <p className="text-[11px] font-mono text-[#8888a0]">{blob.blobObjectId}</p>
                </div>
                <button
                  type="button"
                  disabled={!!busy || !walletAddress}
                  onClick={() => void handleRenewBlob(blob.blobObjectId)}
                  className="h-9 px-3 rounded-xl border border-[#ffb347]/35 text-[#ffb347] text-[12px] cursor-pointer disabled:opacity-50 flex items-center gap-1"
                >
                  <RefreshCw size={13} /> Renew storage
                </button>
              </div>
            ))}
            {!project.blobs.length ? (
              <p className="text-[12px] text-[#8888a0]">
                No Walrus blobs yet. Upload media in the Storage tab.
              </p>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}