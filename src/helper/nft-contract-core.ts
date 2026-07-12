export type NftContractMode =
  | "generative-collection"
  | "editions"
  | "open-editions";

export interface NftContractConfig {
  mode: NftContractMode;
  name: string;
  symbol: string;
  description: string;
  moduleName: string;
  typeName: string;
  maxSupply: number;
  royaltyBps: number;
  mintPriceMist: number;
  transferable: boolean;
  frozenDisplay: boolean;
}

export interface NftPackagePreview {
  files: Array<{ path: string; content: string }>;
  nftTypePlaceholder: string;
}

function escapeMoveBytes(value: string): string {
  const bytes = Array.from(new TextEncoder().encode(value));
  if (!bytes.length) return "b\"\"";
  return `b"${bytes.map((b) => `\\x${b.toString(16).padStart(2, "0")}`).join("")}"`;
}

function isValidMoveIdent(value: string, upper = false): boolean {
  const pattern = upper ? /^[A-Z][A-Z0-9_]*$/ : /^[a-z][a-z0-9_]*$/;
  return pattern.test(value);
}

export function validateNftContractConfig(
  config: NftContractConfig,
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config.name.trim()) errors.push("Collection name is required.");
  if (!config.symbol.trim()) errors.push("Symbol is required.");
  if (!config.description.trim()) errors.push("Description is required.");
  if (!isValidMoveIdent(config.moduleName)) {
    errors.push("Module name must be lowercase and start with a letter.");
  }
  if (!isValidMoveIdent(config.typeName, true)) {
    errors.push("NFT type name must be ALL_CAPS.");
  }
  if (!Number.isInteger(config.maxSupply) || config.maxSupply < 1) {
    errors.push("Max supply must be at least 1.");
  }
  if (config.mode === "open-editions" && config.maxSupply < 1_000_000) {
    warnings.push(
      "Open editions uses a high on-chain cap — mint until you transfer the cap away or hit the cap.",
    );
  }
  if (config.royaltyBps < 0 || config.royaltyBps > 10_000) {
    errors.push("Royalty must be between 0 and 10000 bps (100%).");
  }
  if (config.mintPriceMist < 0) {
    errors.push("Mint price cannot be negative.");
  }

  return { valid: errors.length === 0, errors, warnings };
}

function buildMintBody(mode: NftContractMode): string {
  if (mode === "editions") {
    return `
    public entry fun mint_edition(
        cap: &mut CollectionCap,
        name: vector<u8>,
        description: vector<u8>,
        image_url: vector<u8>,
        edition: u64,
        recipient: address,
        ctx: &mut TxContext,
    ) {
        assert!(cap.minted < cap.max_supply, E_MAX_SUPPLY);
        assert!(edition > 0 && edition <= cap.max_supply, E_BAD_EDITION);
        cap.minted = cap.minted + 1;
        let nft = NFT {
            id: object::new(ctx),
            token_id: edition,
            edition,
            max_edition: cap.max_supply,
            name: string::utf8(name),
            description: string::utf8(description),
            image_url: string::utf8(image_url),
            attributes_json: string::utf8(b"{}"),
        };
        event::emit(MintEvent { token_id: edition, recipient });
        transfer::public_transfer(nft, recipient);
    }`;
  }

  return `
    public entry fun mint(
        cap: &mut CollectionCap,
        name: vector<u8>,
        description: vector<u8>,
        image_url: vector<u8>,
        attributes_json: vector<u8>,
        recipient: address,
        ctx: &mut TxContext,
    ) {
        assert!(cap.minted < cap.max_supply, E_MAX_SUPPLY);
        let token_id = cap.minted;
        cap.minted = cap.minted + 1;
        let nft = NFT {
            id: object::new(ctx),
            token_id,
            edition: 0,
            max_edition: 0,
            name: string::utf8(name),
            description: string::utf8(description),
            image_url: string::utf8(image_url),
            attributes_json: string::utf8(attributes_json),
        };
        event::emit(MintEvent { token_id, recipient });
        transfer::public_transfer(nft, recipient);
    }`;
}

export function generateNftPackageFiles(
  config: NftContractConfig,
): NftPackagePreview {
  const validation = validateNftContractConfig(config);
  if (!validation.valid) {
    throw new Error(validation.errors.join("\n"));
  }

  const moduleName = config.moduleName.trim();
  const typeName = config.typeName.trim();
  const maxSupply =
    config.mode === "open-editions" ? 1_000_000_000 : config.maxSupply;
  const mintEntry = buildMintBody(config.mode);

  const moveSource = `module ${moduleName}::${moduleName} {
    use std::string::{Self, String};
    use sui::display;
    use sui::event;
    use sui::object::{Self, UID};
    use sui::package;
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    const E_MAX_SUPPLY: u64 = 0;
    const E_BAD_EDITION: u64 = 1;

    public struct ${typeName} has drop {}

    public struct CollectionCap has key, store {
        id: UID,
        minted: u64,
        max_supply: u64,
        royalty_bps: u16,
        mint_price_mist: u64,
    }

    public struct NFT has key, store {
        id: UID,
        token_id: u64,
        edition: u64,
        max_edition: u64,
        name: String,
        description: String,
        image_url: String,
        attributes_json: String,
    }

    public struct MintEvent has copy, drop {
        token_id: u64,
        recipient: address,
    }

    fun init(otw: ${typeName}, ctx: &mut TxContext) {
        let publisher = package::claim(otw, ctx);
        let cap = CollectionCap {
            id: object::new(ctx),
            minted: 0,
            max_supply: ${maxSupply},
            royalty_bps: ${config.royaltyBps},
            mint_price_mist: ${config.mintPriceMist},
        };
        let mut display = display::new<NFT>(&publisher, ctx);
        display.add(string::utf8(b"name"), string::utf8(${escapeMoveBytes(config.name)}));
        display.add(string::utf8(b"symbol"), string::utf8(${escapeMoveBytes(config.symbol)}));
        display.add(string::utf8(b"description"), string::utf8(${escapeMoveBytes(config.description)}));
        display.add(string::utf8(b"image_url"), string::utf8(b""));
        display.add(string::utf8(b"project_url"), string::utf8(b""));
        display.add(string::utf8(b"creator"), string::utf8(b""));
        display.update_version(ctx);
        transfer::public_transfer(cap, tx_context::sender(ctx));
        transfer::public_transfer(publisher, tx_context::sender(ctx));
        transfer::public_transfer(display, tx_context::sender(ctx));
    }
${mintEntry}
}
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
    nftTypePlaceholder: `0x0::${moduleName}::NFT`,
    files: [
      { path: "Move.toml", content: moveToml },
      { path: `sources/${moduleName}.move`, content: moveSource },
    ],
  };
}