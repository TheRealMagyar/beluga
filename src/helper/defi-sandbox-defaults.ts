import type { PlaygroundFile } from "../renderer/pages/playgroundComponents/types";

export const DEFI_SANDBOX_PACKAGE_NAME = "beluga_defi";

export const DEFI_SANDBOX_FILES: PlaygroundFile[] = [
  {
    id: "defi-move-toml",
    name: "Move.toml",
    path: "Move.toml",
    language: "toml",
    content: `[package]
name = "${DEFI_SANDBOX_PACKAGE_NAME}"
edition = "2024.beta"

[dependencies]
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "framework/testnet" }

[addresses]
${DEFI_SANDBOX_PACKAGE_NAME} = "0x0"
`,
  },
  {
    id: "defi-token-a",
    name: "token_a.move",
    path: "sources/token_a.move",
    language: "rust",
    content: `module ${DEFI_SANDBOX_PACKAGE_NAME}::token_a {
    use std::option;
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::TxContext;

    public struct TOKEN_A has drop {}

    public struct TokenAFaucet has key {
        id: UID,
        treasury: TreasuryCap<TOKEN_A>,
    }

    fun init(witness: TOKEN_A, ctx: &mut TxContext) {
        let (treasury, metadata) = coin::create_currency(
            witness,
            9,
            b"TA",
            b"Token A",
            b"Beluga DeFi sandbox token A",
            option::none(),
            ctx,
        );
        transfer::public_transfer(metadata, ctx.sender());
        transfer::share_object(TokenAFaucet {
            id: object::new(ctx),
            treasury,
        });
    }

    entry fun mint(faucet: &mut TokenAFaucet, amount: u64, ctx: &mut TxContext) {
        let coin = coin::mint(&mut faucet.treasury, amount, ctx);
        transfer::public_transfer(coin, ctx.sender());
    }
}
`,
  },
  {
    id: "defi-token-b",
    name: "token_b.move",
    path: "sources/token_b.move",
    language: "rust",
    content: `module ${DEFI_SANDBOX_PACKAGE_NAME}::token_b {
    use std::option;
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::TxContext;

    public struct TOKEN_B has drop {}

    public struct TokenBFaucet has key {
        id: UID,
        treasury: TreasuryCap<TOKEN_B>,
    }

    fun init(witness: TOKEN_B, ctx: &mut TxContext) {
        let (treasury, metadata) = coin::create_currency(
            witness,
            9,
            b"TB",
            b"Token B",
            b"Beluga DeFi sandbox token B",
            option::none(),
            ctx,
        );
        transfer::public_transfer(metadata, ctx.sender());
        transfer::share_object(TokenBFaucet {
            id: object::new(ctx),
            treasury,
        });
    }

    entry fun mint(faucet: &mut TokenBFaucet, amount: u64, ctx: &mut TxContext) {
        let coin = coin::mint(&mut faucet.treasury, amount, ctx);
        transfer::public_transfer(coin, ctx.sender());
    }
}
`,
  },
  {
    id: "defi-pool",
    name: "pool.move",
    path: "sources/pool.move",
    language: "rust",
    content: `module ${DEFI_SANDBOX_PACKAGE_NAME}::pool {
    use sui::balance::{Self, Balance};
    use sui::coin::{Self, Coin};
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::TxContext;

    const FEE_BPS: u64 = 30;

    fun swap_output(amount_in: u64, reserve_in: u64, reserve_out: u64): u64 {
        let amount_in_after_fee =
            (amount_in as u128) * ((10000 - FEE_BPS) as u128) / 10000;
        let numerator = amount_in_after_fee * (reserve_out as u128);
        let denominator = (reserve_in as u128) + amount_in_after_fee;
        (numerator / denominator) as u64
    }

    public struct Pool<phantom CoinA, phantom CoinB> has key {
        id: UID,
        reserve_a: Balance<CoinA>,
        reserve_b: Balance<CoinB>,
    }

    entry fun create_pool<CoinA, CoinB>(ctx: &mut TxContext) {
        transfer::share_object(Pool<CoinA, CoinB> {
            id: object::new(ctx),
            reserve_a: balance::zero(),
            reserve_b: balance::zero(),
        });
    }

    entry fun add_liquidity<CoinA, CoinB>(
        pool: &mut Pool<CoinA, CoinB>,
        coin_a: Coin<CoinA>,
        coin_b: Coin<CoinB>,
    ) {
        balance::join(&mut pool.reserve_a, coin::into_balance(coin_a));
        balance::join(&mut pool.reserve_b, coin::into_balance(coin_b));
    }

    entry fun swap_a_for_b<CoinA, CoinB>(
        pool: &mut Pool<CoinA, CoinB>,
        coin_a: Coin<CoinA>,
        min_out: u64,
        ctx: &mut TxContext,
    ) {
        let amount_in = coin::value(&coin_a);
        let reserve_a = balance::value(&pool.reserve_a);
        let reserve_b = balance::value(&pool.reserve_b);
        assert!(reserve_a > 0 && reserve_b > 0, 0);

        let out = swap_output(amount_in, reserve_a, reserve_b);
        assert!(out >= min_out, 1);
        assert!(out <= reserve_b, 2);

        balance::join(&mut pool.reserve_a, coin::into_balance(coin_a));
        let out_coin = coin::take(&mut pool.reserve_b, out, ctx);
        transfer::public_transfer(out_coin, ctx.sender());
    }

    entry fun swap_b_for_a<CoinA, CoinB>(
        pool: &mut Pool<CoinA, CoinB>,
        coin_b: Coin<CoinB>,
        min_out: u64,
        ctx: &mut TxContext,
    ) {
        let amount_in = coin::value(&coin_b);
        let reserve_a = balance::value(&pool.reserve_a);
        let reserve_b = balance::value(&pool.reserve_b);
        assert!(reserve_a > 0 && reserve_b > 0, 0);

        let out = swap_output(amount_in, reserve_b, reserve_a);
        assert!(out >= min_out, 1);
        assert!(out <= reserve_a, 2);

        balance::join(&mut pool.reserve_b, coin::into_balance(coin_b));
        let out_coin = coin::take(&mut pool.reserve_a, out, ctx);
        transfer::public_transfer(out_coin, ctx.sender());
    }

    public fun reserve_a_value<CoinA, CoinB>(pool: &Pool<CoinA, CoinB>): u64 {
        balance::value(&pool.reserve_a)
    }

    public fun reserve_b_value<CoinA, CoinB>(pool: &Pool<CoinA, CoinB>): u64 {
        balance::value(&pool.reserve_b)
    }
}
`,
  },
];