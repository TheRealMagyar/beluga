export type PackageCategory =
  | "core"
  | "wallet"
  | "storage"
  | "payments"
  | "tooling";

export interface PackageCatalogEntry {
  id: string;
  name: string;
  description: string;
  category: PackageCategory;
  dependencies: Record<string, string>;
  devDependencies?: Record<string, string>;
  docsUrl: string;
  installCommand: string;
  accent: string;
  source?: "builtin" | "custom";
  createdAt?: number;
  updatedAt?: number;
}

export const PACKAGE_CATALOG: PackageCatalogEntry[] = [
  {
    id: "sui-sdk",
    name: "Sui SDK",
    description:
      "Official TypeScript SDK for interacting with the Sui blockchain.",
    category: "core",
    dependencies: { "@mysten/sui": "latest" },
    docsUrl: "https://sdk.mystenlabs.com/typescript",
    installCommand: "npm i @mysten/sui",
    accent: "#4ca3ff",
  },
  {
    id: "bcs",
    name: "Binary Canonical Serialization",
    description:
      "BCS encoding and decoding for Sui Move types and transaction data.",
    category: "core",
    dependencies: { "@mysten/bcs": "latest" },
    docsUrl: "https://sdk.mystenlabs.com/bcs",
    installCommand: "npm i @mysten/bcs",
    accent: "#6c63ff",
  },
  {
    id: "codegen",
    name: "Sui TypeScript Codegen",
    description:
      "Generate TypeScript bindings from published Move packages.",
    category: "tooling",
    devDependencies: { "@mysten/codegen": "latest" },
    dependencies: {},
    docsUrl: "https://sdk.mystenlabs.com/typescript/codegen",
    installCommand: "npm install -D @mysten/codegen",
    accent: "#00d4aa",
  },
  {
    id: "dapp-kit-react",
    name: "dApp Kit (React)",
    description:
      "React hooks and components for wallet connection and transactions.",
    category: "wallet",
    dependencies: {
      "@mysten/dapp-kit-react": "latest",
      "@mysten/sui": "latest",
    },
    docsUrl: "https://sdk.mystenlabs.com/dapp-kit",
    installCommand: "npm i @mysten/dapp-kit-react @mysten/sui",
    accent: "#4ca3ff",
  },
  {
    id: "dapp-kit-core",
    name: "dApp Kit (Vanilla JS)",
    description:
      "Framework-agnostic wallet and transaction utilities for any frontend.",
    category: "wallet",
    dependencies: {
      "@mysten/dapp-kit-core": "latest",
      "@mysten/sui": "latest",
    },
    docsUrl: "https://sdk.mystenlabs.com/dapp-kit",
    installCommand: "npm i @mysten/dapp-kit-core @mysten/sui",
    accent: "#1a6fff",
  },
  {
    id: "kiosk",
    name: "Kiosk SDK",
    description: "Build and interact with Sui Kiosk marketplace listings.",
    category: "payments",
    dependencies: { "@mysten/kiosk": "latest" },
    docsUrl: "https://sdk.mystenlabs.com/kiosk",
    installCommand: "npm i @mysten/kiosk",
    accent: "#ffb347",
  },
  {
    id: "payment-kit",
    name: "Payment Kit",
    description: "Accept and send payments on Sui with a high-level API.",
    category: "payments",
    dependencies: {
      "@mysten/payment-kit": "latest",
      "@mysten/sui": "latest",
    },
    docsUrl: "https://sdk.mystenlabs.com/payment-kit",
    installCommand: "npm install --save @mysten/payment-kit @mysten/sui",
    accent: "#00d4aa",
  },
  {
    id: "slush-wallet",
    name: "Slush Wallet",
    description: "Integrate Slush wallet connectivity into your application.",
    category: "wallet",
    dependencies: { "@mysten/slush-wallet": "latest" },
    docsUrl: "https://sdk.mystenlabs.com/slush-wallet",
    installCommand: "pnpm install @mysten/slush-wallet",
    accent: "#9d97ff",
  },
  {
    id: "walrus",
    name: "Walrus SDK",
    description: "Store and retrieve blobs on the Walrus decentralized network.",
    category: "storage",
    dependencies: {
      "@mysten/walrus": "latest",
      "@mysten/sui": "latest",
    },
    docsUrl: "https://sdk.mystenlabs.com/walrus",
    installCommand: "npm install --save @mysten/walrus @mysten/sui",
    accent: "#4ca3ff",
  },
  {
    id: "zksend",
    name: "zkSend",
    description: "Private transfers and zkSend flows on Sui.",
    category: "payments",
    dependencies: {
      "@mysten/zksend": "latest",
      "@mysten/sui": "latest",
    },
    docsUrl: "https://sdk.mystenlabs.com/zksend",
    installCommand: "npm i @mysten/zksend @mysten/sui",
    accent: "#6c63ff",
  },
  {
    id: "sponsor",
    name: "Sponsor",
    description: "Sponsored transaction toolkit for gasless user experiences.",
    category: "tooling",
    dependencies: {
      "@mysten-incubation/sponsor": "latest",
      "@mysten/sui": "latest",
    },
    docsUrl: "https://www.npmjs.com/package/@mysten-incubation/sponsor",
    installCommand: "npm i @mysten-incubation/sponsor @mysten/sui",
    accent: "#ff6b6b",
  },
  {
    id: "deepbook-v3",
    name: "DeepBook v3",
    description:
      "Official SDK for DeepBook limit orders, balance managers, and pool trading on Sui.",
    category: "payments",
    dependencies: {
      "@mysten/deepbook-v3": "latest",
      "@mysten/sui": "latest",
    },
    docsUrl: "https://docs.sui.io/onchain-finance/deepbookv3-sdk/",
    installCommand: "npm i @mysten/deepbook-v3 @mysten/sui",
    accent: "#34d399",
  },
  {
    id: "ika-sdk",
    name: "Ika SDK",
    description:
      "Cross-chain dWallet SDK for native signing across Sui and other chains.",
    category: "wallet",
    dependencies: { "@ika.xyz/sdk": "latest" },
    docsUrl: "https://docs.ika.xyz/docs/sdk",
    installCommand: "npm i @ika.xyz/sdk",
    accent: "#00e5ff",
  },
  {
    id: "t2000",
    name: "T2000 SDK",
    description:
      "Agent wallet SDK for payments, identity, and on-chain automation.",
    category: "tooling",
    dependencies: { "@t2000/sdk": "latest" },
    docsUrl: "https://developers.t2000.ai/agent-sdk",
    installCommand: "npm i @t2000/sdk",
    accent: "#4ca3ff",
  },
];

export function listBuiltinCatalog(): PackageCatalogEntry[] {
  return PACKAGE_CATALOG.map((entry) => ({
    ...entry,
    source: "builtin" as const,
  }));
}

export function getBuiltinCatalogEntry(
  id: string,
): PackageCatalogEntry | undefined {
  const entry = PACKAGE_CATALOG.find((item) => item.id === id);
  return entry ? { ...entry, source: "builtin" as const } : undefined;
}

/** @deprecated Use resolveCatalogEntry from custom-package-manager */
export function getCatalogEntry(id: string): PackageCatalogEntry | undefined {
  return getBuiltinCatalogEntry(id);
}