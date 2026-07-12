import type { MoveModule } from "./types";

export const MODULE_IMPORTS: MoveModule = {
  id: "imports",
  order: 9,
  title: "Imports & Modules",
  description: "use statements, standard library, and calling other modules.",
  accent: "#9ed0ff",
  icon: "📦",
  lessons: [
    {
      id: "imp-use",
      title: "The use statement",
      duration: "10 min",
      summary: "Import modules and shorten names.",
      goal: "Read and write use sui::... lines confidently.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `module my_package::game;

use sui::object::{Self, UID};
use sui::transfer;
use sui::tx_context::TxContext;
use std::vector;

// Self = this module's name (object)
// UID = type from object module`,
        },
        {
          type: "prose",
          text: "use is how you import names from other modules — like import in Python or use in Rust. use sui::object::UID; lets you write UID instead of sui::object::UID everywhere in this file.",
        },
        {
          type: "prose",
          text: "Self in a use list means the module itself: use sui::object::{Self, UID} imports the object module as object plus the UID type. You then call object::new(ctx).",
        },
      ],
    },
    {
      id: "imp-aliases",
      title: "Aliases & re-exports",
      duration: "8 min",
      summary: "Rename imports when names collide.",
      goal: "Use as to alias imported modules.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `use sui::object::UID as ObjectId;
use std::vector as vec;`,
        },
      ],
    },
    {
      id: "imp-sui-framework",
      title: "Sui framework map",
      duration: "12 min",
      summary: "Which sui:: module does what.",
      goal: "Know where to look for coins, objects, events.",
      blocks: [
        {
          type: "list",
          items: [
            "sui::object — UID, object::new, delete.",
            "sui::transfer — transfer, share_object, freeze_object.",
            "sui::tx_context — sender, epoch, gas.",
            "sui::coin — Coin, TreasuryCap, mint.",
            "sui::event — emit for indexers.",
            "sui::package — publish metadata, upgrade cap.",
          ],
        },
      ],
    },
    {
      id: "imp-std",
      title: "std library essentials",
      duration: "10 min",
      summary: "vector, option, string, hash.",
      goal: "Import std modules for collections and options.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `use std::vector;
use std::option::{Self, Option};
use std::hash;

vector::push_back(&mut v, item);
option::is_some(&opt);`,
        },
      ],
    },
    {
      id: "imp-across-modules",
      title: "Calling across modules",
      duration: "10 min",
      summary: "public functions in package A used from package B.",
      goal: "Understand package boundaries.",
      blocks: [
        {
          type: "prose",
          text: "Only public items are callable from other packages. public(package) is limited to your published package. Friends (legacy) — rarely needed as beginner.",
        },
      ],
    },
    {
      id: "imp-grouped",
      title: "Grouped imports",
      duration: "8 min",
      summary: "Import several names from one module in one line.",
      goal: "Read braced use lists and know what Self means.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `use sui::object::{Self, ID, UID};
use std::option::{Self, Option, some, none};

// Self = the module itself (object, option)
// Named types and functions listed explicitly`,
        },
        {
          type: "compare",
          badLabel: "Noisy",
          goodLabel: "Clean",
          bad: "use sui::object::UID;\nuse sui::object::ID;\nuse sui::object;",
          good: "use sui::object::{Self, ID, UID};",
        },
      ],
    },
    {
      id: "imp-where-to-look",
      title: "Finding framework APIs",
      duration: "10 min",
      summary: "How to discover what sui:: actually exports.",
      goal: "Navigate Sui framework source and docs when stuck.",
      blocks: [
        {
          type: "steps",
          steps: [
            {
              title: "Search docs.sui.io",
              body: "Framework reference lists modules under sui:: and std::.",
            },
            {
              title: "Open sui-framework in GitHub",
              body: "crates/sui-framework/packages — read the .move file for the module.",
            },
            {
              title: "Let the compiler teach you",
              body: "Misspelled import? Error suggests similar names.",
            },
          ],
        },
      ],
      exercise: {
        prompt: "Which module would you import for tx_context::sender?",
        hint: "It's in the Sui framework, not std.",
        solution: "use sui::tx_context::{Self, TxContext}; — sender is tx_context::sender(ctx).",
      },
    },
  ],
};