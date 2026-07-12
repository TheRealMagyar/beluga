import type { MoveModule } from "./types";

export const MODULE_CAPSTONE: MoveModule = {
  id: "capstone",
  order: 14,
  title: "Build & Ship",
  description: "Coins, tests, and publishing — tie everything together.",
  accent: "#4ca3ff",
  icon: "🏁",
  lessons: [
    {
      id: "cap-coins",
      title: "Coins in one lesson",
      duration: "12 min",
      summary: "Coin<T>, treasury, and why tokens feel different from structs.",
      goal: "Read coin code without panic.",
      blocks: [
        {
          type: "prose",
          text: "Sui's coin framework standardizes fungible tokens. Coin<SUI> is native gas. Your token uses a one-time witness type MY_TOKEN and coin::create_currency at publish.",
        },
        {
          type: "code",
          language: "move",
          code: `use sui::coin::{Self, Coin, TreasuryCap};

// MY_TOKEN is a one-time witness struct — minted once at module init
public fun mint_coin(
    cap: &mut TreasuryCap<MY_TOKEN>,
    amount: u64,
    ctx: &mut TxContext,
): Coin<MY_TOKEN> {
    coin::mint(cap, amount, ctx)
}`,
        },
        {
          type: "tip",
          tone: "info",
          text: "Deep dive on tokens comes after this course. For now: Coin is a special object wrapping a balance.",
        },
      ],
    },
    {
      id: "cap-full-counter",
      title: "Full counter package",
      duration: "15 min",
      summary: "Every concept in one file — your graduation project.",
      goal: "Read a complete minimal Sui package top to bottom.",
      blocks: [
        {
          type: "prose",
          text: "This is the smallest useful Sui package: one object type, three user actions. Read it slowly — every line maps to something you learned. If any line feels mysterious, jump back to that module's lesson before continuing.",
        },
        {
          type: "code",
          language: "move",
          code: `module my_package::counter;

use sui::object::{Self, UID};
use sui::transfer;
use sui::tx_context::{Self, TxContext};

public struct Counter has key {
    id: UID,
    value: u64,
}

const E_OVERFLOW: u64 = 0;

public entry fun create(ctx: &mut TxContext) {
    transfer::transfer(
        Counter { id: object::new(ctx), value: 0 },
        tx_context::sender(ctx),
    );
}

public entry fun increment(counter: &mut Counter) {
    assert!(counter.value < 18446744073709551615, E_OVERFLOW);
    counter.value = counter.value + 1;
}

public entry fun value(counter: &Counter): u64 {
    counter.value
}`,
        },
        {
          type: "steps",
          steps: [
            {
              title: "Module & imports",
              body: "module line matches Move.toml. use brings object::new, transfer, sender into scope.",
            },
            {
              title: "Struct with key",
              body: "Counter has key + UID — it can live on-chain as its own object with a unique ID.",
            },
            {
              title: "create entry",
              body: "Mints a new Counter, transfers ownership to whoever signed the tx (sender).",
            },
            {
              title: "increment entry",
              body: "Takes &mut Counter from wallet — only owner can pass their object. assert! prevents overflow.",
            },
            {
              title: "value",
              body: "Read-only &Counter — returns u64 without changing state. (Often used in view calls / off-chain simulation.)",
            },
          ],
        },
        {
          type: "prose",
          text: "Notice there is no global variable. All state lives inside Counter objects. One user can own many counters; each has its own value field. That is the object model in one file.",
        },
      ],
    },
    {
      id: "cap-test",
      title: "Testing your code",
      duration: "12 min",
      summary: "#[test] and test_scenario — prove it works before publish.",
      goal: "Run sui move test successfully.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `#[test_only]
use sui::test_scenario;

#[test]
fun test_increment_logic() {
    // Unit tests for pure functions go here.
    assert!(2 + 3 == 5, 0);
}`,
        },
        {
          type: "prose",
          text: "test_scenario simulates transactions with fake addresses — use it for entry functions that create objects. Run sui move test from the package root or use Playground's build.",
        },
      ],
    },
    {
      id: "cap-publish",
      title: "Publish with Beluga",
      duration: "10 min",
      summary: "From learning to live on localnet.",
      goal: "Know the exact next steps after finishing this course.",
      blocks: [
        {
          type: "steps",
          steps: [
            {
              title: "Create a Playground project",
              body: "Projects → open in Playground, or start from a template.",
            },
            {
              title: "Paste the counter example",
              body: "Replace sources/ content; fix package name in module line.",
            },
            {
              title: "Build",
              body: "Fix compiler errors using lesson notes — one at a time.",
            },
            {
              title: "Start localnet & faucet",
              body: "Wallet on localnet; request SUI from faucet.",
            },
            {
              title: "Publish",
              body: "Playground publish button — save the package ID via Memory remember().",
            },
          ],
        },
        {
          type: "tip",
          tone: "success",
          text: "You went from zero to a publishable package. Link the sui-move-reviewer skill in Projects for AI-assisted code review.",
        },
      ],
    },
    {
      id: "cap-next",
      title: "Where to go next",
      duration: "5 min",
      summary: "Topics after this course.",
      goal: "Pick your own adventure with a clear map.",
      blocks: [
        {
          type: "list",
          items: [
            "Revisit Modules 9–13 if you skipped ahead — imports, events, caps, tokens, PTBs.",
            "Walrus — store blobs; link walrus-skills in Projects for storage patterns.",
            "Deepen testing — test_scenario for multi-step entry flows.",
            "Official book: docs.sui.io/concepts/sui-move-concepts",
            "Sui Move by Example: examples.sui.io",
          ],
        },
      ],
    },
    {
      id: "cap-debug",
      title: "Debugging failed transactions",
      duration: "10 min",
      summary: "Simulate, read abort code, check object ownership.",
      goal: "Diagnose a failed publish or entry call.",
      blocks: [
        {
          type: "steps",
          steps: [
            { title: "Simulate first", body: "Playground and sui client dry-run show abort location." },
            { title: "Check abort code", body: "Match const E_* in your module." },
            { title: "Verify object owner", body: "Wrong owner = object not found in tx." },
          ],
        },
      ],
    },
  ],
};