import { buildPlaygroundPackage } from "./playground-cli";
import {
  generateNftPackageFiles,
  type NftContractConfig,
  type NftPackagePreview,
} from "./nft-contract-core";

export type {
  NftContractConfig,
  NftContractMode,
  NftPackagePreview,
} from "./nft-contract-core";

export {
  generateNftPackageFiles,
  validateNftContractConfig,
} from "./nft-contract-core";

export type {
  GeneratedNftMetadata,
  NftGenerationConfig,
  NftGenerationResult,
  NftLayer,
  NftTrait,
} from "./nft-generator-core";

export {
  buildEditionsMetadata,
  generateNftCollection,
  uid as nftUid,
  validateNftGenerationConfig,
} from "./nft-generator-core";

export async function buildNftPackage(config: NftContractConfig) {
  const preview = generateNftPackageFiles(config);
  const build = await buildPlaygroundPackage(preview.files);
  return { ...build, preview };
}