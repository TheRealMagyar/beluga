import type { MoveModule } from "./types";

export const MODULE_VARIABLES: MoveModule = {
  id: "variables",
  order: 2,
  title: "Variables & Types",
  description: "Declare values, change them (or don't), and learn Move's basic types.",
  accent: "#4ca3ff",
  icon: "🔤",
  lessons: [
    {
      id: "var-what-is-let",
      title: "What is a variable?",
      duration: "12 min",
      summary: "The let keyword — how you give a name to a value.",
      goal: "Declare your first variables inside a function.",
      blocks: [
        {
          type: "prose",
          text: "A variable is a name bound to a value for a period of time. In Move you create bindings with let. Until the name goes out of scope, you can read that value through the name. Move is statically typed: every value has a type, and the compiler checks that you do not treat a number like an address.",
        },
        {
          type: "prose",
          text: "Think of let age = 25; as putting a sticky label \"age\" on the number 25. You can read the label later. You cannot put the same label on two different things in the same scope unless you shadow (covered later).",
        },
        {
          type: "code",
          language: "move",
          code: `module my_package::basics;

public fun demo() {
    let age = 25;
    let is_active = true;
    let score = 100u64;
}`,
        },
        {
          type: "subtitle",
          text: "Reading the examples",
        },
        {
          type: "list",
          items: [
            "25 — compiler infers an integer type (usually u64 in function bodies).",
            "true / false — bool, used only in conditions and logic.",
            "100u64 — explicit type suffix: unsigned 64-bit integer, no decimals, no negatives.",
          ],
        },
        {
          type: "subtitle",
          text: "Why no floating point?",
        },
        {
          type: "prose",
          text: "Blockchains need deterministic math — every validator must get the exact same result. Floating point can differ slightly between CPUs. Move uses integers only. Represent dollars as cents (u64), tokens with decimals in metadata (9 decimals → 1_000_000_000 = 1.0 token).",
        },
        {
          type: "compare",
          bad: `let x = 3.14;  // ❌ Move has no floating point`,
          good: `let price_cents = 314u64;  // ✅ store $3.14 as 314 cents`,
        },
      ],
      exercise: {
        prompt: "Inside demo(), add let planet = @0x1; (an address literal).",
        hint: "Addresses start with @ and identify accounts on Sui.",
        solution: "let planet = @0x1;",
      },
    },
    {
      id: "var-mutability",
      title: "let vs let mut",
      duration: "14 min",
      summary: "Default is immutable — use mut when you need to reassign.",
      goal: "Know when a variable can change and when it cannot.",
      blocks: [
        {
          type: "prose",
          text: "By default, let x = 0; means x always refers to 0 in that scope. You cannot write x = 1 later. That immutability catches bugs: if you thought x was still 0 but something changed it, accounting logic could break silently in other languages — Move prevents that.",
        },
        {
          type: "prose",
          text: "let mut y = 0; means the binding y can be reassigned: y = y + 1; is legal. mut does not make the value inside a struct mutable from outside — it only allows rebinding the local name.",
        },
        {
          type: "code",
          language: "move",
          code: `public fun counters() {
    let x = 0;       // immutable — cannot do x = 1 later
    let mut y = 0;   // mutable binding
    y = y + 1;       // OK — y now refers to 1
    // x = x + 1;    // COMPILE ERROR
}`,
        },
        {
          type: "tip",
          tone: "info",
          text: "Default to let without mut. Add mut only when you need to update a counter or accumulate in a loop. Less mutation = easier audits and fewer surprises.",
        },
      ],
    },
    {
      id: "var-types",
      title: "Basic types",
      duration: "16 min",
      summary: "u8, u64, u128, bool, address — what each is for.",
      goal: "Pick the right type for numbers, flags, and addresses.",
      blocks: [
        {
          type: "prose",
          text: "Types describe what operations are allowed. You cannot add a bool to a u64. You cannot use a u8 where a u64 is required without an explicit cast. The compiler enforces this at build time.",
        },
        {
          type: "list",
          items: [
            "u8, u16, u32, u64, u128, u256 — unsigned integers (zero or positive only). u64 is the workhorse for amounts and counters.",
            "bool — exactly true or false. if (x) requires bool — not 0/1 like C.",
            "address — 32-byte identity for accounts and objects. Written @0x... in code.",
          ],
        },
        {
          type: "code",
          language: "move",
          code: `let small: u8 = 255;        // max 255 — good for percentages
let amount: u64 = 1_000_000;  // underscores for readability
let owner: address = @0x42;
let flag: bool = false;
let active = 5 > 3;           // bool from comparison`,
        },
        {
          type: "subtitle",
          text: "Type annotations and inference",
        },
        {
          type: "prose",
          text: "let x: u64 = 0 forces u64. let x = 0 often infers u64 from context (function return type, later usage). When the compiler complains about ambiguous integer type, add : u64 explicitly.",
        },
        {
          type: "subtitle",
          text: "Integer overflow",
        },
        {
          type: "prose",
          text: "Adding two u64 values that exceed 2^64-1 aborts the transaction in safe builds. For token balances, check before add: assert!(a <= MAX - b, E_OVERFLOW); Financial code must think about bounds.",
        },
      ],
    },
    {
      id: "var-vectors",
      title: "Vectors & tuples",
      duration: "14 min",
      summary: "Lists of same-type values and short grouped values.",
      goal: "Create a vector and access its elements.",
      blocks: [
        {
          type: "prose",
          text: "vector<T> is a growable list where every element has the same type T. Use it for lists of IDs, scores, or byte data. Tuples like (u64, bool) group a fixed number of values of possibly different types — often used as a quick return pair.",
        },
        {
          type: "code",
          language: "move",
          code: `use std::vector;

let nums: vector<u64> = vector[10, 20, 30];
let first = nums[0];  // 10 — indexing can abort if out of bounds

let pair = (42u64, true);  // tuple — two slots, fixed shape`,
        },
        {
          type: "subtitle",
          text: "Common vector operations",
        },
        {
          type: "code",
          language: "move",
          code: `let mut v = vector::empty<u64>();
vector::push_back(&mut v, 10);
let n = vector::length(&v);
let last = vector::pop_back(&mut v);  // removes and returns last`,
        },
        {
          type: "prose",
          text: "push_back needs &mut v because it changes the vector. length takes &v because it only reads. pop_back removes the last element — useful for stack-like behavior.",
        },
        {
          type: "tip",
          tone: "warning",
          text: "nums[99] when length is 3 aborts the transaction. Check vector::length first or use safe helpers. Off-chain code can catch errors; on-chain aborts cost gas and fail the whole tx.",
        },
      ],
      exercise: {
        prompt: "Create empty vector, push 1, 2, 3, assert length is 3.",
        hint: "vector::empty, push_back, vector::length, assert!",
        solution: `let mut v = vector::empty<u64>();
vector::push_back(&mut v, 1);
vector::push_back(&mut v, 2);
vector::push_back(&mut v, 3);
assert!(vector::length(&v) == 3, 0);`,
      },
    },
    {
      id: "var-constants",
      title: "Constants",
      duration: "10 min",
      summary: "Values that never change, known at compile time.",
      goal: "Use const for magic numbers and config.",
      blocks: [
        {
          type: "prose",
          text: "Constants are named values fixed at compile time. They live at module level — outside any function — and never change. Use them for max supply, fee basis points, and abort codes so readers know what numbers mean.",
        },
        {
          type: "code",
          language: "move",
          code: `module my_package::config;

const MAX_SUPPLY: u64 = 1_000_000;
const E_PAUSED: u64 = 1;
const ADMIN: address = @0xAD;

public fun max(): u64 {
    MAX_SUPPLY
}`,
        },
        {
          type: "prose",
          text: "const must have an explicit type. You cannot compute const from runtime values — only literals and other consts. ADMIN as address is fine for examples; production admin checks use tx_context::sender and caps, not hard-coded addresses alone.",
        },
      ],
    },
    {
      id: "var-strings",
      title: "Strings & bytes",
      duration: "12 min",
      summary: "Text in Move is UTF-8 bytes, not a built-in string type.",
      goal: "Store and compare short text using vector<u8>.",
      blocks: [
        {
          type: "prose",
          text: "Move has no built-in String type in the core language. Human-readable text is stored as vector<u8> containing UTF-8 bytes. The literal b\"Beluga\" creates a byte vector at compile time — the b prefix means \"bytes.\"",
        },
        {
          type: "code",
          language: "move",
          code: `let name = b"Beluga";
let empty: vector<u8> = vector[];

use std::string::{Self, String};
// String wraps vector<u8> — common in framework and NFT metadata`,
        },
        {
          type: "prose",
          text: "On-chain storage costs gas. Long strings are expensive. Store hashes or Walrus blob IDs for large content; keep names and symbols short on-chain.",
        },
      ],
    },
    {
      id: "var-option",
      title: "Option — maybe a value",
      duration: "14 min",
      summary: "Some<T> and None when a value might not exist.",
      goal: "Use option::some and option::none safely.",
      blocks: [
        {
          type: "prose",
          text: "Option<T> represents \"maybe a T.\" option::some(42) means there is a value; option::none() means empty. Use it for optional fields, lookup results, and nullable state instead of magic sentinel numbers.",
        },
        {
          type: "code",
          language: "move",
          code: `use std::option::{Self, Option};

let found: Option<u64> = option::some(42);
let missing: Option<u64> = option::none();

public fun unwrap_or(mut opt: Option<u64>, default: u64): u64 {
    if (option::is_some(&opt)) {
        option::extract(&mut opt)
    } else {
        default
    }
}`,
        },
        {
          type: "prose",
          text: "option::extract removes the value from Some. Calling extract on None aborts — like unwrapping null in other languages. Always check is_some first, or use match (Move 2024) for exhaustive handling.",
        },
        {
          type: "tip",
          tone: "warning",
          text: "Inventory slot empty? Use Option<Sword> not Sword with a dummy ID. Option makes \"missing\" explicit in the type system.",
        },
      ],
    },
    {
      id: "var-shadowing",
      title: "Shadowing",
      duration: "10 min",
      summary: "Reusing a name with let in the same scope.",
      goal: "Understand when a new binding hides the old one.",
      blocks: [
        {
          type: "prose",
          text: "Shadowing means declaring let x again in the same scope. The new x hides the old one from that point forward. This is not mutation — it is a brand-new binding. The old value is gone if nothing else holds it.",
        },
        {
          type: "code",
          language: "move",
          code: `let x = 5;
let x = x + 1;  // new binding — OK in Move
// x is now 6; the old 5 binding is shadowed`,
        },
        {
          type: "compare",
          bad: "let mut x = 5; let x = 10; // ERROR: duplicate declaration",
          good: "let x = 5; let x = x + 1; // shadowing — OK",
        },
        {
          type: "prose",
          text: "Shadowing is useful for step-by-step transformations: let data = raw; let data = validate(data); without needing mut.",
        },
      ],
    },
    {
      id: "var-locals-scope",
      title: "Scope & blocks",
      duration: "12 min",
      summary: "Where variables exist — inside { braces }.",
      goal: "Predict which variables are in scope.",
      blocks: [
        {
          type: "prose",
          text: "A variable exists from its let until the end of the block { } it was declared in. Inner blocks can see outer variables. Outer blocks cannot see variables declared only inside an inner block.",
        },
        {
          type: "code",
          language: "move",
          code: `public fun scope_demo() {
    let a = 1;
    {
        let b = 2;
        let sum = a + b;  // a from outer scope — OK
    };
    // b does not exist here — block ended
    let _ = a;  // a still valid
}`,
        },
        {
          type: "prose",
          text: "When a block ends, bindings declared inside are dropped. If they had the drop ability, cleanup happens automatically. If they owned a non-droppable resource, the compiler forces you to use or move it before the block ends — you cannot leak values.",
        },
      ],
    },
  ],
};