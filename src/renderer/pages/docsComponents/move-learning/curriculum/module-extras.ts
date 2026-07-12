import type { LessonBlock, Quiz, QuizQuestion } from "./types";

export interface ModuleExtra {
  recapBlocks: LessonBlock[];
  quizIntro?: LessonBlock[];
  quiz: Quiz;
}

function q(
  id: string,
  prompt: string,
  options: [string, string, string, string],
  correctIndex: 0 | 1 | 2 | 3,
  explanation: string,
): QuizQuestion {
  const ids = ["a", "b", "c", "d"] as const;
  return {
    id,
    prompt,
    options: options.map((text, i) => ({ id: ids[i], text })),
    correctOptionId: ids[correctIndex],
    explanation,
  };
}

export const MODULE_EXTRAS: Record<string, ModuleExtra> = {
  start: {
    recapBlocks: [
      {
        type: "keypoints",
        title: "You should now know",
        items: [
          "Move code lives in a Sui package — Move.toml + sources/*.move.",
          "Every file starts with module package_name::module_name;",
          "Sui = object model (not one storage map per address).",
          "Gas, storage deposit, faucet — transactions cost SUI.",
          "Beluga: Learning → Playground → Console → Wallet.",
          "Fix compiler errors one at a time — read the message bottom-up.",
        ],
      },
      {
        type: "tip",
        tone: "success",
        text: "If you can explain what a module line does, you're ready for variables.",
      },
    ],
    quiz: {
      passPercent: 70,
      questions: [
        q(
          "start-q1",
          "What file declares your package name and dependencies?",
          ["sources/hello.move", "Move.toml", "sui.json", "Cargo.toml"],
          1,
          "Move.toml is the package manifest — name, edition, and [dependencies].",
        ),
        q(
          "start-q2",
          "A valid module declaration for package my_game is:",
          [
            "module my_game;",
            "package my_game::logic;",
            "module my_game::logic;",
            "use my_game::logic;",
          ],
          2,
          "Syntax is module <package>::<module_name>; matching Move.toml name.",
        ),
        q(
          "start-q3",
          "An empty module with only the module line — can it compile?",
          [
            "No — must have at least one function",
            "Yes — valid starting point",
            "Only with #[test]",
            "Only on mainnet",
          ],
          1,
          "An empty module block is valid; you add functions in later lessons.",
        ),
        q(
          "start-q4",
          "Sui addresses in Move are typically written as:",
          ["Decimal numbers", "32-byte hex with 0x prefix", "Email strings", "UUID v4"],
          1,
          "address is a 32-byte value; literals use 0x... hex notation.",
        ),
      ],
    },
  },

  variables: {
    recapBlocks: [
      {
        type: "keypoints",
        title: "Core ideas",
        items: [
          "let binds a name; let mut allows reassignment.",
          "Types: u64, bool, address, vector<T>, Option<T>.",
          "Text = vector<u8> with b\"literal\" syntax.",
          "const at module level — immutable forever.",
          "Shadowing (let x = ... twice) is OK; duplicate mut bindings are not.",
        ],
      },
    ],
    quiz: {
      passPercent: 70,
      questions: [
        q(
          "var-q1",
          "Which declares a mutable variable?",
          ["let x = 1;", "let mut x = 1;", "mut let x = 1;", "var x = 1;"],
          1,
          "Move uses let mut for mutability — not var.",
        ),
        q(
          "var-q2",
          "Move stores human-readable text as:",
          ["String native type", "vector<u8> UTF-8 bytes", "char arrays", "JSON"],
          1,
          "b\"hello\" creates a vector<u8> literal.",
        ),
        q(
          "var-q3",
          "option::extract on None will:",
          ["Return 0", "Abort the transaction", "Return None", "Compile error only"],
          1,
          "Extracting from None aborts — always check is_some first.",
        ),
        q(
          "var-q4",
          "Constants in Move are declared with:",
          ["let const NAME", "const NAME: Type = value;", "static NAME", "final NAME"],
          1,
          "Module-level const requires explicit type and value.",
        ),
        q(
          "var-q5",
          "Shadowing means:",
          [
            "Two mut bindings with the same name",
            "A new let hides the previous binding in scope",
            "Changing a field inside a struct",
            "Importing twice",
          ],
          1,
          "let x = 1; let x = x + 1; creates a new binding — legal shadowing.",
        ),
      ],
    },
  },

  functions: {
    recapBlocks: [
      {
        type: "keypoints",
        items: [
          "fun name(params): ReturnType { body }",
          "public — any package; public(package) — same package only; private default.",
          "entry fun — callable from transactions (Sui).",
          "Underscore _ prefix ignores unused params.",
          "Functions return the last expression or explicit return.",
        ],
      },
    ],
    quiz: {
      passPercent: 70,
      questions: [
        q(
          "fn-q1",
          "Who can call a private function?",
          ["Any module on chain", "Only the same module", "Only #[test]", "Only entry functions"],
          1,
          "Default visibility is module-private.",
        ),
        q(
          "fn-q2",
          "entry fun is used because:",
          [
            "It's faster to compile",
            "Transactions can invoke it directly",
            "It returns tuples only",
            "It replaces init",
          ],
          1,
          "entry marks transaction-callable functions on Sui.",
        ),
        q(
          "fn-q3",
          "A function with no return type that ends with () returns:",
          ["null", "0", "unit — no value", "compiler error"],
          2,
          "Move uses () for no meaningful return — implicit at end of block.",
        ),
        q(
          "fn-q4",
          "_ctx: &TxContext means:",
          [
            "ctx is mutable",
            "ctx is intentionally unused",
            "ctx must be deleted",
            "Syntax error",
          ],
          1,
          "Leading underscore silences unused variable warnings.",
        ),
      ],
    },
  },

  control: {
    recapBlocks: [
      {
        type: "keypoints",
        items: [
          "if (cond) { } else { } — condition must be bool.",
          "while (cond) { } — mind infinite loops in on-chain code.",
          "assert!(cond, code) aborts with numeric code on failure.",
          "&&, ||, ! for logical combinations.",
          "break / continue work inside loops.",
        ],
      },
    ],
    quiz: {
      passPercent: 70,
      questions: [
        q(
          "ctrl-q1",
          "assert!(balance >= amount, E_INSUFFICIENT) on failure:",
          [
            "Returns false",
            "Skips the rest silently",
            "Aborts with code E_INSUFFICIENT",
            "Panics only in tests",
          ],
          2,
          "assert! aborts the transaction with the given u64 code.",
        ),
        q(
          "ctrl-q2",
          "if (x) { } is invalid because:",
          ["x must be numeric", "x must be bool", "if needs else", "x must be address"],
          1,
          "Conditions must be bool — not truthy integers.",
        ),
        q(
          "ctrl-q3",
          "Error codes are usually:",
          [
            "Random strings",
            "const E_*: u64 at module level",
            "Only in comments",
            "Generated by compiler",
          ],
          1,
          "Named const abort codes aid debugging and documentation.",
        ),
        q(
          "ctrl-q4",
          "loop { } without break:",
          ["Compiles but never useful", "Infinite loop — use carefully", "Illegal in Move", "Auto-breaks at 1000"],
          1,
          "loop runs until break — dangerous if unconditional on-chain.",
        ),
      ],
    },
  },

  structs: {
    recapBlocks: [
      {
        type: "keypoints",
        items: [
          "struct Name has abilities { fields }",
          "Abilities: key, store, copy, drop — control what you can do.",
          "Destructuring: let Struct { field, .. } = value;",
          "Enums: variant types with payloads.",
          "Phantom type params: struct Wrapper<T> has drop {}.",
        ],
      },
    ],
    quiz: {
      passPercent: 70,
      questions: [
        q(
          "struct-q1",
          "A struct needs which ability to exist as a Sui object?",
          ["copy", "drop", "key", "store only"],
          2,
          "key (+ UID field) makes it an on-chain object.",
        ),
        q(
          "struct-q2",
          "copy ability allows:",
          [
            "Duplicating values bitwise",
            "Transferring to addresses",
            "Minting coins",
            "Deleting objects",
          ],
          0,
          "copy — duplicate by value; all fields must also be copy.",
        ),
        q(
          "struct-q3",
          "PascalCase is used for:",
          ["Variables", "Functions", "Struct and enum names", "Module names"],
          2,
          "Structs/enums: PascalCase; functions/vars: snake_case.",
        ),
        q(
          "struct-q4",
          "Updating some fields, keeping others — pattern:",
          [
            "struct_update syntax or manual field copy",
            "Only via dynamic fields",
            "Impossible in Move",
            "Requires freeze",
          ],
          0,
          "Move supports functional update patterns for structs.",
        ),
      ],
    },
  },

  ownership: {
    recapBlocks: [
      {
        type: "keypoints",
        items: [
          "Move = linear ownership — one owner at a time.",
          "&T immutable borrow; &mut T exclusive mutable borrow.",
          "Cannot copy non-copy types; must move or borrow.",
          "Returning a value transfers ownership to caller.",
          "References cannot outlive owned value scope.",
        ],
      },
    ],
    quiz: {
      passPercent: 70,
      questions: [
        q(
          "own-q1",
          "After let y = x; (non-copy type), x is:",
          ["Still usable", "Moved — x invalid", "Automatically copied", "Shared"],
          1,
          "Move semantics — x is moved unless type has copy.",
        ),
        q(
          "own-q2",
          "&mut T allows:",
          ["Many simultaneous writers", "One exclusive writer", "Only reads", "Deleting T"],
          1,
          "At most one &mut borrow at a time — borrow checker.",
        ),
        q(
          "own-q3",
          "drop ability means:",
          ["Value can be destroyed implicitly at end of scope", "Must manual delete", "Cannot pass to functions", "Only for coins"],
          0,
          "Types with drop are cleaned up when scope ends without explicit delete.",
        ),
        q(
          "own-q4",
          "Storage rebate relates to:",
          ["Deleting objects and reclaiming SUI", "Minting tokens", "Gas price oracle", "PTB batching"],
          0,
          "object::delete returns storage fund — rebate concept on Sui.",
        ),
      ],
    },
  },

  objects: {
    recapBlocks: [
      {
        type: "keypoints",
        items: [
          "Objects = struct + key + UID field + object::new(ctx).",
          "Owned — one address; Shared — anyone per rules; Frozen — immutable.",
          "transfer::transfer / public_transfer — owned objects.",
          "transfer::share_object — shared; freeze_object — frozen.",
          "object::delete(id) — destroy and reclaim storage.",
        ],
      },
    ],
    quiz: {
      passPercent: 70,
      questions: [
        q(
          "obj-q1",
          "Every Sui object struct must have:",
          ["name: String", "id: UID", "owner: address field", "version: u64"],
          1,
          "UID as id field is required for key objects.",
        ),
        q(
          "obj-q2",
          "share_object makes an object:",
          ["Owned by sender only", "Accessible per module rules by anyone", "Deleted", "Frozen"],
          1,
          "Shared objects can be used in concurrent transactions with consensus.",
        ),
        q(
          "obj-q3",
          "Frozen objects:",
          ["Can never be read", "Cannot be mutated or transferred", "Are always shared", "Auto-delete after epoch"],
          1,
          "freeze_object — permanent immutability.",
        ),
        q(
          "obj-q4",
          "object::ID vs UID:",
          ["Same type", "ID is immutable reference; UID is owned handle", "UID is off-chain only", "ID is for events only"],
          1,
          "ID is copyable reference; UID is the owned object identity field.",
        ),
        q(
          "obj-q5",
          "Receiving objects (transfer::receive) is for:",
          ["Minting coins", "Claiming objects sent to an object", "Sharing", "Upgrades"],
          1,
          "Custom receiving rules — e.g. inbox on parent object.",
        ),
      ],
    },
  },

  imports: {
    recapBlocks: [
      {
        type: "keypoints",
        items: [
          "use sui::module::{Self, Name}; imports into scope.",
          "Self = the module itself; alias with as.",
          "Framework: object, transfer, tx_context, coin, event.",
          "std: vector, option, string, hash.",
          "Only public items cross package boundaries.",
        ],
      },
    ],
    quiz: {
      passPercent: 70,
      questions: [
        q(
          "imp-q1",
          "use sui::object::{Self, UID}; — Self refers to:",
          ["The current module", "The object module", "A test helper", "Compiler builtin"],
          1,
          "Self in a use list is the module being imported.",
        ),
        q(
          "imp-q2",
          "tx_context::sender(ctx) lives in:",
          ["std::tx", "sui::tx_context", "sui::transfer", "move::context"],
          1,
          "Sender and epoch come from sui::tx_context.",
        ),
        q(
          "imp-q3",
          "Another package can call your function if it is:",
          ["private", "public", "fun without visibility", "init only"],
          1,
          "public visibility required for cross-package calls.",
        ),
        q(
          "imp-q4",
          "Coin minting utilities are in:",
          ["sui::coin", "std::coin", "sui::token", "sui::balance"],
          0,
          "sui::coin — Coin, TreasuryCap, mint, burn.",
        ),
      ],
    },
  },

  events: {
    recapBlocks: [
      {
        type: "keypoints",
        items: [
          "event::emit(EventStruct { ... }) — indexer logs.",
          "Event structs need copy + drop.",
          "Include actor, entity ids, epoch for rich indexers.",
          "assert! guards validate before state changes.",
          "E_* const codes document abort reasons.",
        ],
      },
    ],
    quiz: {
      passPercent: 70,
      questions: [
        q(
          "evt-q1",
          "Events on Sui are:",
          ["Stored as full objects forever", "Cheap logs for off-chain apps", "Private to sender", "Only in tests"],
          1,
          "Events are emitted for indexers — not persistent owned state.",
        ),
        q(
          "evt-q2",
          "Event structs typically need:",
          ["key + store", "copy + drop", "only drop", "store only"],
          1,
          "Emitted values must be copyable and droppable.",
        ),
        q(
          "evt-q3",
          "Good event design includes:",
          ["Private keys", "Actor + entity ids + context", "Only timestamps", "Empty structs"],
          1,
          "Enough data to rebuild UI state from the event stream.",
        ),
        q(
          "evt-q4",
          "Validate-then-mutate means:",
          ["Mutate first, assert later", "assert! checks before changing state", "No asserts in production", "Only use in tests"],
          1,
          "Guard clauses first — auditors and readers thank you.",
        ),
      ],
    },
  },

  capabilities: {
    recapBlocks: [
      {
        type: "keypoints",
        items: [
          "AdminCap — proves permission; passed as &Cap in admin calls.",
          "OTW — one-time witness; consumed in init; name = PACKAGE in caps.",
          "init runs once at publish — setup treasury/caps.",
          "UpgradeCap — controls package upgrades.",
          "Publisher — required for Display<T>.",
        ],
      },
    ],
    quiz: {
      passPercent: 70,
      questions: [
        q(
          "cap-q1",
          "AdminCap pattern gates functions by:",
          ["Checking sender only", "Requiring &AdminCap parameter", "Sharing the cap", "Freezing the cap"],
          1,
          "Caller must own and include the cap in the transaction.",
        ),
        q(
          "cap-q2",
          "OTW struct MY_TOKEN must:",
          ["Have key", "Match package name in ALL_CAPS with drop", "Be shared at init", "Never be used"],
          1,
          "One-time witness naming convention for coin::create_currency.",
        ),
        q(
          "cap-q3",
          "init is called:",
          ["Every transaction", "Once at package publish", "Only in tests", "By validators manually"],
          1,
          "Single publish-time setup hook.",
        ),
        q(
          "cap-q4",
          "UpgradeCap holder can:",
          ["Steal user coins", "Perform compatible package upgrades", "Change object IDs", "Delete mainnet"],
          1,
          "UpgradeCap authorizes code updates per policy.",
        ),
      ],
    },
  },

  tokens: {
    recapBlocks: [
      {
        type: "keypoints",
        items: [
          "Fungible = Coin<T> + TreasuryCap<T>.",
          "mint / burn through treasury.",
          "coin::split / coin::join for exact amounts.",
          "NFTs = unique objects with key + store.",
          "Display<T> + Publisher for wallet metadata.",
        ],
      },
    ],
    quiz: {
      passPercent: 70,
      questions: [
        q(
          "tok-q1",
          "TreasuryCap controls:",
          ["Only transfers", "Minting and burning Coin<T>", "Object deletion", "Package upgrades"],
          1,
          "Treasury is mint authority for fungible tokens.",
        ),
        q(
          "tok-q2",
          "NFT uniqueness on Sui comes from:",
          ["A special NFT keyword", "Distinct object IDs", "Random names", "copy ability"],
          1,
          "Each minted object gets a unique UID/object id.",
        ),
        q(
          "tok-q3",
          "Display standard is for:",
          ["Fungible treasury only", "Wallet/explorer rendering of NFT types", "Gas optimization", "PTB ordering"],
          1,
          "Display objects hold name, image_url, etc.",
        ),
        q(
          "tok-q4",
          "coin::split is used to:",
          ["Burn coins", "Take exact amount from a Coin", "Share objects", "Emit events"],
          1,
          "Split extracts a precise amount; remainder stays in original coin.",
        ),
      ],
    },
  },

  advanced: {
    recapBlocks: [
      {
        type: "keypoints",
        items: [
          "dynamic_field::add/remove/borrow — attach data to objects.",
          "dynamic_object_field — child keeps own ID.",
          "Table, Bag, TableVec — collection patterns.",
          "PTB — multiple Move calls, atomic all-or-nothing.",
          "Security: verify sender, protect caps, test before mainnet.",
        ],
      },
    ],
    quiz: {
      passPercent: 70,
      questions: [
        q(
          "adv-q1",
          "Dynamic fields attach to:",
          ["Only shared objects", "Parent object's id field", "Events only", "Packages"],
          1,
          "Fields hang off &mut parent.id via df::add.",
        ),
        q(
          "adv-q2",
          "A PTB (programmable transaction) is:",
          ["A single Move function only", "Multiple chained commands in one atomic tx", "A test macro", "An upgrade"],
          1,
          "All PTB steps succeed or the whole transaction reverts.",
        ),
        q(
          "adv-q3",
          "Authorization should use:",
          ["Client-supplied address alone", "tx_context::sender(ctx)", "Hard-coded zero address", "Random checks"],
          1,
          "Never trust a passed address without proof — use sender from context.",
        ),
        q(
          "adv-q4",
          "Compatible upgrades cannot:",
          ["Add new functions", "Change existing public function signatures", "Fix bugs", "Add new structs"],
          1,
          "Breaking layout/signature changes need migration or new package.",
        ),
      ],
    },
  },

  capstone: {
    recapBlocks: [
      {
        type: "keypoints",
        title: "Full course recap",
        items: [
          "Variables → functions → control → structs → ownership → objects.",
          "Imports, events, caps, tokens, dynamic fields, PTBs.",
          "Build: sui move test → localnet → publish via Playground.",
          "Debug: simulate, match abort codes, check object ownership.",
        ],
      },
      {
        type: "tip",
        tone: "success",
        text: "Pass this final quiz and you've earned the foundation — ship something small on localnet today.",
      },
    ],
    quizIntro: [
      {
        type: "prose",
        text: "Final exam — 5 questions spanning the whole course. Take your time.",
      },
    ],
    quiz: {
      passPercent: 80,
      questions: [
        q(
          "final-q1",
          "First step in a new Sui Move package:",
          ["Write entry fun main", "Define module line matching Move.toml name", "share_object in init", "Mint a coin"],
          1,
          "Package name alignment is the #1 beginner compile error.",
        ),
        q(
          "final-q2",
          "To create an on-chain object you need:",
          ["struct with key + UID + object::new", "copy + drop only", "Just a vector", "An event"],
          0,
          "key ability + UID field + object::new in constructor.",
        ),
        q(
          "final-q3",
          "Coin<MY_TOKEN> requires at publish:",
          ["Manual struct only", "OTW + coin::create_currency in init", "share_object on treasury", "No init"],
          1,
          "Standard pattern: witness consumed once in init.",
        ),
        q(
          "final-q4",
          "Before mainnet deploy you should:",
          ["Skip tests", "Run sui move test / test_scenario", "Delete AdminCap", "Freeze all users"],
          1,
          "Tests catch abort paths and ownership bugs early.",
        ),
        q(
          "final-q5",
          "Indexer-friendly state changes should:",
          ["Stay silent", "emit structured events", "Only use println", "Store secrets on-chain"],
          1,
          "Events let off-chain apps follow your protocol.",
        ),

      ],
    },
  },
};