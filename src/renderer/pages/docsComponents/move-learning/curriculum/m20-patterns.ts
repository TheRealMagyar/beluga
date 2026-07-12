import type { MoveModule } from "./types";

export const MODULE_PATTERNS: MoveModule = {
  id: "patterns",
  order: 20,
  title: "Move Patterns",
  description: "Hot potato, witness, one-way wrappers, and Move 2024 match.",
  accent: "#f472b6",
  icon: "🧠",
  lessons: [
    {
      id: "pat-hot-potato",
      title: "Hot potato pattern",
      duration: "14 min",
      summary: "Force a multi-step flow in one PTB.",
      goal: "Understand structs with no abilities — must be consumed.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `// No abilities — cannot be stored or dropped
public struct FlashLoanReceipt { amount: u64 }

public fun borrow(): (Coin<SUI>, FlashLoanReceipt) { ... }

public fun repay(
    coin: Coin<SUI>,
    receipt: FlashLoanReceipt,
) {
    let FlashLoanReceipt { amount } = receipt;
    assert!(coin::value(&coin) >= amount, E_SHORT);
    // consume receipt by destructure — flow complete
}`,
        },
        {
          type: "prose",
          text: "Receipt must be destroyed in same transaction — compiler enforces no drop ability.",
        },
      ],
    },
    {
      id: "pat-witness",
      title: "Witness pattern (general)",
      duration: "12 min",
      summary: "Prove type ownership once — beyond OTW coins.",
      goal: "See witness as authorization by type creation.",
      blocks: [
        {
          type: "list",
          items: [
            "OTW — coin branding at publish.",
            "Witness param — proves module instantiated type.",
            "Consumed on use — cannot replay privileged action.",
          ],
        },
      ],
    },
    {
      id: "pat-match",
      title: "match expressions (2024)",
      duration: "14 min",
      summary: "Exhaustive branching on enums.",
      goal: "Replace nested if on enum variants with match.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `public enum Status has copy, drop {
    Pending,
    Active(u64),
    Closed,
}

public fun level(s: Status): u64 {
    match (s) {
        Status::Pending => 0,
        Status::Active(n) => n,
        Status::Closed => 0,
    }
}`,
        },
      ],
    },
    {
      id: "pat-option-match",
      title: "Option & match",
      duration: "10 min",
      summary: "Safe None handling without abort.",
      goal: "Use match on Option instead of risky extract.",
      blocks: [
        {
          type: "compare",
          bad: "option::extract(&mut opt) without check — aborts on None.",
          good: `match (opt) {
    option::some(v) => v,
    option::none() => default_value,
}`,
        },
      ],
    },
    {
      id: "pat-wrapped",
      title: "Wrapped objects",
      duration: "10 min",
      summary: "Object inside object — escrow pattern.",
      goal: "Store inner object until conditions met.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `public struct Escrow<phantom T: key> has key {
    id: UID,
    item: T,
    seller: address,
}`,
        },
      ],
    },
    {
      id: "pat-deny",
      title: "DenyList & regulated coins",
      duration: "10 min",
      summary: "Compliance hooks on transfers.",
      goal: "Know regulated coin exists for institutional use.",
      blocks: [
        {
          type: "prose",
          text: "Regulated coin types integrate deny lists — blocklisted addresses cannot receive transfers. Enterprise tokens; not every project needs this.",
        },
      ],
    },
    {
      id: "pat-composability",
      title: "Composability in PTBs",
      duration: "12 min",
      summary: "Your protocol as one step in a larger tx.",
      goal: "Design public functions other devs chain.",
      blocks: [
        {
          type: "list",
          items: [
            "Return objects for next PTB command — don't force transfer.",
            "Small entry functions — easier to compose.",
            "Document expected PTB order in README.",
            "Version your package — dependents pin IDs.",
          ],
        },
      ],
    },
  ],
};