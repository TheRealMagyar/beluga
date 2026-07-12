import type { MoveModule } from "./types";

export const MODULE_EVENTS: MoveModule = {
  id: "events",
  order: 10,
  title: "Events & Errors",
  description: "Emit on-chain logs and design clear failure modes.",
  accent: "#ffb347",
  icon: "📡",
  lessons: [
    {
      id: "evt-emit",
      title: "Emitting events",
      duration: "12 min",
      summary: "Struct + emit = indexer-friendly logs.",
      goal: "Emit an event when state changes.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `use sui::event;

public struct ItemPurchased has copy, drop {
    buyer: address,
    item_id: u64,
    price: u64,
}

public fun buy(...) {
    event::emit(ItemPurchased {
        buyer: sender,
        item_id: 1,
        price: 100,
    });
}`,
        },
        {
          type: "prose",
          text: "event::emit takes a struct instance. That struct is not saved as chain state — it is written to the transaction's event log. Wallets do not hold events as objects; indexers and GraphQL subscribers read them to update UIs in real time.",
        },
        {
          type: "tip",
          tone: "info",
          text: "Events are not stored as objects — they're cheap logs for indexers and frontends. Emit on every user-visible state change you want a website to track.",
        },
      ],
    },
    {
      id: "evt-design",
      title: "Designing good events",
      duration: "8 min",
      summary: "What to include for off-chain apps.",
      goal: "Emit enough data to rebuild UI state.",
      blocks: [
        {
          type: "list",
          items: [
            "Include actor (who), action (what), entity ids.",
            "Use copy + drop on event structs.",
            "Don't emit secrets — events are public.",
          ],
        },
      ],
    },
    {
      id: "err-codes",
      title: "Error code constants",
      duration: "10 min",
      summary: "Numbered abort reasons per module.",
      goal: "Maintain a clear E_* constant table.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `const E_NOT_OWNER: u64 = 0;
const E_SOLD_OUT: u64 = 1;
const E_BAD_PRICE: u64 = 2;

assert!(stock > 0, E_SOLD_OUT);`,
        },
      ],
    },
    {
      id: "err-custom",
      title: "Custom error types (2024)",
      duration: "10 min",
      summary: "Named errors instead of bare numbers.",
      goal: "Read modern Move packages using error enums.",
      blocks: [
        {
          type: "prose",
          text: "Move 2024 edition supports richer error reporting. Many new Sui packages use error enums for self-documenting aborts. Legacy numeric codes still work everywhere.",
        },
      ],
    },
    {
      id: "err-guards",
      title: "Authorization guards",
      duration: "12 min",
      summary: "Cap pattern — only holder can admin.",
      goal: "Check AdminCap before sensitive ops.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `public struct AdminCap has key, store {
    id: UID,
}

public fun set_fee(_: &AdminCap, pool: &mut Pool, fee: u64) {
    pool.fee = fee;
}`,
        },
      ],
    },
    {
      id: "evt-indexer",
      title: "Events for indexers",
      duration: "10 min",
      summary: "How off-chain apps subscribe to your emits.",
      goal: "Design events that rebuild state without scanning all objects.",
      blocks: [
        {
          type: "prose",
          text: "Indexers listen to event streams filtered by package ID and event type. Include timestamps (epoch), actor, and entity IDs so a frontend can update in real time.",
        },
        {
          type: "code",
          language: "move",
          code: `public struct ListingCreated has copy, drop {
    listing_id: ID,
    seller: address,
    price: u64,
    created_at: u64,  // tx_context::epoch(ctx)
}`,
        },
      ],
    },
    {
      id: "err-patterns",
      title: "Fail fast vs early return",
      duration: "10 min",
      summary: "Guard clauses at the top of functions.",
      goal: "Write readable validation before main logic.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `public fun buy(stock: &mut u64, price: u64, paid: u64) {
    assert!(*stock > 0, E_SOLD_OUT);
    assert!(paid >= price, E_BAD_PRICE);
    *stock = *stock - 1;
}`,
        },
        {
          type: "tip",
          tone: "success",
          text: "Validate inputs first, then mutate state. Easier to audit and matches how auditors read Move.",
        },
      ],
      exercise: {
        prompt: "Add assert!(fee <= 10_000, E_FEE_TOO_HIGH) before setting pool.fee.",
        hint: "Define const E_FEE_TOO_HIGH: u64 = 3; at module level.",
        solution: `const E_FEE_TOO_HIGH: u64 = 3;
assert!(fee <= 10_000, E_FEE_TOO_HIGH);
pool.fee = fee;`,
      },
    },
  ],
};