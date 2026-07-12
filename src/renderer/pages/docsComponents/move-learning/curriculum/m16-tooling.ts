import type { MoveModule } from "./types";

export const MODULE_TOOLING: MoveModule = {
  id: "tooling",
  order: 16,
  title: "CLI & Tooling",
  description: "sui move, sui client, builds, and Beluga workflow.",
  accent: "#94a3b8",
  icon: "🛠️",
  lessons: [
    {
      id: "tool-move-build",
      title: "sui move build",
      duration: "10 min",
      summary: "Compile without publishing.",
      goal: "Run build from terminal and read output.",
      blocks: [
        {
          type: "steps",
          steps: [
            { title: "cd package root", body: "Where Move.toml lives." },
            { title: "sui move build", body: "Compiles to build/artifacts." },
            { title: "Fix errors", body: "Compiler points to file:line." },
          ],
        },
      ],
    },
    {
      id: "tool-move-test",
      title: "sui move test",
      duration: "8 min",
      summary: "Run all #[test] in package.",
      goal: "Use filters: sui move test counter_tests.",
      blocks: [
        {
          type: "code",
          language: "shell",
          code: `sui move test
sui move test -f test_increment
sui move test --coverage`,
        },
      ],
    },
    {
      id: "tool-client",
      title: "sui client basics",
      duration: "12 min",
      summary: "Addresses, gas, objects, simulate.",
      goal: "Inspect objects and dry-run transactions.",
      blocks: [
        {
          type: "list",
          items: [
            "sui client active-address — current wallet.",
            "sui client gas — coin objects for gas.",
            "sui client objects — owned object list.",
            "sui client call --dry-run — simulate without commit.",
            "sui client publish — deploy package.",
          ],
        },
      ],
    },
    {
      id: "tool-editions",
      title: "Move editions",
      duration: "10 min",
      summary: "2024.beta vs legacy in Move.toml.",
      goal: "Match edition to syntax you write.",
      blocks: [
        {
          type: "code",
          language: "toml",
          code: `[package]
name = "my_package"
edition = "2024.beta"`,
        },
        {
          type: "tip",
          tone: "warning",
          text: "New packages should use 2024.beta — enables match, improved errors, and modern patterns.",
        },
      ],
    },
    {
      id: "tool-beluga",
      title: "Beluga workflow map",
      duration: "10 min",
      summary: "Projects, Playground, Console, Memory.",
      goal: "Know which Beluga page for each task.",
      blocks: [
        {
          type: "list",
          items: [
            "Projects — link repos, skills, packages.",
            "Playground — edit, build, publish to localnet.",
            "Console — logs, localnet, toolchain.",
            "Memory — store package IDs and deploy notes.",
            "Skills — AI helpers like sui-move-reviewer.",
          ],
        },
      ],
    },
    {
      id: "tool-deps",
      title: "Dependencies in Move.toml",
      duration: "10 min",
      summary: "Sui framework version pinning.",
      goal: "Read [dependencies] and [addresses] sections.",
      blocks: [
        {
          type: "code",
          language: "toml",
          code: `[dependencies]
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "framework/mainnet" }

[addresses]
my_package = "0x0"`,
        },
      ],
    },
  ],
};