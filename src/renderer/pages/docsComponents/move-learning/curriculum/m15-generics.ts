import type { MoveModule } from "./types";

export const MODULE_GENERICS: MoveModule = {
  id: "generics",
  order: 15,
  title: "Generics & Type Params",
  description: "Coin<T>, phantom types, and reusable generic code.",
  accent: "#a78bfa",
  icon: "🔷",
  lessons: [
    {
      id: "gen-intro",
      title: "Why generics exist",
      duration: "10 min",
      summary: "One implementation, many types — safely.",
      goal: "Read struct Wrapper<T> and Coin<T> without fear.",
      blocks: [
        {
          type: "prose",
          text: "Generics let you write code that works for multiple types while staying type-safe. Coin<MY_TOKEN> and Coin<OTHER_TOKEN> are different types — you cannot mix them.",
        },
        {
          type: "code",
          language: "move",
          code: `public struct Box<T> has store {
    value: T,
}

public fun pack<T: store>(item: T): Box<T> {
    Box { value: item }
}`,
        },
      ],
    },
    {
      id: "gen-constraints",
      title: "Type constraints",
      duration: "12 min",
      summary: "T: store, T: drop — what generics require.",
      goal: "Understand why T must have certain abilities.",
      blocks: [
        {
          type: "list",
          items: [
            "T: store — value can live inside another struct.",
            "T: copy + drop — can duplicate and discard.",
            "T: key — rare in generic params; objects use concrete types.",
            "Phantom T — type tag only, no field of type T.",
          ],
        },
      ],
    },
    {
      id: "gen-phantom",
      title: "Phantom type parameters",
      duration: "12 min",
      summary: "T appears in struct but not in fields — branding.",
      goal: "See how MY_TOKEN brands Coin without storing witness.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `// Coin from framework — T is phantom branding
public struct Coin<phantom T> has key, store {
    id: UID,
    balance: Balance<T>,
}`,
        },
        {
          type: "tip",
          tone: "info",
          text: "Phantom types prevent mixing USDC logic with SUI logic at compile time.",
        },
      ],
    },
    {
      id: "gen-functions",
      title: "Generic functions",
      duration: "10 min",
      summary: "Type params on functions, not just structs.",
      goal: "Write fun swap<T: store>(a: T, b: T): (T, T).",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `public fun duplicate_pair<T: copy + drop>(x: T): (T, T) {
    (x, x)
}`,
        },
      ],
    },
    {
      id: "gen-tuples",
      title: "Tuples as return types",
      duration: "8 min",
      summary: "(u64, bool) and destructuring results.",
      goal: "Return and unpack multiple values cleanly.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `public fun min_max(a: u64, b: u64): (u64, u64) {
    if (a < b) (a, b) else (b, a)
}

let (lo, hi) = min_max(10, 3);`,
        },
      ],
    },
    {
      id: "gen-type-alias",
      title: "Type aliases",
      duration: "8 min",
      summary: "Readable names for complex types.",
      goal: "Use type alias for vector<u8> names and IDs.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `public type Name = vector<u8>;
public type TokenAmount = u64;`,
        },
      ],
    },
  ],
};