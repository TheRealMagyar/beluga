import type { MoveModule } from "./types";

export const MODULE_OWNERSHIP: MoveModule = {
  id: "ownership",
  order: 6,
  title: "Ownership",
  description: "Move's superpower — no accidental copies of valuable data.",
  accent: "#ff6b9d",
  icon: "🔐",
  lessons: [
    {
      id: "own-rule",
      title: "The golden rule",
      duration: "10 min",
      summary: "Each value has one owner. Assigning moves, it does not copy.",
      goal: "Predict when a variable is still valid after assignment.",
      blocks: [
        {
          type: "prose",
          text: "Ownership is Move's core idea: every value has exactly one owner at a time. If a type does not have the copy ability, you cannot duplicate it — when you assign let t2 = t or pass t to a function, t is moved and the old name is dead. The compiler rejects use of moved values at compile time.",
        },
        {
          type: "prose",
          text: "Why this matters on a blockchain: if coins could be copied like integers, you could spend the same coin twice. Move prevents that by default. Tokens are structs without copy — moving them into transfer::transfer is the only way to hand them off.",
        },
        {
          type: "code",
          language: "move",
          code: `public struct Ticket has store { id: u64 }

public fun transfer_ticket(t: Ticket) {
    let t2 = t;  // MOVE — t is no longer valid here
    let _ = t2;
    // let _ = t;  // ERROR: use of moved value
}`,
        },
        {
          type: "tip",
          tone: "success",
          text: "This is why tokens cannot be double-spent in Move — the type system makes copying impossible unless you explicitly added copy (which coins do not).",
        },
      ],
    },
    {
      id: "own-references",
      title: "Borrowing with & and &mut",
      duration: "12 min",
      summary: "Read or modify without taking ownership.",
      goal: "Use references in function parameters.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `public struct Counter has store { value: u64 }

public fun read(c: &Counter): u64 {
    c.value
}

public fun increment(c: &mut Counter) {
    c.value = c.value + 1;
}`,
        },
        {
          type: "prose",
          text: "Borrowing lets you read or change data without taking ownership. &Counter means \"I need to look at this counter but the caller keeps owning it.\" &mut Counter means \"I need to change it; no one else can borrow it mutably or move it until I'm done.\"",
        },
        {
          type: "list",
          items: [
            "&T — read-only borrow. Many &T allowed at once.",
            "&mut T — exclusive mutable borrow — at most one, and no &T while &mut exists.",
            "You cannot transfer::transfer(obj) while &mut obj is active — borrow must end first.",
          ],
        },
      ],
    },
    {
      id: "own-return",
      title: "Returning owned values",
      duration: "8 min",
      summary: "Pass ownership out of a function.",
      goal: "Return constructed values to the caller.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `public fun make_ticket(id: u64): Ticket {
    Ticket { id }
}

public fun pipeline(): Ticket {
    let t = make_ticket(1);
    t  // ownership goes to caller
}`,
        },
      ],
    },
    {
      id: "own-copy-drop",
      title: "copy vs drop in practice",
      duration: "10 min",
      summary: "When values duplicate freely vs must be explicitly destroyed.",
      goal: "Explain why Coin cannot be copied.",
      blocks: [
        {
          type: "prose",
          text: "Abilities copy and drop describe what happens at the end of a scope or on assignment. copy means bitwise duplicate is allowed. drop means the value can be destroyed automatically when unused. Most valuable assets have store but not copy — they must be explicitly moved or deleted.",
        },
        {
          type: "list",
          items: [
            "copy — let b = a; leaves both a and b valid (only if type has copy).",
            "drop — when binding ends, value is cleaned up without you writing delete code.",
            "Without drop — you must destructure, transfer, or object::delete every field.",
            "Coins intentionally lack copy — prevents double-spend at the type level.",
          ],
        },
      ],
    },
    {
      id: "own-borrow-checker",
      title: "Borrow checker errors",
      duration: "10 min",
      summary: "Why the compiler rejects your reference.",
      goal: "Fix 'cannot borrow' and 'use of moved value'.",
      blocks: [
        {
          type: "compare",
          bad: `let x = obj;
let r = &mut x;
transfer::transfer(x, addr); // ERROR: x moved while borrowed`,
          good: `let r = &mut obj;
*r.value = 1;
transfer::transfer(obj, addr); // borrow ended`,
        },
      ],
    },
    {
      id: "own-storage",
      title: "store and nested ownership",
      duration: "8 min",
      summary: "Putting structs inside other structs on-chain.",
      goal: "Know which inner types need store.",
      blocks: [
        {
          type: "prose",
          text: "If struct Inventory stores a Sword inside on-chain, Sword needs store — otherwise it cannot live in another object's field. Nested objects are common: a game character (key object) holds equipment (store types) in its fields. Partial move: let Profile { name, score: _ } = profile; moves name out and consumes profile.",
        },
        {
          type: "prose",
          text: "You cannot return & to a local variable created inside the function — it would outlive the data. Returning & to a field of an input &mut Object is OK because the object outlives the function call.",
        },
      ],
    },
  ],
};