export interface NftTrait {
  id: string;
  name: string;
  imageData: string;
  weight: number;
}

export interface NftLayer {
  id: string;
  name: string;
  order: number;
  required: boolean;
  traits: NftTrait[];
}

export interface GeneratedNftAttribute {
  trait_type: string;
  value: string;
  rarity: number;
}

export interface GeneratedNftMetadata {
  name: string;
  description: string;
  image: string;
  imageBlobId?: string;
  attributes: GeneratedNftAttribute[];
  tokenId: number;
  rarityScore: number;
  rarityRank?: number;
  edition?: number;
  maxEdition?: number;
}

export interface NftGenerationConfig {
  collectionName: string;
  collectionDescription: string;
  symbol: string;
  baseImageUri: string;
  supply: number;
  startIndex: number;
  layers: NftLayer[];
  seed?: string;
}

export interface NftGenerationResult {
  items: GeneratedNftMetadata[];
  traitFrequency: Record<string, Record<string, number>>;
  layerStats: Array<{
    layer: string;
    trait: string;
    count: number;
    percent: number;
  }>;
}

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeightedTrait(
  traits: NftTrait[],
  random: () => number,
): NftTrait {
  const total = traits.reduce((sum, trait) => sum + Math.max(1, trait.weight), 0);
  let roll = random() * total;
  for (const trait of traits) {
    roll -= Math.max(1, trait.weight);
    if (roll <= 0) return trait;
  }
  return traits[traits.length - 1];
}

function traitRarityPercent(weight: number, layerTotal: number) {
  if (layerTotal <= 0) return 100;
  return (Math.max(1, weight) / layerTotal) * 100;
}

export function validateNftGenerationConfig(
  config: NftGenerationConfig,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!config.collectionName.trim()) errors.push("Collection name is required.");
  if (!config.collectionDescription.trim()) {
    errors.push("Collection description is required.");
  }
  if (!Number.isInteger(config.supply) || config.supply < 1) {
    errors.push("Supply must be at least 1.");
  }
  if (config.supply > 20_000) {
    errors.push("Supply is capped at 20,000 for in-app generation.");
  }
  if (!config.layers.length) {
    errors.push("Add at least one trait layer.");
  }
  for (const layer of config.layers) {
    if (!layer.name.trim()) errors.push("Every layer needs a name.");
    if (!layer.traits.length) {
      errors.push(`Layer "${layer.name || "unnamed"}" has no traits.`);
    }
    for (const trait of layer.traits) {
      if (!trait.name.trim()) {
        errors.push(`Layer "${layer.name}" has an unnamed trait.`);
      }
      if (!trait.imageData) {
        errors.push(`Trait "${trait.name}" in "${layer.name}" is missing an image.`);
      }
      if (trait.weight < 1) {
        errors.push(`Trait "${trait.name}" weight must be at least 1.`);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

export function generateNftCollection(
  config: NftGenerationConfig,
): NftGenerationResult {
  const validation = validateNftGenerationConfig(config);
  if (!validation.valid) {
    throw new Error(validation.errors.join("\n"));
  }

  const sortedLayers = [...config.layers].sort((a, b) => a.order - b.order);
  const seedBase = config.seed ?? `${config.collectionName}:${config.supply}`;
  const items: GeneratedNftMetadata[] = [];
  const traitFrequency: Record<string, Record<string, number>> = {};

  for (let i = 0; i < config.supply; i += 1) {
    const tokenId = config.startIndex + i;
    const random = mulberry32(hashSeed(`${seedBase}:${tokenId}`));
    const attributes: GeneratedNftAttribute[] = [];
    let rarityScore = 0;

    for (const layer of sortedLayers) {
      const layerTotal = layer.traits.reduce(
        (sum, trait) => sum + Math.max(1, trait.weight),
        0,
      );
      const selected = pickWeightedTrait(layer.traits, random);
      const rarity = traitRarityPercent(selected.weight, layerTotal);
      rarityScore += 100 / rarity;
      attributes.push({
        trait_type: layer.name,
        value: selected.name,
        rarity,
      });
      traitFrequency[layer.name] ??= {};
      traitFrequency[layer.name][selected.name] =
        (traitFrequency[layer.name][selected.name] ?? 0) + 1;
    }

    items.push({
      name: `${config.collectionName} #${tokenId}`,
      description: config.collectionDescription,
      image: `${config.baseImageUri}/${tokenId}.png`,
      attributes,
      tokenId,
      rarityScore,
    });
  }

  const ranked = [...items]
    .sort((a, b) => b.rarityScore - a.rarityScore)
    .map((item, index) => ({ tokenId: item.tokenId, rank: index + 1 }));
  const rankByToken = new Map(ranked.map((entry) => [entry.tokenId, entry.rank]));
  for (const item of items) {
    item.rarityRank = rankByToken.get(item.tokenId);
  }

  const layerStats = Object.entries(traitFrequency).flatMap(([layer, traits]) =>
    Object.entries(traits).map(([trait, count]) => ({
      layer,
      trait,
      count,
      percent: (count / config.supply) * 100,
    })),
  );

  return { items, traitFrequency, layerStats };
}

export function buildEditionsMetadata(
  config: {
    name: string;
    description: string;
    imageUri: string;
    maxEdition: number;
    startEdition?: number;
  },
): GeneratedNftMetadata[] {
  const start = config.startEdition ?? 1;
  const items: GeneratedNftMetadata[] = [];
  for (let edition = start; edition <= config.maxEdition; edition += 1) {
    items.push({
      name: `${config.name} #${edition}`,
      description: config.description,
      image: config.imageUri,
      attributes: [
        { trait_type: "Edition", value: String(edition), rarity: 100 },
      ],
      tokenId: edition,
      edition,
      maxEdition: config.maxEdition,
      rarityScore: 1,
      rarityRank: edition,
    });
  }
  return items;
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}