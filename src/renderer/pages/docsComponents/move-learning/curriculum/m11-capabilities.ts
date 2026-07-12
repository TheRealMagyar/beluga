import type { MoveModule } from "./types";

export const MODULE_CAPABILITIES: MoveModule = {
  id: "capabilities",
  order: 11,
  title: "Capabilities & Patterns",
  description: "Admin caps, witnesses, and safe access control.",
  accent: "#6c63ff",
  icon: "🔑",
  lessons: [
    {
      id: "cap-pattern",
      title: "Capability pattern",
      duration: "12 min",
      summary: "An object that proves permission to act.",
      goal: "Gate admin functions with a capability struct.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `public struct AdminCap has key, store {
    id: UID,
}

public entry fun set_fee(
    _cap: &AdminCap,
    pool: &mut Pool,
    fee: u64,
) {
    pool.fee = fee;
}`,
        },
        {
          type: "prose",
          text: "A capability is a special object that proves you have permission. Instead of checking a hard-coded admin address, you require &_cap: whoever includes the real AdminCap object in their transaction is treated as admin. If they do not own it, they cannot call the function.",
        },
        {
          type: "prose",
          text: "Taking &_cap (a reference) instead of consuming the cap lets the same AdminCap authorize many transactions over time. Transfer the cap object only when changing who is admin — it is as powerful as a root password.",
        },
      ],
    },
    {
      id: "cap-witness",
      title: "One-time witness (OTW)",
      duration: "14 min",
      summary: "Mint exactly once at publish — used for currencies.",
      goal: "Understand MY_TOKEN has drop {} and is consumed once.",
      blocks: [
        {
          type: "code",
          language: "move",
          code: `module my_package::my_token;

public struct MY_TOKEN has drop {}

fun init(witness: MY_TOKEN, ctx: &mut TxContext) {
    // witness consumed here — can never create MY_TOKEN again
    let (treasury, metadata) = coin::create_currency(
        witness,
        9,
        b"MT",
        b"My Token",
        b"",
        ctx,
    );
    transfer::public_transfer(treasury, tx_context::sender(ctx));
    transfer::public_freeze_object(metadata);
}`,
        },
        {
          type: "tip",
          tone: "warning",
          text: "OTW struct name must match package name in ALL_CAPS. init runs once at publish.",
        },
      ],
    },
    {
      id: "cap-init",
      title: "The init function",
      duration: "10 min",
      summary: "Runs automatically when package is published.",
      goal: "Set up treasury, admin cap, or shared state at deploy.",
      blocks: [
        {
          type: "prose",
          text: "fun init(ctx: &mut TxContext) or fun init(otw: OTW, ctx: &mut TxContext) is called exactly once. Use it to mint caps and transfer to deployer.",
        },
      ],
    },
    {
      id: "cap-two-step",
      title: "Two-step admin transfer",
      duration: "8 min",
      summary: "Avoid sending AdminCap to wrong address.",
      goal: "Know why protocols use pending + accept pattern.",
      blocks: [
        {
          type: "prose",
          text: "Advanced pattern: propose new admin, new admin accepts. Prevents typo addresses receiving irreversible caps.",
        },
      ],
    },
    {
      id: "cap-upgrade",
      title: "UpgradeCap",
      duration: "10 min",
      summary: "Who can change your published package code.",
      goal: "Locate UpgradeCap after publish and store it safely.",
      blocks: [
        {
          type: "list",
          items: [
            "Publish returns UpgradeCap to sender.",
            "Compatible upgrade — fix bugs, add functions.",
            "Immutable publish — no cap, code frozen forever.",
          ],
        },
      ],
    },
    {
      id: "cap-publisher",
      title: "Publisher object",
      duration: "10 min",
      summary: "Proves your package published a type — needed for Display.",
      goal: "Know Publisher is created at publish for each module.",
      blocks: [
        {
          type: "prose",
          text: "When you publish, Sui mints a Publisher per module. Hold it to create Display<T> or prove type ownership. Transfer to project admin wallet.",
        },
        {
          type: "code",
          language: "move",
          code: `use sui::package::Publisher;

public fun setup_display(
    publisher: &Publisher,
    ctx: &mut TxContext,
) {
    // display::new<MyType>(publisher, ctx) requires Publisher
}`,
        },
      ],
    },
    {
      id: "cap-shared-admin",
      title: "Shared vs owned caps",
      duration: "12 min",
      summary: "Where you store AdminCap affects who can call admin functions.",
      goal: "Choose owned cap vs shared cap deliberately.",
      blocks: [
        {
          type: "compare",
          badLabel: "Risky default",
          goodLabel: "Common pattern",
          bad: "share_object(AdminCap) — anyone could pass reference if logic is wrong.",
          good: "Owned AdminCap in multisig — entry fn takes &AdminCap from tx input.",
        },
        {
          type: "prose",
          text: "Most protocols keep caps owned. Shared caps appear in DAO designs where on-chain voting wraps admin calls.",
        },
      ],
      exercise: {
        prompt: "Why does set_fee take &_cap instead of consuming AdminCap?",
        hint: "Think reuse across many admin transactions.",
        solution: "A reference lets the same AdminCap authorize many calls without transferring or recreating it each time.",
      },
    },
  ],
};