import type { MoveModule } from "./types";

export const MODULE_TOKENS: MoveModule = {
  id: "tokens",
  order: 12,
  title: "Tokens & NFTs",
  description: "Coins, treasury, metadata, and the Display standard.",
  accent: "#00d4aa",
  icon: "🪙",
  lessons: [
    {
      id: "tok-coin-type",
      title: "Coin<T> explained",
      duration: "12 min",
      summary: "Fungible tokens as typed coins on Sui.",
      goal: "Read Coin<MY_TOKEN> and TreasuryCap<MY_TOKEN> without confusion.",
      blocks: [
        {
          type: "prose",
          text: "A fungible token (like USDC or your game gold) must not be copyable — otherwise users could duplicate money. Sui's standard pattern wraps balance in Coin<MY_TOKEN> where MY_TOKEN is a unique type only your package created at publish. Wallets see one Coin object with a balance field.",
        },
        {
          type: "prose",
          text: "TreasuryCap<MY_TOKEN> is the mint/burn remote control. Whoever holds it can create new coins. Most teams transfer it to a multisig or destroy it after fixed mint to prove no inflation.",
        },
        {
          type: "code",
          language: "move",
          code: `use sui::coin::{Self, Coin, TreasuryCap};

// After init with create_currency:
public fun pay(
    payment: Coin<MY_TOKEN>,
    recipient: address,
    ctx: &mut TxContext,
) {
    transfer::public_transfer(payment, recipient);
}`,
        },
        {
          type: "list",
          items: [
            "Coin<T> has key + store — it is a real object.",
            "TreasuryCap<T> controls mint and burn.",
            "Metadata is frozen — name/symbol/icon are public forever.",
          ],
        },
      ],
    },
    {
      id: "tok-mint-burn",
      title: "Mint & burn",
      duration: "14 min",
      summary: "Create and destroy supply with the treasury.",
      goal: "Write mint and burn functions gated by TreasuryCap.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `public fun mint(
    treasury: &mut TreasuryCap<MY_TOKEN>,
    amount: u64,
    recipient: address,
    ctx: &mut TxContext,
) {
    let coin = coin::mint(treasury, amount, ctx);
    transfer::public_transfer(coin, recipient);
}

public fun burn(
    treasury: &mut TreasuryCap<MY_TOKEN>,
    coin: Coin<MY_TOKEN>,
) {
    coin::burn(treasury, coin);
}`,
        },
        {
          type: "tip",
          tone: "warning",
          text: "Never leave TreasuryCap in a shared object unless your protocol design requires it. Most teams transfer it to a multisig or burn mint rights.",
        },
      ],
      exercise: {
        prompt: "Add an assert that mint amount must be > 0 before calling coin::mint.",
        hint: "Use const E_ZERO_AMOUNT: u64 = 0; and assert!(amount > 0, E_ZERO_AMOUNT);",
        solution: `assert!(amount > 0, E_ZERO_AMOUNT);
let coin = coin::mint(treasury, amount, ctx);`,
      },
    },
    {
      id: "tok-split-merge",
      title: "Split & merge coins",
      duration: "10 min",
      summary: "Break one payment into exact amounts.",
      goal: "Use coin::split and coin::join in entry functions.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `let exact = coin::split(&mut payment, 100, ctx);
// payment now holds remainder; exact holds 100 units

coin::join(&mut payment, exact);
// merged back into one Coin`,
        },
        {
          type: "compare",
          badLabel: "Avoid",
          goodLabel: "Prefer",
          bad: "Transfer whole wallet coin for every small payment.",
          good: "Split exact amount, keep change in same object.",
        },
      ],
    },
    {
      id: "tok-nft-object",
      title: "NFT as an object",
      duration: "12 min",
      summary: "Unique items with key — not Coin<T>.",
      goal: "Model a one-of-one NFT struct with UID.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `public struct Hero has key, store {
    id: UID,
    name: vector<u8>,
    power: u64,
}

public fun mint_hero(
    name: vector<u8>,
    power: u64,
    recipient: address,
    ctx: &mut TxContext,
) {
    let hero = Hero {
        id: object::new(ctx),
        name,
        power,
    };
    transfer::public_transfer(hero, recipient);
}`,
        },
        {
          type: "prose",
          text: "NFTs are normal objects with key + store. Uniqueness comes from distinct object IDs, not from a special NFT type in the language.",
        },
      ],
      exercise: {
        prompt: "Add a public fun burn_hero that deletes the NFT and reclaims storage rebate.",
        hint: "Take Hero by value and call object::delete(hero.id).",
        solution: `public fun burn_hero(hero: Hero) {
    let Hero { id, name: _, power: _ } = hero;
    object::delete(id);
}`,
      },
    },
    {
      id: "tok-display",
      title: "Display standard",
      duration: "12 min",
      summary: "How wallets show name, image, and description.",
      goal: "Understand Display<T> and Publisher for NFT metadata.",
      blocks: [
        {
          type: "prose",
          text: "On-chain Display objects tell explorers and wallets how to render your type. You set fields like name, image_url, description — updated only by the Publisher.",
        },
        {
          type: "code",
          language: "move",
          code: `use sui::display;
use sui::package::Publisher;

public fun create_display(
    publisher: &Publisher,
    ctx: &mut TxContext,
) {
    let mut display = display::new<Hero>(publisher, ctx);
    display.add(b"name".to_string(), b"Aqua Knight".to_string());
    display.add(b"image_url".to_string(), b"https://...".to_string());
    display.update_version();
    transfer::public_transfer(display, tx_context::sender(ctx));
}`,
        },
        {
          type: "tip",
          tone: "info",
          text: "Display is optional but expected for consumer NFTs. Fungible tokens use frozen CoinMetadata from create_currency instead.",
        },
      ],
    },
    {
      id: "tok-kiosk",
      title: "Kiosk & trading (overview)",
      duration: "10 min",
      summary: "Official pattern for safe NFT listings.",
      goal: "Know when to use sui::kiosk instead of raw transfer.",
      blocks: [
        {
          type: "list",
          items: [
            "Kiosk — seller locks NFT; buyer purchases via kiosk rules.",
            "Transfer policy — royalties enforced on secondary sales.",
            "Beginner path: direct transfer is fine; add Kiosk when you ship a marketplace.",
          ],
        },
        {
          type: "prose",
          text: "You do not need Kiosk to learn Move. Treat it as the standard commerce layer once your collection goes public.",
        },
      ],
    },
  ],
};