import type { MoveModule } from "./types";

export const MODULE_OBJECTS: MoveModule = {
  id: "objects",
  order: 7,
  title: "Sui Objects",
  description: "Put data on-chain — create, transfer, share.",
  accent: "#00d4aa",
  icon: "⬡",
  lessons: [
    {
      id: "obj-what",
      title: "What is an on-chain object?",
      duration: "10 min",
      summary: "Live data with an ID, owner, and type — the heart of Sui.",
      goal: "Explain objects to someone who only knows variables so far.",
      blocks: [
        {
          type: "prose",
          text: "Until now, values existed only while a transaction ran. An on-chain object persists after the transaction ends. It has a unique object ID, a type (e.g. 0x...::counter::Counter), and an owner or sharing status. Wallets list owned objects; explorers show shared ones; your entry functions receive them as transaction inputs.",
        },
        {
          type: "prose",
          text: "Creating an object costs storage deposit (SUI locked; partly refunded on delete). That is why protocols think about object count — each live object is real on-chain state validators store.",
        },
        {
          type: "list",
          items: [
            "Owned — one address holds it (default after transfer).",
            "Shared — anyone can interact per your module rules.",
            "Immutable — frozen forever, read-only.",
          ],
        },
      ],
    },
    {
      id: "obj-create",
      title: "Creating your first object",
      duration: "14 min",
      summary: "UID, object::new, and transfer to the sender.",
      goal: "Write an entry function that mints an object to the user.",
      blocks: [
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

public entry fun create(ctx: &mut TxContext) {
    let counter = Counter {
        id: object::new(ctx),
        value: 0,
    };
    transfer::transfer(counter, tx_context::sender(ctx));
}`,
        },
        {
          type: "steps",
          steps: [
            {
              title: "key + UID",
              body: "Every chain object needs has key and id: UID as the first field.",
            },
            {
              title: "object::new(ctx)",
              body: "Creates a fresh unique ID using the transaction context.",
            },
            {
              title: "transfer::transfer",
              body: "Sends owned object to an address — here, the person signing the tx. After this, only the recipient can pass the object into their transactions.",
            },
          ],
        },
        {
          type: "prose",
          text: "has key on Counter tells Move this struct can become a Sui object. id: UID must be the first field — it holds the on-chain identity. object::new(ctx) asks Sui for a fresh ID that no other object uses. Without transfer, the object would be dropped at end of tx (if it has drop) or be a compile error (if not).",
        },
      ],
      exercise: {
        prompt: "Add public entry fun increment(counter: &mut Counter) { ... }",
        hint: "Use counter.value = counter.value + 1;",
      },
    },
    {
      id: "obj-mutate",
      title: "Mutating objects in transactions",
      duration: "10 min",
      summary: "Pass &mut Counter from the wallet into your entry function.",
      goal: "Understand how users pass existing objects back in.",
      blocks: [
        {
          type: "prose",
          text: "When a user calls increment, their wallet selects the Counter object they own. The runtime passes it as &mut Counter. Your code mutates it; changes persist on-chain after the transaction succeeds.",
        },
        {
          type: "code",
          language: "move",
          code: `public entry fun increment(counter: &mut Counter) {
    counter.value = counter.value + 1;
}

public entry fun read(counter: &Counter): u64 {
    counter.value
}`,
        },
      ],
    },
    {
      id: "obj-shared",
      title: "Shared objects",
      duration: "10 min",
      summary: "Global state many users can access.",
      goal: "Know when share_object is appropriate.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `public entry fun create_shared_pool(ctx: &mut TxContext) {
    let pool = Pool {
        id: object::new(ctx),
        total: 0,
    };
    transfer::share_object(pool);
}`,
        },
        {
          type: "tip",
          tone: "warning",
          text: "Shared objects serialize writes — more contention and gas. Use for true global coordination (DEX pool), not for per-user data.",
        },
      ],
    },
    {
      id: "obj-delete",
      title: "Deleting objects",
      duration: "8 min",
      summary: "object::delete and when objects can be removed.",
      goal: "Clean up deletable objects properly.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `use sui::object;

public entry fun burn(counter: Counter) {
    let Counter { id, value: _ } = counter;
    object::delete(id);
}`,
        },
        {
          type: "prose",
          text: "Only deletable blobs/objects can be deleted. Permanent objects cannot — design lifecycle at creation time.",
        },
      ],
    },
    {
      id: "obj-freeze",
      title: "Immutable objects",
      duration: "8 min",
      summary: "freeze_object — nobody can mutate ever.",
      goal: "Publish read-only config on-chain.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `public entry fun freeze_config(cfg: Config) {
    transfer::freeze_object(cfg);
}`,
        },
      ],
    },
    {
      id: "obj-ids",
      title: "Object ID vs UID vs digest",
      duration: "10 min",
      summary: "Three identifiers beginners confuse.",
      goal: "Use the right ID in RPC, explorers, and Move.",
      blocks: [
        {
          type: "list",
          items: [
            "UID — internal Move wrapper around object ID, used in structs.",
            "Object ID — 0x... hex, used in wallets and RPC queries.",
            "Transaction digest — hash of one tx, not an object.",
          ],
        },
      ],
    },
    {
      id: "obj-transfer-types",
      title: "transfer variants",
      duration: "10 min",
      summary: "transfer, public_transfer, share_object, freeze_object.",
      goal: "Pick the right transfer function.",
      blocks: [
        {
          type: "list",
          items: [
            "transfer — same-module owned objects with key+store.",
            "public_transfer — public objects (e.g. Coin) to any address.",
            "share_object — global shared state.",
            "freeze_object — immutable forever.",
          ],
        },
      ],
    },
    {
      id: "obj-receive",
      title: "Receiving objects in PTBs",
      duration: "10 min",
      summary: "How wallets pass your existing object into entry functions.",
      goal: "Understand transaction arguments from a user perspective.",
      blocks: [
        {
          type: "prose",
          text: "From the user's perspective: they see Counter in the wallet, click \"Increment,\" and the wallet builds a transaction that lists your package's increment function and attaches their Counter object as &mut. They sign; validators run your code; the object's value field updates on-chain. They never paste object IDs manually — the wallet handles it.",
        },
        {
          type: "steps",
          steps: [
            { title: "User owns Counter", body: "Shown in wallet as an object with ID and type." },
            { title: "Calls increment", body: "Wallet attaches Counter as &mut argument — only the owner can do this for owned objects." },
            { title: "Your code runs", body: "Mutates and commits new state on success, or aborts with no change." },
          ],
        },
        {
          type: "prose",
          text: "Shared objects work differently: anyone can include the shared Pool in their transaction if your entry allows it. Owned objects enable parallel txs across users; shared objects serialize access through consensus.",
        },
      ],
    },
  ],
};