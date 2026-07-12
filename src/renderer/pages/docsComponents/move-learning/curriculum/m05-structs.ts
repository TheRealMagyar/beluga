import type { MoveModule } from "./types";

export const MODULE_STRUCTS: MoveModule = {
  id: "structs",
  order: 5,
  title: "Structs & Abilities",
  description: "Custom types and the four ability flags that control what you can do.",
  accent: "#ffb347",
  icon: "🧱",
  lessons: [
    {
      id: "struct-intro",
      title: "What is a struct?",
      duration: "10 min",
      summary: "Group related fields into one named type.",
      goal: "Define a struct and create a value of that type.",
      blocks: [
        {
          type: "prose",
          text: "A struct bundles related data under one type name — like a record or a class without methods attached. Instead of passing three separate arguments (name, level, score), you pass one UserProfile. The compiler checks you set every required field when you construct it.",
        },
        {
          type: "prose",
          text: "StructName { field: value } is construction syntax — you list each field. Order of fields in the literal must match the struct definition (or use named fields explicitly as shown).",
        },
        {
          type: "code",
          language: "move",
          code: `module my_package::profile;

public struct UserProfile has copy, drop, store {
    name: vector<u8>,
    level: u64,
}

public fun new_user(): UserProfile {
    UserProfile {
        name: b"Alice",
        level: 1,
    }
}`,
        },
        {
          type: "prose",
          text: "b\"Alice\" is a byte vector literal — common for strings in Move (UTF-8 bytes).",
        },
      ],
    },
    {
      id: "struct-abilities",
      title: "Abilities: copy, drop, store, key",
      duration: "14 min",
      summary: "The four permissions on every struct — explained from zero.",
      goal: "Pick abilities correctly for data vs on-chain objects.",
      blocks: [
        {
          type: "prose",
          text: "Abilities are permissions attached to a struct type. They answer: can I duplicate this? can I throw it away? can I put it inside another struct? can it be a top-level Sui object? You declare them after has on the struct line.",
        },
        {
          type: "list",
          items: [
            "copy — bitwise duplicate allowed (let b = a leaves both valid). All fields must also have copy.",
            "drop — automatic cleanup at end of scope when binding ends.",
            "store — can be nested inside other structs and stored in tables/fields on-chain.",
            "key — can be a Sui object; requires id: UID as first field. Implies store.",
          ],
        },
        {
          type: "prose",
          text: "A struct cannot have copy if any field lacks copy — UID never has copy, so objects with UID are never copyable. That is intentional for coins and NFTs.",
        },
        {
          type: "subtitle",
          text: "Plain data vs chain object",
        },
        {
          type: "compare",
          bad: `struct CoinVault has key { balance: u64 }  // missing id: UID`,
          good: `struct CoinVault has key { id: UID, balance: u64 }`,
        },
        {
          type: "tip",
          tone: "info",
          text: "Not every struct needs key. Config blobs inside objects often use store, copy, drop only.",
        },
      ],
    },
    {
      id: "struct-destructure",
      title: "Unpacking structs",
      duration: "8 min",
      summary: "Read fields and destructure into variables.",
      goal: "Access and destructure struct fields safely.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `public fun level_of(p: &UserProfile): u64 {
    p.level
}

public fun consume(p: UserProfile): u64 {
    let UserProfile { name: _, level } = p;
    level
}`,
        },
        {
          type: "prose",
          text: "p.level works on references. consume takes ownership and destructures — p is gone after. Use _ to ignore fields you do not need.",
        },
      ],
    },
    {
      id: "struct-enums",
      title: "Enums (sum types)",
      duration: "12 min",
      summary: "A type that is one of several variants — Move 2024 edition.",
      goal: "Define an enum and match on variants.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `public enum Status has copy, drop, store {
    Pending,
    Active,
    Closed,
}

public fun is_active(s: &Status): bool {
    matches!(s, Status::Active)
}`,
        },
        {
          type: "prose",
          text: "Enums model choices: order status, role, token type. Use match or matches! to branch — safer than magic numbers.",
        },
      ],
    },
    {
      id: "struct-update",
      title: "Updating struct fields",
      duration: "8 min",
      summary: "Mutate through &mut or rebuild with field update syntax.",
      goal: "Change one field without rebuilding the whole struct.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `public fun level_up(p: &mut UserProfile) {
    p.level = p.level + 1;
}`,
        },
      ],
    },
    {
      id: "struct-nested",
      title: "Nested structs",
      duration: "8 min",
      summary: "Structs inside structs — composition.",
      goal: "Model grouped data cleanly.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `public struct Stats has store, copy, drop {
    hp: u64,
    atk: u64,
}

public struct Hero has key {
    id: UID,
    stats: Stats,
}`,
        },
      ],
    },
    {
      id: "struct-phantom",
      title: "Phantom type parameters",
      duration: "10 min",
      summary: "Type tags with no runtime data — used by Coin<T>.",
      goal: "Read Coin<MY_TOKEN> and similar APIs.",
      blocks: [
        {
          type: "prose",
          text: "A phantom type parameter marks which logical token or resource a struct refers to, without storing extra bytes. MY_TOKEN is often a zero-size witness struct.",
        },
        {
          type: "code",
          language: "move",
          code: `public struct Tag has drop {}
public struct Vault<phantom T> has key {
    id: UID,
    balance: u64,
}`,
        },
      ],
    },
  ],
};