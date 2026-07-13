import type { BelugaToolDefinition } from "./beluga-tool-catalog";

const emptySchema = { type: "object", properties: {} } as const;

export const PLAYGROUND_TOOLS: BelugaToolDefinition[] = [
  {
    name: "playground_get_status",
    description:
      "Returns Sui CLI status, active client environment, and localnet RPC readiness.",
    inputSchema: emptySchema,
  },
  {
    name: "playground_get_workspace",
    description: "Returns the Playground Move workspace directory path.",
    inputSchema: emptySchema,
  },
  {
    name: "playground_write_files",
    description:
      "Write Move/source files into the Playground workspace before build or publish.",
    inputSchema: {
      type: "object",
      required: ["files"],
      properties: {
        files: {
          type: "array",
          description: "Array of { path, content } relative to workspace root",
          items: {
            type: "object",
            properties: {
              path: { type: "string" },
              content: { type: "string" },
            },
          },
        },
      },
    },
  },
  {
    name: "playground_build",
    description: "Compile Move package in Playground workspace. Returns bytecode modules.",
    inputSchema: {
      type: "object",
      required: ["files"],
      properties: {
        files: {
          type: "array",
          items: {
            type: "object",
            properties: {
              path: { type: "string" },
              content: { type: "string" },
            },
          },
        },
      },
    },
  },
  {
    name: "playground_publish",
    description:
      "Build and publish Move package from Playground to chain. Requires wallet. Uses localnet if running, else testnet unless network specified.",
    inputSchema: {
      type: "object",
      required: ["files"],
      properties: {
        files: {
          type: "array",
          items: {
            type: "object",
            properties: {
              path: { type: "string" },
              content: { type: "string" },
            },
          },
        },
        network: {
          type: "string",
          enum: ["mainnet", "testnet", "devnet", "localnet"],
        },
      },
    },
  },
  {
    name: "playground_start_sui_localnet",
    description: "Start Sui localnet (optionally with faucet).",
    inputSchema: {
      type: "object",
      properties: {
        with_faucet: { type: "boolean" },
        force_regenesis: { type: "boolean" },
        for_ika: { type: "boolean", description: "Tune epoch for Ika dWallet" },
      },
    },
  },
  {
    name: "playground_stop_sui_localnet",
    description: "Stop Sui localnet (and Ika by default).",
    inputSchema: {
      type: "object",
      properties: {
        stop_ika: { type: "boolean" },
      },
    },
  },
  {
    name: "playground_reset_sui_localnet",
    description: "Reset Move/Sui localnet state.",
    inputSchema: emptySchema,
  },
  {
    name: "playground_request_faucet",
    description: "Request SUI from localnet faucet for wallet or given address.",
    inputSchema: {
      type: "object",
      properties: {
        recipient: { type: "string" },
      },
    },
  },
  {
    name: "playground_get_localnet_logs",
    description: "Read recent Sui and Ika localnet log lines.",
    inputSchema: {
      type: "object",
      properties: {
        tail: { type: "number", description: "Max lines per source (default 80)" },
      },
    },
  },
  {
    name: "playground_get_localnet_overview",
    description: "Localnet network overview, stats, and resume status.",
    inputSchema: emptySchema,
  },
  {
    name: "playground_list_wallets",
    description:
      "List Beluga + playground test wallets on localnet with addresses and SUI balances. Use before inspecting assets.",
    inputSchema: emptySchema,
  },
  {
    name: "playground_get_wallet_assets",
    description:
      "Inspect a localnet wallet: aggregated coin balances, individual coin object IDs, and owned NFTs/objects (with display metadata). Requires localnet running.",
    inputSchema: {
      type: "object",
      properties: {
        address: {
          type: "string",
          description:
            "0x wallet address. Omit to use the active playground signer.",
        },
      },
    },
  },
  {
    name: "playground_start_ika_localnet",
    description: "Start Ika localnet (dWallet protocol). Auto-heals if needed.",
    inputSchema: {
      type: "object",
      properties: {
        reset: { type: "boolean" },
      },
    },
  },
  {
    name: "playground_stop_ika_localnet",
    description: "Stop Ika localnet process.",
    inputSchema: emptySchema,
  },
  {
    name: "playground_start_ika_stack",
    description: "Start full Ika stack (Sui localnet + Ika + bootstrap).",
    inputSchema: emptySchema,
  },
  {
    name: "playground_stop_ika_stack",
    description: "Stop full Ika localnet stack.",
    inputSchema: emptySchema,
  },
  {
    name: "playground_reset_ika_stack",
    description: "Reset Ika localnet stack (destructive).",
    inputSchema: emptySchema,
  },
  {
    name: "playground_heal_ika",
    description: "Heal/repair Ika localnet environment.",
    inputSchema: emptySchema,
  },
  {
    name: "playground_get_ika_status",
    description: "Ika localnet status including dWallet readiness.",
    inputSchema: emptySchema,
  },
  {
    name: "playground_get_ika_explorer",
    description: "Ika explorer overview (packages, coordinator, dWallet state).",
    inputSchema: emptySchema,
  },
  {
    name: "playground_create_dwallet",
    description:
      "Create a shared Ika dWallet on localnet. Requires Ika stack ready and wallet with SUI. Takes several minutes.",
    inputSchema: {
      type: "object",
      properties: {
        curve: {
          type: "string",
          enum: ["secp256k1", "secp256r1", "ed25519", "ristretto"],
        },
      },
    },
  },
  {
    name: "playground_list_dwallets",
    description: "List dWallet caps owned by the connected wallet on localnet.",
    inputSchema: emptySchema,
  },
  {
    name: "playground_defi_deploy_sandbox",
    description:
      "Build and publish the beluga_defi sandbox package (AMM pool + TA/TB faucets). Requires wallet. Uses current network (localnet/testnet; not mainnet). Saves deployment for UI and later DeFi tools.",
    inputSchema: {
      type: "object",
      properties: {
        network: {
          type: "string",
          enum: ["localnet", "testnet", "devnet"],
          description: "Optional; defaults to wallet network",
        },
      },
    },
  },
  {
    name: "playground_defi_get_deployment",
    description:
      "Return saved DeFi sandbox deployment (package ID, faucet IDs, pools, active pool).",
    inputSchema: emptySchema,
  },
  {
    name: "playground_defi_create_pool",
    description:
      "Create a new AMM pool for a coin pair on the deployed beluga_defi package. Coin refs: sui, ta, tb, or full type strings.",
    inputSchema: {
      type: "object",
      required: ["coin_a", "coin_b"],
      properties: {
        coin_a: {
          type: "string",
          description: 'e.g. "sui", "ta", or full coin type',
        },
        coin_b: {
          type: "string",
          description: 'e.g. "tb", "sui", or full coin type',
        },
      },
    },
  },
  {
    name: "playground_defi_faucet",
    description:
      "Mint sandbox TA/TB tokens from package faucets into the connected wallet.",
    inputSchema: {
      type: "object",
      properties: {
        token: {
          type: "string",
          enum: ["a", "b", "both", "ta", "tb", "token_a", "token_b"],
          description: 'Which faucet (default "both")',
        },
        amount: {
          type: "string",
          description: 'Human amount when token is a/b (default "1000")',
        },
        amount_a: { type: "string", description: "TA amount when token is both" },
        amount_b: { type: "string", description: "TB amount when token is both" },
      },
    },
  },
  {
    name: "playground_defi_add_liquidity",
    description:
      "Add liquidity to the active pool (or pool_id). Amounts are human-readable (e.g. \"1\", \"100\").",
    inputSchema: {
      type: "object",
      required: ["amount_a", "amount_b"],
      properties: {
        amount_a: { type: "string" },
        amount_b: { type: "string" },
        pool_id: { type: "string", description: "Optional pool object ID" },
      },
    },
  },
  {
    name: "playground_defi_swap",
    description:
      "Swap on the DeFi sandbox AMM. direction: a_for_b (sell A for B) or b_for_a. Uses 1% slippage by default.",
    inputSchema: {
      type: "object",
      required: ["direction", "amount_in"],
      properties: {
        direction: {
          type: "string",
          enum: ["a_for_b", "b_for_a", "a-for-b", "b-for-a"],
        },
        amount_in: { type: "string", description: "Human-readable input amount" },
        pool_id: { type: "string" },
        slippage_bps: {
          type: "number",
          description: "Slippage tolerance in basis points (default 100 = 1%)",
        },
      },
    },
  },
  {
    name: "playground_defi_get_pool_snapshot",
    description:
      "Read pool reserves and wallet balances for active pool or given pool_id.",
    inputSchema: {
      type: "object",
      properties: {
        pool_id: { type: "string" },
      },
    },
  },
  {
    name: "playground_defi_list_pools",
    description: "List all sandbox pools with reserves and active pool marker.",
    inputSchema: emptySchema,
  },
  {
    name: "playground_defi_set_active_pool",
    description: "Set which pool is used for swap and add-liquidity when pool_id is omitted.",
    inputSchema: {
      type: "object",
      required: ["pool_id"],
      properties: {
        pool_id: { type: "string" },
      },
    },
  },
  {
    name: "playground_ptb_get_draft",
    description: "Return the saved PTB Playground draft (steps JSON + human preview).",
    inputSchema: emptySchema,
  },
  {
    name: "playground_ptb_set_draft",
    description:
      "Replace the PTB Playground draft. Steps support moveCall, splitCoins, mergeCoins, transferObjects with gas/object/pure/ref arguments.",
    inputSchema: {
      type: "object",
      required: ["draft"],
      properties: {
        draft: {
          type: "object",
          description: "{ name, steps[] } — same shape as PTB Playground localStorage draft",
        },
      },
    },
  },
  {
    name: "playground_ptb_list_templates",
    description: "List built-in PTB templates (split/transfer SUI, merge, move call, etc.).",
    inputSchema: emptySchema,
  },
  {
    name: "playground_ptb_load_template",
    description: "Load a built-in PTB template into the playground draft.",
    inputSchema: {
      type: "object",
      required: ["template_id"],
      properties: {
        template_id: {
          type: "string",
          enum: [
            "split-transfer-sui",
            "merge-coins",
            "move-call",
            "split-merge-transfer",
          ],
        },
      },
    },
  },
  {
    name: "playground_ptb_preview",
    description: "Preview a PTB draft as human-readable steps without executing.",
    inputSchema: {
      type: "object",
      properties: {
        draft: { type: "object", description: "Optional; defaults to saved draft" },
      },
    },
  },
  {
    name: "playground_ptb_execute",
    description:
      "Build, sign, and execute a PTB. Uses saved draft unless draft is passed. Requires wallet.",
    inputSchema: {
      type: "object",
      properties: {
        draft: { type: "object" },
        network: {
          type: "string",
          enum: ["localnet", "testnet", "devnet", "mainnet"],
        },
      },
    },
  },
];

export const PACKAGES_TOOLS: BelugaToolDefinition[] = [
  {
    name: "packages_list_catalog",
    description:
      "List all packages (built-in SDK catalog + user custom bundles).",
    inputSchema: emptySchema,
  },
  {
    name: "packages_list_custom",
    description: "List user-defined custom package bundles only.",
    inputSchema: emptySchema,
  },
  {
    name: "packages_create_custom",
    description:
      "Create a custom package bundle combining multiple npm dependencies.",
    inputSchema: {
      type: "object",
      required: ["name", "description", "dependencies"],
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        id: { type: "string", description: "Optional slug id" },
        dependencies: {
          type: "object",
          additionalProperties: { type: "string" },
        },
        dev_dependencies: {
          type: "object",
          additionalProperties: { type: "string" },
        },
        category: {
          type: "string",
          enum: ["core", "wallet", "storage", "payments", "tooling"],
        },
        docs_url: { type: "string" },
      },
    },
  },
  {
    name: "packages_update_custom",
    description: "Update a custom package bundle by id.",
    inputSchema: {
      type: "object",
      required: ["package_id"],
      properties: {
        package_id: { type: "string" },
        name: { type: "string" },
        description: { type: "string" },
        dependencies: {
          type: "object",
          additionalProperties: { type: "string" },
        },
        dev_dependencies: {
          type: "object",
          additionalProperties: { type: "string" },
        },
        category: {
          type: "string",
          enum: ["core", "wallet", "storage", "payments", "tooling"],
        },
        docs_url: { type: "string" },
      },
    },
  },
  {
    name: "packages_delete_custom",
    description: "Delete a custom package bundle (does not remove npm from projects).",
    inputSchema: {
      type: "object",
      required: ["package_id"],
      properties: {
        package_id: { type: "string" },
      },
    },
  },
  {
    name: "packages_list_installed",
    description: "List installed Beluga-managed packages.",
    inputSchema: emptySchema,
  },
  {
    name: "packages_get_toolchain_status",
    description: "Rust, Sui CLI, suiup, and Ika toolchain install status.",
    inputSchema: emptySchema,
  },
  {
    name: "packages_install",
    description: "Install a catalog package by id (e.g. sui-sdk, ika-sdk).",
    inputSchema: {
      type: "object",
      required: ["package_id"],
      properties: {
        package_id: { type: "string" },
      },
    },
  },
  {
    name: "packages_update",
    description: "Update an installed catalog package.",
    inputSchema: {
      type: "object",
      required: ["package_id"],
      properties: {
        package_id: { type: "string" },
      },
    },
  },
  {
    name: "packages_uninstall",
    description: "Uninstall a catalog package from Beluga store.",
    inputSchema: {
      type: "object",
      required: ["package_id"],
      properties: {
        package_id: { type: "string" },
      },
    },
  },
  {
    name: "packages_install_to_project",
    description:
      "npm install linked catalog packages into a project directory (needs package.json).",
    inputSchema: {
      type: "object",
      required: ["project_name", "package_ids"],
      properties: {
        project_name: { type: "string" },
        package_ids: { type: "array", items: { type: "string" } },
      },
    },
  },
  {
    name: "packages_link_to_project",
    description:
      "Link package ids in project beluga.json and optionally npm install them.",
    inputSchema: {
      type: "object",
      required: ["project_name", "package_ids"],
      properties: {
        project_name: { type: "string" },
        package_ids: { type: "array", items: { type: "string" } },
        install: { type: "boolean", description: "Run npm install after linking" },
      },
    },
  },
  {
    name: "packages_unlink_from_project",
    description: "Remove package ids from project beluga.json (does not uninstall npm).",
    inputSchema: {
      type: "object",
      required: ["project_name", "package_ids"],
      properties: {
        project_name: { type: "string" },
        package_ids: { type: "array", items: { type: "string" } },
      },
    },
  },
];

export const BELUGA_APP_TOOLS: BelugaToolDefinition[] = [
  {
    name: "tool_scan_token",
    description: "Scan a Sui token for mint authority, upgrades, and risk signals.",
    inputSchema: {
      type: "object",
      required: ["input"],
      properties: {
        input: { type: "string", description: "Coin type or package id" },
        network: {
          type: "string",
          enum: ["mainnet", "testnet", "devnet", "localnet"],
        },
      },
    },
  },
  {
    name: "tool_build_token_package",
    description: "Generate Move token package files from config (does not deploy).",
    inputSchema: {
      type: "object",
      required: ["config"],
      properties: {
        config: { type: "object", description: "TokenGeneratorConfig JSON" },
      },
    },
  },
  {
    name: "tool_build_nft_package",
    description: "Generate NFT collection Move package from config.",
    inputSchema: {
      type: "object",
      required: ["config"],
      properties: {
        config: { type: "object", description: "NftContractConfig JSON" },
      },
    },
  },
  {
    name: "tool_list_grpc_catalog",
    description: "List available gRPC query services and methods.",
    inputSchema: emptySchema,
  },
  {
    name: "tool_grpc_query",
    description: "Execute a gRPC query against Sui fullnode.",
    inputSchema: {
      type: "object",
      required: ["network", "service", "method"],
      properties: {
        network: {
          type: "string",
          enum: ["mainnet", "testnet", "devnet", "localnet"],
        },
        service: { type: "string" },
        method: { type: "string" },
        request: { type: "object" },
      },
    },
  },
  {
    name: "tool_fetch_address_graph",
    description: "Fetch transaction graph for a Sui address (tx visualizer).",
    inputSchema: {
      type: "object",
      required: ["address"],
      properties: {
        address: { type: "string" },
        network: {
          type: "string",
          enum: ["mainnet", "testnet", "devnet"],
        },
        limit: { type: "number" },
      },
    },
  },
];

export const WALLET_TOOLS: BelugaToolDefinition[] = [
  {
    name: "wallet_get_info",
    description: "Get connected Beluga wallet address and public key.",
    inputSchema: emptySchema,
  },
  {
    name: "wallet_generate",
    description:
      "Create a new Beluga wallet keypair. Destructive if wallet already exists — confirm with user first.",
    inputSchema: emptySchema,
  },
  {
    name: "wallet_get_balance",
    description: "Get SUI balance for connected wallet on a network.",
    inputSchema: {
      type: "object",
      properties: {
        network: {
          type: "string",
          enum: ["mainnet", "testnet", "devnet", "localnet"],
        },
      },
    },
  },
  {
    name: "wallet_request_faucet",
    description: "Request test SUI from faucet (testnet/devnet/localnet).",
    inputSchema: {
      type: "object",
      required: ["network"],
      properties: {
        network: {
          type: "string",
          enum: ["testnet", "devnet", "localnet"],
        },
        recipient: { type: "string" },
      },
    },
  },
  {
    name: "wallet_send_sui",
    description: "Send SUI to another address. Requires user confirmation.",
    inputSchema: {
      type: "object",
      required: ["to", "amount"],
      properties: {
        to: { type: "string" },
        amount: { type: "string", description: "Amount in SUI" },
        asset: { type: "string", description: "Asset id, default SUI" },
      },
    },
  },
];

export const MCP_TOOL_SETS = {
  core: "core",
  playground: "playground",
  packages: "packages",
  tools: "tools",
  wallet: "wallet",
  all: "all",
} as const;

export type McpToolSetId = keyof typeof MCP_TOOL_SETS;