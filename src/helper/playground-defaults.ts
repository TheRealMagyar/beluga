export interface PlaygroundFile {
  id: string;
  name: string;
  path: string;
  language: string;
  content: string;
}

export const DEFAULT_PLAYGROUND_FILES: PlaygroundFile[] = [
  {
    id: "move-toml",
    name: "Move.toml",
    path: "Move.toml",
    language: "toml",
    content: `[package]
name = "counter"
edition = "2024.beta"

[dependencies]
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "framework/testnet" }

[addresses]
counter = "0x0"
`,
  },
  {
    id: "counter-move",
    name: "counter.move",
    path: "sources/counter.move",
    language: "rust",
    content: `module counter::counter {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::TxContext;

    public struct Counter has key {
        id: UID,
        value: u64,
    }

    entry fun create(ctx: &mut TxContext) {
        transfer::transfer(
            Counter {
                id: object::new(ctx),
                value: 0,
            },
            ctx.sender(),
        );
    }

    entry fun increment(counter: &mut Counter) {
        counter.value = counter.value + 1;
    }
}
`,
  },
];

export const PLAYGROUND_STORAGE_KEY = "beluga-playground-state-v1";