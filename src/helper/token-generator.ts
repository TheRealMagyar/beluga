import {
  buildPlaygroundPackage,
  type PlaygroundBuildResult,
} from "./playground-cli";
import {
  generateTokenPackageFiles,
  type TokenGeneratorConfig,
  type TokenPackagePreview,
} from "./token-generator-core";

export type {
  TokenGeneratorConfig,
  TokenGeneratorValidation,
  TokenMintRecipientMode,
  TokenPackagePreview,
  TokenSupplyMode,
} from "./token-generator-core";

export {
  formatBaseUnits,
  generateTokenPackageFiles,
  parseTokenAmountToBaseUnits,
  resolveCoinType,
  validateTokenConfig,
} from "./token-generator-core";

export async function buildTokenPackage(
  config: TokenGeneratorConfig,
): Promise<PlaygroundBuildResult & { preview: TokenPackagePreview }> {
  const preview = generateTokenPackageFiles(config);
  const build = await buildPlaygroundPackage(preview.files);
  return { ...build, preview };
}