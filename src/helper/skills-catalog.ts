export type SkillCategory =
  | "sui"
  | "walrus"
  | "move"
  | "agent"
  | "general";

export interface SkillCatalogEntry {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  accent: string;
  content: string;
  source?: "builtin" | "walrus-official";
}

export const SKILLS_CATALOG: SkillCatalogEntry[] = [
  {
    id: "sui-move-reviewer",
    name: "Sui Move Reviewer",
    description:
      "Reviews Move packages for security issues, gas efficiency, and Sui idioms. Use when auditing or reviewing Move code.",
    category: "move",
    accent: "#4ca3ff",
    content: `# Sui Move Reviewer

When reviewing Move code, follow this checklist:

1. **Access control** — verify \`assert!\` guards on admin/owner capabilities.
2. **Object ownership** — confirm transferred objects have correct ownership (owned vs shared vs frozen).
3. **Coin handling** — check \`coin::split\`, \`balance\`, and \`transfer\` patterns; no value leaks.
4. **Events** — ensure important state changes emit events for indexers.
5. **Upgrade policy** — note whether the package uses an \`UpgradeCap\` and who holds it.
6. **Gas** — flag unbounded loops, large vector copies, and redundant storage reads.

Output format:
- **Summary** (1-2 sentences)
- **Critical** issues (must fix)
- **Warnings** (should fix)
- **Suggestions** (nice to have)
`,
  },
  {
    id: "walrus-memory-agent",
    name: "Walrus Memory Agent",
    description:
      "Guides agents to recall context before work and remember decisions after changes. Use on Beluga projects with linked Walrus memory.",
    category: "walrus",
    accent: "#00d4aa",
    source: "builtin",
    content: `# Walrus Memory Agent

## Session start
1. Call \`recall()\` with query: "architecture decisions history changes"
2. Read WALRUS.md and CLAUDE.md in the project root.

## During work
- Before editing files: recall relevant context for the area you are changing.
- After meaningful changes: call \`remember()\` with a concise summary (what, why, files touched).

## What to remember
- Architecture decisions and trade-offs
- API contracts and breaking changes
- Bug fixes and root causes
- Deployment/network configuration choices

Never skip remember() after file_write — context is lost across sessions without it.
`,
  },
  {
    id: "sui-tx-builder",
    name: "Sui Transaction Builder",
    description:
      "Helps construct and debug Sui PTB transactions with @mysten/sui SDK. Use when writing publish, mint, or custom Move calls.",
    category: "sui",
    accent: "#6c63ff",
    content: `# Sui Transaction Builder

## Workflow
1. Identify the target function (package ID, module, function name, type args).
2. Build with \`Transaction\` from \`@mysten/sui/transactions\`.
3. Set sender, gas budget, and gas payment coins.
4. Simulate before signing; surface clear errors for missing objects or type mismatches.

## Checklist
- Package ID matches the target network (mainnet/testnet/devnet/localnet).
- Object arguments use correct mutability (immutable vs mutable refs).
- Coin inputs are split correctly; change returned to sender.
- For publish: handle \`UpgradeCap\` and initial shared objects.

Prefer \`client.core\` / gRPC APIs when available; fall back to JSON-RPC for localnet.
`,
  },
  {
    id: "beluga-project-scaffold",
    name: "Beluga Project Scaffold",
    description:
      "Helps agents orient in Beluga-managed projects: beluga.json links, MCP tools, and standard agent files.",
    category: "agent",
    accent: "#ffb347",
    content: `# Beluga Project Scaffold

## Project layout
- \`beluga.json\` — metadata, linked memories, packages, and skills
- \`WALRUS.md\` — Walrus memory workflow
- \`CLAUDE.md\` — agent behavior rules
- \`README.md\` — human-readable overview

## MCP tools available
- \`project_open\` — load tree + memory credentials + attached skills
- \`file_read\` / \`file_write\` — project files (write auto-remembers)
- \`recall\` / \`remember\` — Walrus memory (requires credentials from project_open)
- \`skill_get\` — fetch full instructions for an attached skill

## On project open
1. Read attached skills and follow their instructions.
2. Recall Walrus memory before making changes.
3. Respect linked package versions in package.json when adding dependencies.
`,
  },
  {
    id: "nft-collection-deploy",
    name: "NFT Collection Deploy",
    description:
      "End-to-end flow for generative NFT collections on Sui with Walrus image storage. Use in Beluga NFT Manager projects.",
    category: "sui",
    accent: "#ff6b9d",
    content: `# NFT Collection Deploy

## Pre-deploy
1. Composite preview images and verify trait rarity distribution.
2. Upload images/metadata to Walrus (testnet/mainnet only).
3. Build Move package with collection cap, display, and mint functions.

## Deploy steps
1. Publish package on the correct network.
2. Wait for package indexing before mint transactions.
3. Mint with metadata URIs pointing to Walrus aggregator URLs.

## Post-deploy
- Verify Display object fields on-chain.
- Test a single mint before batch minting.
- Remember collection ID, package ID, and Walrus blob IDs in project memory.
`,
  },
];

export function getBuiltinCatalogEntry(
  id: string,
): SkillCatalogEntry | undefined {
  return SKILLS_CATALOG.find((entry) => entry.id === id);
}

export function listBuiltinCatalog() {
  return SKILLS_CATALOG.map(({ content: _content, ...rest }) => ({
    ...rest,
    source: rest.source ?? "builtin",
  }));
}