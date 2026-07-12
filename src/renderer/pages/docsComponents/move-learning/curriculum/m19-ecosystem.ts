import type { MoveModule } from "./types";

export const MODULE_ECOSYSTEM: MoveModule = {
  id: "ecosystem",
  order: 19,
  title: "Sui Ecosystem",
  description: "Walrus, indexers, GraphQL, and off-chain data.",
  accent: "#38bdf8",
  icon: "🌐",
  lessons: [
    {
      id: "eco-indexers",
      title: "Indexers & events",
      duration: "12 min",
      summary: "How apps read chain state at scale.",
      goal: "Design packages so indexers can follow your protocol.",
      blocks: [
        {
          type: "list",
          items: [
            "Emit events on every state change users care about.",
            "Include package ID + module version in your docs.",
            "Sui GraphQL RPC — query objects, txs, checkpoints.",
            "Custom indexers — subscribe to event streams.",
          ],
        },
      ],
    },
    {
      id: "eco-graphql",
      title: "GraphQL queries (overview)",
      duration: "10 min",
      summary: "Read objects without running a full node app.",
      goal: "Know when frontend uses GraphQL vs wallet RPC.",
      blocks: [
        {
          type: "prose",
          text: "Frontends query object fields, transaction blocks, and balances via Sui GraphQL. Your Move code does not call GraphQL — it's off-chain read layer.",
        },
      ],
    },
    {
      id: "eco-walrus",
      title: "Walrus decentralized storage",
      duration: "14 min",
      summary: "Store blobs off-chain, anchor on Sui.",
      goal: "Connect Walrus skills in Beluga Projects.",
      blocks: [
        {
          type: "steps",
          steps: [
            { title: "Blob stored on Walrus", body: "Images, large metadata, AI memory." },
            { title: "Blob ID on-chain", body: "Sui object or field references Walrus ID." },
            { title: "Skills in Beluga", body: "vendor/walrus-skills — upload, read, pin." },
          ],
        },
        {
          type: "tip",
          tone: "success",
          text: "Link mystenlabs/walrus-skills template in Projects for AI-assisted Walrus workflows.",
        },
      ],
    },
    {
      id: "eco-enoki",
      title: "Sponsored transactions (Enoki)",
      duration: "10 min",
      summary: "Apps pay gas for users.",
      goal: "Understand why entry design matters for sponsorship.",
      blocks: [
        {
          type: "prose",
          text: "Enoki and similar services sponsor gas so users don't need SUI for first interaction. Your entry functions must be sponsor-safe — no unrestricted transfers to arbitrary addresses from sponsored txs without checks.",
        },
      ],
    },
    {
      id: "eco-networks",
      title: "localnet · testnet · mainnet",
      duration: "10 min",
      summary: "Where to develop and deploy.",
      goal: "Pick the right network per stage.",
      blocks: [
        {
          type: "list",
          items: [
            "localnet — Beluga Console, free, fast iteration.",
            "testnet — public, faucet SUI, share with testers.",
            "mainnet — real value; audit first.",
            "Package IDs differ per network — store each in Memory.",
          ],
        },
      ],
    },
    {
      id: "eco-explorer",
      title: "Reading explorers",
      duration: "8 min",
      summary: "Suiscan, SuiVision — verify publish.",
      goal: "Find package, objects, and events after deploy.",
      blocks: [
        {
          type: "steps",
          steps: [
            { title: "Paste package ID", body: "From publish output." },
            { title: "Modules tab", body: "Verify functions published." },
            { title: "Events tab", body: "Confirm emits after test tx." },
          ],
        },
      ],
    },
  ],
};