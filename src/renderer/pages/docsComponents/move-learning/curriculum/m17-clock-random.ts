import type { MoveModule } from "./types";

export const MODULE_CLOCK: MoveModule = {
  id: "clock",
  order: 17,
  title: "Clock & Randomness",
  description: "On-chain time, epochs, and verifiable random.",
  accent: "#fbbf24",
  icon: "⏱️",
  lessons: [
    {
      id: "clk-epoch",
      title: "Epoch & tx_context",
      duration: "10 min",
      summary: "Time on Sui is epoch-based, not block timestamps in Move.",
      goal: "Use tx_context::epoch for time gates.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `let now = tx_context::epoch(ctx);
assert!(now >= sale_starts_at, E_TOO_EARLY);`,
        },
        {
          type: "prose",
          text: "Epoch advances on network schedule (~24h on mainnet). Fine for sales, staking epochs, cooldowns — not millisecond precision.",
        },
      ],
    },
    {
      id: "clk-shared",
      title: "Shared Clock object",
      duration: "12 min",
      summary: "sui::clock for millisecond timestamps.",
      goal: "Read clock::timestamp_ms for deadlines.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `use sui::clock::{Self, Clock};

public fun is_expired(clock: &Clock, deadline_ms: u64): bool {
    clock::timestamp_ms(clock) > deadline_ms
}`,
        },
        {
          type: "tip",
          tone: "info",
          text: "Clock is a shared system object — pass &Clock into entry functions from PTB.",
        },
      ],
    },
    {
      id: "clk-cooldowns",
      title: "Cooldown patterns",
      duration: "10 min",
      summary: "Store last_action_at on your struct.",
      goal: "Implement rate limits with epoch or ms.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `public struct ActionLog has key {
    id: UID,
    last_epoch: u64,
}

public fun act(log: &mut ActionLog, ctx: &TxContext) {
    let e = tx_context::epoch(ctx);
    assert!(e > log.last_epoch, E_COOLDOWN);
    log.last_epoch = e;
}`,
        },
      ],
    },
    {
      id: "rnd-intro",
      title: "Randomness on-chain",
      duration: "12 min",
      summary: "Why you cannot use pseudo-random from blockhash in Move.",
      goal: "Know when to use sui::random.",
      blocks: [
        {
          type: "prose",
          text: "Validators must agree on execution — secret entropy in your module would be exploitable. Sui provides a shared Random object generating verifiable random bytes per epoch/round.",
        },
      ],
    },
    {
      id: "rnd-usage",
      title: "Using sui::random",
      duration: "14 min",
      summary: "Lotteries and fair mints with protocol RNG.",
      goal: "Read random API — pass Random in entry PTB.",
      blocks: [
        {
          type: "list",
          items: [
            "Random is a shared object — must be in transaction inputs.",
            "Generate u64 or bytes in a defined range.",
            "Never roll your own hash-based RNG for value distribution.",
            "Document odds — users trust protocol random, not your math.",
          ],
        },
      ],
    },
  ],
};