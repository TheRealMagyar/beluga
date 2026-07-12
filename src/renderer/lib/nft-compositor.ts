import type { NftLayer } from "../../helper/nft-generator-core";

export async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    image.src = src;
  });
}

export async function compositeTraitStack(
  traitImages: string[],
  size = 1024,
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available.");

  ctx.clearRect(0, 0, size, size);
  for (const src of traitImages) {
    const image = await loadImage(src);
    ctx.drawImage(image, 0, 0, size, size);
  }
  return canvas.toDataURL("image/png");
}

export async function renderPreviewForItem(
  layers: NftLayer[],
  selections: Record<string, string>,
  size = 512,
): Promise<string> {
  const sorted = [...layers].sort((a, b) => a.order - b.order);
  const images: string[] = [];
  for (const layer of sorted) {
    const traitId = selections[layer.id];
    const trait = layer.traits.find((entry) => entry.id === traitId);
    if (trait?.imageData) images.push(trait.imageData);
  }
  if (!images.length) throw new Error("No trait images selected for preview.");
  return compositeTraitStack(images, size);
}

export function dataUrlToBase64(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return dataUrl;
  return dataUrl.slice(comma + 1);
}