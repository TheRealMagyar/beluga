import type { MoveModule } from "./types";

export const MODULE_START: MoveModule = {
  id: "start",
  order: 1,
  title: "Start Here",
  description: "Absolute zero — what Sui and Move are, and how a project is laid out.",
  accent: "#9ed0ff",
  icon: "🚀",
  lessons: [
    {
      id: "zero-what-is-this",
      title: "What are you actually writing?",
      duration: "12 min",
      summary: "Blockchain, smart contracts, and why Sui uses Move — no prior knowledge needed.",
      goal: "Understand what runs on-chain and what Beluga helps you do.",
      blocks: [
        {
          type: "prose",
          text: "When you write Move code, you are writing rules for a shared computer that thousands of machines run together. Nobody can secretly change those rules after you publish them. Users interact through a wallet: they sign a transaction, the network runs your code, and if everything passes your checks, the result is stored permanently.",
        },
        {
          type: "prose",
          text: "Think of it like a vending machine everyone can see. You program what happens when someone inserts a coin: which slot opens, what item they get, what happens if the slot is empty. The machine does not \"negotiate\" — it either follows your rules exactly or rejects the attempt.",
        },
        {
          type: "subtitle",
          text: "Why Sui is different from many blockchains",
        },
        {
          type: "prose",
          text: "Older chains often store everything as \"storage slots\" under each wallet address — like one big spreadsheet per user. Sui stores most things as separate objects, each with its own ID, type, and owner. A coin is an object. An NFT is an object. Your game's counter is an object. That design lets the network process many unrelated transactions in parallel.",
        },
        {
          type: "subtitle",
          text: "Three words to remember",
        },
        {
          type: "list",
          items: [
            "Package — your published code bundle (the whole app you upload). Once published, it lives on-chain at a package ID.",
            "Module — one .move file inside the package (like a chapter). The first line declares module package_name::module_name;",
            "Object — live data on-chain with a unique ID. Coins, NFTs, game items, admin caps — all objects.",
          ],
        },
        {
          type: "prose",
          text: "You do not \"deploy a database table\" on Sui. You publish code that creates and mutates objects when users call your entry functions. The objects are the state; your Move code is the logic.",
        },
        {
          type: "steps",
          steps: [
            {
              title: "You write Move",
              body: "In .move files under sources/. You describe types, rules, and what entry functions wallets may call.",
            },
            {
              title: "You build & publish",
              body: "The compiler checks safety (ownership, types, abilities). Publish uploads the package; Sui assigns a package ID.",
            },
            {
              title: "Users send transactions",
              body: "A wallet picks an entry function, attaches any required objects (e.g. a coin to pay), signs, and sends. Validators execute your code atomically — all changes succeed or none do.",
            },
          ],
        },
        {
          type: "tip",
          tone: "info",
          text: "Beluga Playground lets you edit, build, and publish to localnet without the terminal. Localnet is a private Sui chain on your machine — free, fast, safe for mistakes. Learn here first, then repeat on testnet.",
        },
      ],
    },
    {
      id: "zero-project-layout",
      title: "Inside a Move project",
      duration: "14 min",
      summary: "Move.toml, sources/, and where your code lives.",
      goal: "Recognize every important file before writing a line of Move.",
      blocks: [
        {
          type: "prose",
          text: "Every Sui Move project follows the same folder layout. You are not inventing structure — you fill in a template. The two files you touch most are Move.toml (configuration) and sources/*.move (your actual code).",
        },
        {
          type: "code",
          language: "text",
          code: `my_package/
├── Move.toml          ← package name, dependencies, addresses
├── sources/
│   └── my_module.move ← your Move code
└── tests/
    └── my_tests.move  ← optional unit tests`,
        },
        {
          type: "subtitle",
          text: "What each folder does",
        },
        {
          type: "list",
          items: [
            "Move.toml — the manifest. Tells the compiler your package name, which Sui framework version to use, and placeholder addresses.",
            "sources/ — all production Move modules. One file can hold one module (common) or you split across files.",
            "tests/ — optional. #[test] functions that prove your logic works before you publish.",
          ],
        },
        {
          type: "subtitle",
          text: "Move.toml (the manifest) — line by line",
        },
        {
          type: "code",
          language: "toml",
          code: `[package]
name = "my_package"
edition = "2024.beta"

[dependencies]
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "framework/testnet" }

[addresses]
my_package = "0x0"`,
        },
        {
          type: "prose",
          text: "name must match the prefix in your module declaration: module my_package::hello; If they differ, you get unbound module errors. edition = \"2024.beta\" enables modern syntax (match, better errors). The Sui dependency gives you the framework: coin::, transfer::, object::, tx_context::, and hundreds of other modules you import with use.",
        },
        {
          type: "prose",
          text: "[addresses] my_package = \"0x0\" is a placeholder. At publish time, Sui replaces 0x0 with your real on-chain package address. You never hard-code the final address in source — the toolchain handles it.",
        },
        {
          type: "tip",
          tone: "warning",
          text: "Changing name in Move.toml without updating every module my_package::... line breaks the build. Treat the package name as a global identifier.",
        },
      ],
    },
    {
      id: "zero-first-module",
      title: "Your first module (empty shell)",
      duration: "12 min",
      summary: "The module line, semicolons, and compiling without errors.",
      goal: "Create a valid .move file that builds successfully.",
      blocks: [
        {
          type: "prose",
          text: "A Move source file is not free-form. It must begin with exactly one module declaration, then optional use imports, then functions and structs inside the module block. Semicolons end statements — forgetting one is the most common syntax error for beginners.",
        },
        {
          type: "code",
          language: "move",
          code: `// sources/hello.move
module my_package::hello;

// We will add functions in the next modules.
// For now, an empty module is valid.`,
        },
        {
          type: "subtitle",
          text: "Reading the module line",
        },
        {
          type: "prose",
          text: "module my_package::hello; means: this file defines a module named hello inside the package my_package. The package name comes from Move.toml. The module name (hello) usually matches the filename (hello.move) — convention, not a strict rule, but it keeps projects readable.",
        },
        {
          type: "prose",
          text: "An empty module compiles. That is intentional: you can verify your project skeleton before learning functions. Build success means Move.toml, paths, and the module line are aligned.",
        },
        {
          type: "steps",
          steps: [
            {
              title: "Save the file",
              body: "Path must be sources/something.move. The compiler only looks in sources/ for production code.",
            },
            {
              title: "Build",
              body: "Run sui move build in the project root, or click Build in Beluga Playground. First build downloads dependencies — can take a minute.",
            },
            {
              title: "Read errors literally",
              body: "Messages include file:line. Fix the first error, rebuild. Later errors are often knock-on effects of the first.",
            },
          ],
        },
        {
          type: "tip",
          tone: "success",
          text: "If build succeeds with an empty module, you already have a publishable package skeleton. Publishing comes later — first learn the language inside sources/.",
        },
      ],
    },
    {
      id: "zero-addresses",
      title: "Addresses & networks",
      duration: "12 min",
      summary: "What @0x... means, mainnet vs testnet vs localnet.",
      goal: "Read wallet addresses and pick the right network in Beluga.",
      blocks: [
        {
          type: "prose",
          text: "An address on Sui identifies who owns objects and who signed a transaction. In Move code you write address literals with @: @0x1, @0x42, or a full 64-character hex string. The @ tells the compiler \"this is an address value, not a number or a name.\"",
        },
        {
          type: "prose",
          text: "Your Beluga wallet has an address. When you publish a package, objects you create in init often go to tx_context::sender(ctx) — the address that signed the publish transaction. When a user calls your entry function, sender is that user's address.",
        },
        {
          type: "subtitle",
          text: "Three networks you will use",
        },
        {
          type: "list",
          items: [
            "Mainnet — real SUI, real assets, real cost. Use only after testing and review.",
            "Testnet — public chain with free test SUI from a faucet. Share with testers; resets occasionally.",
            "Localnet — private chain in Beluga Console on your machine. Instant, free, perfect for learning.",
          ],
        },
        {
          type: "prose",
          text: "Package IDs and object IDs are different on each network. The same source code published on localnet and testnet yields two different package IDs. Save each in Beluga Memory so you do not confuse them.",
        },
        {
          type: "code",
          language: "move",
          code: `let system: address = @0x1;
// @0x1 is a well-known address on Sui (not your wallet)

// In real entry functions you get the caller like this:
// let who = tx_context::sender(ctx);`,
        },
        {
          type: "tip",
          tone: "info",
          text: "Never use a user-supplied address parameter alone for authorization. Anyone could pass someone else's address. Always compare against tx_context::sender(ctx) for \"who is calling.\"",
        },
      ],
    },
    {
      id: "zero-read-errors",
      title: "Reading compiler errors",
      duration: "14 min",
      summary: "How to decode the most common beginner error messages.",
      goal: "Fix a broken build without guessing.",
      blocks: [
        {
          type: "prose",
          text: "Move's compiler is strict on purpose — many bugs that would be runtime surprises in other languages are caught before publish. Error messages look dense at first; they almost always name the file, line, and what was expected vs what you wrote.",
        },
        {
          type: "subtitle",
          text: "Errors you will see on day one",
        },
        {
          type: "list",
          items: [
            "unbound module — package name in module line does not match Move.toml, or typo in use import.",
            "cannot borrow / value moved — you used a value after giving ownership away; see ownership module.",
            "ability constraint — struct missing copy, drop, store, or key for the operation you tried.",
            "expected ';' — statement not terminated. Every let, function call, and assert ends with ;",
            "unbound variable — typo in name, or variable used outside its scope block.",
          ],
        },
        {
          type: "subtitle",
          text: "How to fix without panic",
        },
        {
          type: "steps",
          steps: [
            {
              title: "Read bottom-up",
              body: "Scroll to the first error in the output. Later errors often disappear when the first is fixed.",
            },
            {
              title: "Fix one line",
              body: "Change one thing, rebuild. Avoid fixing five things at once — you won't know what worked.",
            },
            {
              title: "Compare to lesson code",
              body: "Diff your file against the example: module line, semicolons, brackets, package name.",
            },
            {
              title: "Search the message",
              body: "Paste the error into docs or ask Beluga AI with the full compiler output.",
            },
          ],
        },
        {
          type: "tip",
          tone: "success",
          text: "Every senior Move dev still gets compile errors daily. The skill is reading the message, not avoiding errors entirely.",
        },
      ],
    },
    {
      id: "zero-comments",
      title: "Comments & naming",
      duration: "8 min",
      summary: "// line comments and snake_case conventions.",
      goal: "Write readable Move code from the start.",
      blocks: [
        {
          type: "prose",
          text: "Comments are for humans — the compiler ignores them. Good names are documentation: calculate_total_price tells you more than fun3. Move communities follow consistent casing so everyone reads your code the same way.",
        },
        {
          type: "code",
          language: "move",
          code: `// Single-line comment — ignored by compiler

/// Doc comment (shown in some tooling)

public fun calculate_total_price(): u64 {
    // Functions and variables: snake_case
    // Structs and enums: PascalCase — Counter, UserProfile
    0
}`,
        },
        {
          type: "subtitle",
          text: "Naming cheat sheet",
        },
        {
          type: "list",
          items: [
            "Functions & variables: snake_case — mint_token, total_supply.",
            "Structs & enums: PascalCase — Counter, GameState.",
            "Constants: often SCREAMING_SNAKE — E_NOT_OWNER, MAX_SUPPLY.",
            "Modules: snake_case — my_token, game_logic.",
          ],
        },
        {
          type: "prose",
          text: "Error code constants usually start with E_ and use u64: const E_NOT_OWNER: u64 = 0;. When a transaction aborts with code 0, your frontend can show \"You are not the owner.\" Document your codes in a comment block at the top of the module.",
        },
      ],
    },
  ],
};