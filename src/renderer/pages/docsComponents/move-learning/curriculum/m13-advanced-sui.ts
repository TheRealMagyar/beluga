import type { MoveModule } from "./types";

export const MODULE_ADVANCED: MoveModule = {
  id: "advanced",
  order: 13,
  title: "Dynamic Fields & PTBs",
  description: "Attach data to objects, batch calls, and common pitfalls.",
  accent: "#ff6b9d",
  icon: "🧩",
  lessons: [
    {
      id: "adv-df-intro",
      title: "Dynamic fields",
      duration: "14 min",
      summary: "Key-value storage hanging off any object.",
      goal: "Add and read a dynamic field on a parent object.",
      blocks: [
        {
          type: "prose",
          text: "Imagine a Shelf object on-chain. You want to attach Item A, Item B, later Item C — without redesigning the Shelf struct every time. Dynamic fields hang extra key→value pairs off the shelf's id. The parent object ID stays the same; explorers show attached fields separately.",
        },
        {
          type: "prose",
          text: "Keys must be copy+drop+store (e.g. u64, vector<u8>). Values must have store. You add with df::add, read with df::borrow, remove with df::remove. Wrong key on remove aborts — same discipline as assert guards elsewhere.",
        },
        {
          type: "code",
          language: "move",
          code: `use sui::dynamic_field as df;

public struct Shelf has key {
    id: UID,
}

public struct Item has store {
    label: vector<u8>,
}

public fun put_item(shelf: &mut Shelf, key: u64, item: Item) {
    df::add(&mut shelf.id, key, item);
}

public fun take_item(shelf: &mut Shelf, key: u64): Item {
    df::remove(&mut shelf.id, key)
}`,
        },
        {
          type: "tip",
          tone: "info",
          text: "Keys must be copy + drop + store. Values must have store. Parent must be mutably borrowed.",
        },
      ],
      exercise: {
        prompt: "Write borrow_item that returns &Item for key without removing it.",
        hint: "Use df::borrow(&shelf.id, key).",
        solution: `public fun borrow_item(shelf: &Shelf, key: u64): &Item {
    df::borrow(&shelf.id, key)
}`,
      },
    },
    {
      id: "adv-df-object",
      title: "Dynamic object fields",
      duration: "12 min",
      summary: "Attach child objects that keep their own ID.",
      goal: "Tell dynamic_field apart from dynamic_object_field.",
      blocks: [
        {
          type: "compare",
          badLabel: "dynamic_field",
          goodLabel: "dynamic_object_field",
          bad: "Value is stored inside parent — no separate object ID.",
          good: "Child is a full object — own ID, transferable later.",
        },
        {
          type: "code",
          language: "move",
          code: `use sui::dynamic_object_field as dof;

public struct Pet has key, store {
    id: UID,
    name: vector<u8>,
}

public fun adopt(
    owner: &mut Character,
    pet: Pet,
) {
    dof::add(&mut owner.id, b"pet", pet);
}`,
        },
      ],
    },
    {
      id: "adv-table-bag",
      title: "Table, Bag, TableVec",
      duration: "12 min",
      summary: "Collections built on dynamic fields.",
      goal: "Pick the right std collection for your use case.",
      blocks: [
        {
          type: "list",
          items: [
            "Table<K,V> — typed map; destroy empty when done.",
            "Bag — heterogeneous values; keys are IDs.",
            "TableVec — vector-like growth without shifting cost.",
            "ObjectTable — like Table but values are objects.",
          ],
        },
        {
          type: "code",
          language: "move",
          code: `use sui::table::{Self, Table};

public struct Registry has key {
    id: UID,
    members: Table<address, u64>,
}

public fun register(reg: &mut Registry, who: address, score: u64) {
    table::add(&mut reg.members, who, score);
}`,
        },
      ],
    },
    {
      id: "adv-ptb",
      title: "Programmable transactions",
      duration: "14 min",
      summary: "Many Move calls in one atomic transaction.",
      goal: "Read a PTB from the client side and know what Move must allow.",
      blocks: [
        {
          type: "prose",
          text: "A Programmable Transaction Block (PTB) chains multiple commands: split coin, call function A, call function B, transfer result. All succeed or all revert — no half-done state.",
        },
        {
          type: "steps",
          steps: [
            {
              title: "Client builds command list",
              body: "TypeScript SDK: tx.moveCall({ target, arguments }).",
            },
            {
              title: "Objects passed by reference",
              body: "Shared objects and owned inputs are arguments to each call.",
            },
            {
              title: "Return values flow forward",
              body: "Result of call 1 can feed call 2 in the same PTB.",
            },
          ],
        },
        {
          type: "tip",
          tone: "success",
          text: "Design entry functions that compose — small, pure steps chain well in PTBs. One giant function is harder to reuse.",
        },
      ],
    },
    {
      id: "adv-security",
      title: "Security checklist",
      duration: "14 min",
      summary: "Mistakes that cost real money.",
      goal: "Review new modules against this list before publish.",
      blocks: [
        {
          type: "list",
          items: [
            "Check tx_context::sender for authorization — not a passed address alone.",
            "Caps (Admin, Treasury) should not sit in shared objects without reason.",
            "Verify coin amounts and object IDs before transfer.",
            "Use assert! with named E_* codes — easier to debug aborts.",
            "Freeze or destroy metadata you do not want upgraded.",
            "Test with test_scenario before mainnet.",
          ],
        },
        {
          type: "compare",
          badLabel: "Vulnerable",
          goodLabel: "Safe",
          bad: `public entry fun admin_set(caller: address, ...) {
    // trusts client-supplied address`,
          good: `public entry fun admin_set(ctx: &TxContext, ...) {
    assert!(tx_context::sender(ctx) == admin, E_NOT_ADMIN);`,
        },
      ],
      exercise: {
        prompt: "List three things you would check before transferring an AdminCap to a new address.",
        hint: "Think: typos, multisig, two-step accept.",
        solution: `1. Confirm recipient address on-chain (not just clipboard).
2. Prefer multisig or two-step propose/accept.
3. Document who holds the cap in project Memory.`,
      },
    },
    {
      id: "adv-versioning",
      title: "Package upgrades",
      duration: "10 min",
      summary: "Fix bugs after publish without breaking users.",
      goal: "Understand compatible upgrade policy and migration.",
      blocks: [
        {
          type: "prose",
          text: "Compatible upgrades can add functions and fix logic but cannot change existing public function signatures or struct layouts. Plan versioning early — users may hold old objects forever.",
        },
        {
          type: "list",
          items: [
            "Keep UpgradeCap in a secure wallet.",
            "Add new struct versions instead of mutating old ones.",
            "Emit migration events so indexers track upgrades.",
            "Immutable publish when code must never change.",
          ],
        },
      ],
    },
  ],
};