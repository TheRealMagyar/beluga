export type TokenSupplyMode = "unlimited" | "fixed";
export type TokenMintRecipientMode = "publisher" | "custom";

export interface TokenGeneratorConfig {
  name: string;
  symbol: string;
  description: string;
  iconUrl?: string;
  decimals: number;
  moduleName: string;
  coinTypeName: string;
  supplyMode: TokenSupplyMode;
  freezeMetadata: boolean;
  initialMint: {
    enabled: boolean;
    amount: string;
    recipientMode: TokenMintRecipientMode;
    recipient?: string;
  };
}

export interface TokenGeneratorValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface TokenPackageFile {
  path: string;
  content: string;
}

export interface TokenPackagePreview {
  coinTypePlaceholder: string;
  files: TokenPackageFile[];
  initialMintBaseUnits: string | null;
}

const U64_MAX = (1n << 64n) - 1n;

function escapeMoveBytes(value: string): string {
  const bytes = Array.from(new TextEncoder().encode(value));
  if (!bytes.length) return "b\"\"";
  return `b"${bytes.map((b) => `\\x${b.toString(16).padStart(2, "0")}`).join("")}"`;
}

function isValidMoveIdent(value: string, allowUpper = false): boolean {
  const pattern = allowUpper ? /^[A-Z][A-Z0-9_]*$/ : /^[a-z][a-z0-9_]*$/;
  return pattern.test(value);
}

function isValidSuiAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{1,64}$/.test(value);
}

export function parseTokenAmountToBaseUnits(
  amount: string,
  decimals: number,
): bigint {
  const trimmed = amount.trim();
  if (!trimmed) {
    throw new Error("Mint amount is required.");
  }
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("Mint amount must be a positive number.");
  }

  const [whole, fraction = ""] = trimmed.split(".");
  if (fraction.length > decimals) {
    throw new Error(
      `Mint amount has more than ${decimals} decimal place${decimals === 1 ? "" : "s"}.`,
    );
  }

  const paddedFraction = fraction.padEnd(decimals, "0");
  const base = BigInt(`${whole}${paddedFraction}`);
  if (base <= 0n) {
    throw new Error("Mint amount must be greater than zero.");
  }
  if (base > U64_MAX) {
    throw new Error("Mint amount exceeds the u64 supply limit.");
  }
  return base;
}

export function formatBaseUnits(amount: bigint, decimals: number): string {
  if (decimals === 0) return amount.toString();
  const raw = amount.toString().padStart(decimals + 1, "0");
  const whole = raw.slice(0, -decimals) || "0";
  const fraction = raw.slice(-decimals).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

export function validateTokenConfig(
  config: TokenGeneratorConfig,
): TokenGeneratorValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  const name = config.name.trim();
  const symbol = config.symbol.trim();
  const description = config.description.trim();
  const moduleName = config.moduleName.trim();
  const coinTypeName = config.coinTypeName.trim();
  const iconUrl = config.iconUrl?.trim() ?? "";

  if (!name) errors.push("Token name is required.");
  else if (name.length > 64) errors.push("Token name must be 64 characters or fewer.");

  if (!symbol) errors.push("Symbol is required.");
  else if (symbol.length > 10) errors.push("Symbol must be 10 characters or fewer.");
  else if (!/^[A-Za-z0-9]+$/.test(symbol)) {
    errors.push("Symbol may only contain letters and numbers.");
  }

  if (description.length > 512) {
    errors.push("Description must be 512 characters or fewer.");
  }

  if (!Number.isInteger(config.decimals) || config.decimals < 0 || config.decimals > 18) {
    errors.push("Decimals must be an integer between 0 and 18.");
  }

  if (!moduleName) errors.push("Module name is required.");
  else if (!isValidMoveIdent(moduleName)) {
    errors.push("Module name must start with a lowercase letter and use only a-z, 0-9, or _.");
  }

  if (!coinTypeName) errors.push("Coin type name is required.");
  else if (!isValidMoveIdent(coinTypeName, true)) {
    errors.push(
      "Coin type name must be ALL_CAPS and use only A-Z, 0-9, or _ (one-time witness convention).",
    );
  }

  if (iconUrl) {
    try {
      const parsed = new URL(iconUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        errors.push("Icon URL must use http or https.");
      }
    } catch {
      errors.push("Icon URL is not a valid URL.");
    }
  } else {
    warnings.push("No icon URL set. Metadata will be published without an icon.");
  }

  if (config.supplyMode === "fixed" && !config.initialMint.enabled) {
    warnings.push(
      "Fixed supply with no initial mint creates a token with zero circulating supply.",
    );
  }

  if (config.initialMint.enabled) {
    try {
      parseTokenAmountToBaseUnits(config.initialMint.amount, config.decimals);
    } catch (err: any) {
      errors.push(err.message || "Invalid initial mint amount.");
    }

    if (config.initialMint.recipientMode === "custom") {
      const recipient = config.initialMint.recipient?.trim() ?? "";
      if (!recipient) {
        errors.push("Custom mint recipient address is required.");
      } else if (!isValidSuiAddress(recipient)) {
        errors.push("Custom mint recipient must be a valid Sui address.");
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function buildInitBody(
  config: TokenGeneratorConfig,
  initialMintBaseUnits: bigint | null,
): string {
  const iconExpr = config.iconUrl?.trim()
    ? `option::some(url::new_unsafe_from_bytes(${escapeMoveBytes(config.iconUrl.trim())}))`
    : "option::none()";

  const lines: string[] = [
    `        let (mut treasury, metadata) = coin::create_currency(`,
    `            witness,`,
    `            ${config.decimals},`,
    `            ${escapeMoveBytes(config.symbol.trim())},`,
    `            ${escapeMoveBytes(config.name.trim())},`,
    `            ${escapeMoveBytes(config.description.trim())},`,
    `            ${iconExpr},`,
    `            ctx,`,
    `        );`,
  ];

  if (config.freezeMetadata) {
    lines.push("        transfer::public_freeze_object(metadata);");
  } else {
    lines.push("        transfer::public_transfer(metadata, tx_context::sender(ctx));");
  }

  if (config.supplyMode === "fixed") {
    if (initialMintBaseUnits) {
      const recipientExpr =
        config.initialMint.recipientMode === "custom" &&
        config.initialMint.recipient?.trim()
          ? `@${config.initialMint.recipient.trim()}`
          : "tx_context::sender(ctx)";

      lines.push(
        `        let coin = coin::mint(&mut treasury, ${initialMintBaseUnits}, ctx);`,
        `        transfer::public_transfer(coin, ${recipientExpr});`,
      );
    }
    lines.push("        coin::destroy_treasury_cap(treasury);");
  } else {
    lines.push("        transfer::public_transfer(treasury, tx_context::sender(ctx));");
  }

  return lines.join("\n");
}

function buildMintEntry(coinTypeName: string): string {
  return `
    /// Mint new tokens. Only the TreasuryCap holder can call this.
    public entry fun mint(
        treasury_cap: &mut TreasuryCap<${coinTypeName}>,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext,
    ) {
        let coin = coin::mint(treasury_cap, amount, ctx);
        transfer::public_transfer(coin, recipient);
    }
`.replace(/^    /gm, "");
}

export function generateTokenPackageFiles(
  config: TokenGeneratorConfig,
): TokenPackagePreview {
  const validation = validateTokenConfig(config);
  if (!validation.valid) {
    throw new Error(validation.errors.join("\n"));
  }

  const moduleName = config.moduleName.trim();
  const coinTypeName = config.coinTypeName.trim();
  const initialMintBaseUnits =
    config.initialMint.enabled
      ? parseTokenAmountToBaseUnits(
          config.initialMint.amount,
          config.decimals,
        )
      : null;

  const initBody = buildInitBody(config, initialMintBaseUnits);
  const mintEntry =
    config.supplyMode === "unlimited" ? buildMintEntry(coinTypeName) : "";

  const moveSource = `module ${moduleName}::${moduleName} {
    use std::option;
    use sui::coin::{Self, TreasuryCap};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::url;

    /// One-time witness for the regulated coin.
    public struct ${coinTypeName} has drop {}

    fun init(witness: ${coinTypeName}, ctx: &mut TxContext) {
${initBody}
    }
${mintEntry}}
`;

  const moveToml = `[package]
name = "${moduleName}"
edition = "2024.beta"

[dependencies]
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "framework/testnet" }

[addresses]
${moduleName} = "0x0"
`;

  return {
    coinTypePlaceholder: `0x0::${moduleName}::${coinTypeName}`,
    files: [
      { path: "Move.toml", content: moveToml },
      { path: `sources/${moduleName}.move`, content: moveSource },
    ],
    initialMintBaseUnits: initialMintBaseUnits?.toString() ?? null,
  };
}

export function resolveCoinType(packageId: string, config: TokenGeneratorConfig) {
  return `${packageId}::${config.moduleName.trim()}::${config.coinTypeName.trim()}`;
}