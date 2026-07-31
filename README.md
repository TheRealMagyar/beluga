# Beluga

**AI-native desktop hub for Sui development and on-chain workflows — Walrus Memory, projects, Move/PTB/DeFi playground, packages, trading tools, and MCP.**

Beluga is an Electron app that ties local workspaces to AI agents through the [Model Context Protocol (MCP)](https://modelcontextprotocol.io). Agents can read and write project files, persist context in [Walrus Memory](https://memory.walrus.xyz), build and publish Move packages, run PTB drafts, deploy a DeFi sandbox, manage SDK bundles, drive Git/GitHub, and use Beluga’s Sui tooling — from one desktop app.

Use Beluga as your daily Sui workspace, or point Claude Desktop, Cursor, VS Code, or any MCP client at Beluga and let an agent operate the toolchain.

---

## What’s inside

| Area | What you get |
|---|---|
| **Memory** | Walrus Memory accounts, encrypted on-chain recall, MCP `remember` / `recall` / `analyze` |
| **Projects** | Local workspaces, templates, `beluga.json` links (memories, packages, skills), Git + GitHub |
| **Skills** | Reusable agent instruction sets; Beluga templates + bundled Walrus skills |
| **Playground** | Move editor, **PTB** builder, **DeFi** AMM sandbox, **Ika** / dWallet localnet |
| **Packages** | Curated Sui SDK catalog, custom npm bundles, toolchain install (Rust / suiup / Sui CLI) |
| **Tools** | Tx visualizer, token scanner, gRPC query builder, token + NFT generators |
| **Trading** | Charts (DeepBook + structure tools + agent), strategy editor, market feeds |
| **AI Assistant** | Built-in Grok/xAI chat with page context and the same MCP tool catalog |
| **Console** | Dedicated terminal window (`node-pty`) next to the GUI |
| **Learning** | Interactive Move curriculum in-app |
| **Wallet** | Mainnet / testnet / localnet; signs publishes, tools, and memory account flows |

---

## Features

### Memory
- Create and manage **Walrus Memory** accounts (mainnet / testnet).
- Encrypted, vectorized, on-chain memory that survives chat resets and model swaps.
- `remember`, `recall`, and `analyze` exposed over MCP for agents.

### Projects
- Local project workspaces with file tree, create / rename / delete.
- Templates: **Empty**, **Vite + React**, **Next.js**, **Sui Move**.
- Link **memories**, **npm package bundles**, and **skills** per project via `beluga.json`.
- Built-in **Git** panel and **GitHub** repo connect / publish flow.

### Skills
- Personal **skills library** — reusable instruction sets for agents.
- Import from **Beluga templates** and official **Walrus skills** (`vendor/walrus-skills`).
- Attach skills to projects; agents load them through `project_open` and `skill_get`.

### Playground
Four tabs (Ika appears when the toolchain is ready):

| Tab | Focus |
|---|---|
| **Move** | Monaco editor, build, publish, entry-function testing; Sui localnet lifecycle (start / stop / reset, faucet, logs, local explorer) |
| **PTB** | Programmable Transaction Block drafts, templates, preview, and execute — also available over MCP |
| **DeFi** | Local **beluga_defi** sandbox (AMM pools, faucets, liquidity, swaps) for agent- and UI-driven DeFi experiments |
| **Ika** | Ika localnet stack, dWallet creation, Ika explorer |

Load Move projects from **Projects** straight into the playground.

### Packages
- **SDK Catalog** — curated Sui ecosystem npm packages (wallet, storage, payments, tooling).
- **Custom Packages** — bundle multiple npm deps into one installable unit; persist, install, link to projects, manage via MCP.
- **Toolchain** — install and update Rust, `suiup`, Sui CLI, Git (Homebrew on macOS), with Beluga-managed fallback paths when system dirs are not writable.

### Tools
- **Transaction Visualizer** — address transfer graph.
- **Token Scanner** — mint authority and risk signals.
- **RPC Query Builder** — Sui gRPC queries with JSON bodies.
- **Token Generator** — deploy a custom coin.
- **NFT Manager** — generative collections, Walrus media upload, contract deploy.

### Trading
Sidebar section for market work that plugs into memory and the wallet:

- **Charts** — multi-symbol charts (crypto / stock / Sui / DeepBook pools), structure tools, trade panel, and a trading agent panel.
- **Strategy** — define entry/exit rules, timeframes, risk params; optionally link a Walrus Memory for session continuity.
- **Feeds** — news, calendar, X watchlist, impact scoring, custom RSS/JSON endpoints.

### AI Assistant
- Built-in chat panel (Grok / xAI) with optional **page context** and **tool use** against Beluga’s MCP catalog.
- Same tools external agents use — no duplicate integration work.

### Console
- Dedicated terminal window (`node-pty`) for CLI workflows alongside the GUI.

### Learning
- Interactive **Move curriculum** built into the app — from first module to capstone.

### Wallet
- Integrated Sui wallet (mainnet, testnet, localnet).
- Pays Walrus Memory account creation; signs playground publishes and tool transactions.
- MCP wallet tools: balance, faucet, send SUI.

---

## Quick start

### 1. Install

| Platform | Download |
|---|---|
| Windows | [Beluga Setup (v1.0.0-beta)](https://github.com/TheRealMagyar/beluga/releases/download/v1.0.0-beta/Beluga-1.0.0.Setup.exe) |
| macOS (Apple Silicon) | [Beluga ZIP (v1.0.0-beta)](https://github.com/TheRealMagyar/beluga/releases/download/v1.0.0-beta/Beluga-darwin-arm64-1.0.0.zip) |

Or build from source — see [Development](#development) below.

### 2. Set up wallet and memory

1. Open Beluga and **create or import a Sui wallet**. Keep a small amount of SUI for Walrus Memory account creation.
2. Go to **Memory** and create or import a Walrus Memory account. Prefer a **delegate key** from the [Walrus Playground](https://memory.walrus.xyz) instead of exposing your main key to agents.
3. Optionally set a **namespace** per memory (default: `default`).

### 3. Create a project

1. Open **Projects** → **New project**.
2. Pick a template (e.g. **Smart contracts** for Move).
3. Link one or more memories, package bundles, and skills.
4. Beluga writes `beluga.json` and starter agent files (`WALRUS.md`, `CLAUDE.md`, etc.).

### 4. Connect an AI agent (MCP)

Beluga starts an MCP HTTP server on port **47823** when the app is running. Configure your client with `mcp-remote`:

**Claude Desktop** — `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "beluga": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://127.0.0.1:47823/mcp",
        "--allow-http"
      ]
    }
  }
}
```

**Cursor / VS Code** — `.cursor/mcp.json` (or global MCP config):

```json
{
  "mcpServers": {
    "beluga": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://127.0.0.1:47823/mcp",
        "--allow-http"
      ]
    }
  }
}
```

> Prefer scoped endpoints when you want fewer tools — see [MCP endpoints](#mcp-endpoints).

Then try: *“Open my project and recall what we decided last session.”*

---

## MCP endpoints

| Endpoint | Tools |
|---|---|
| `/mcp` | Everything (memory, projects, files, skills, Git, GitHub, playground, packages, app tools, wallet) |
| `/mcp/core` | Projects, memory, files, skills |
| `/mcp/playground` | Core + localnet, Move build/publish, DeFi sandbox, PTB, Ika / dWallet |
| `/mcp/packages` | Core + SDK catalog, custom bundles, install/link |
| `/mcp/tools` | Core + token scanner, NFT/token generator, gRPC, tx visualizer |
| `/mcp/wallet` | Core + balance, faucet, send |

Example scoped URL: `http://127.0.0.1:47823/mcp/playground`

Live URL is shown in **Settings → MCP endpoint**. Legacy SSE is also available at `/sse?set=all` (or `core` / `playground` / …).

### MCP tool groups

<details>
<summary><strong>Core — memory, projects, files, skills</strong></summary>

| Tool | Description |
|---|---|
| `get_account_info` | Active wallet, memory account, network |
| `get_health` | Relayer connectivity and account status |
| `remember` | Save text to Walrus Memory |
| `recall` | Semantic search over memory |
| `analyze` | Extract and store discrete facts |
| `project_list` / `project_open` / `project_create` / `project_delete` / `project_rename` | Project CRUD |
| `file_read` / `file_write` / `file_delete` / `file_rename` | File operations (writes can trigger recall + remember) |
| `folder_create` / `folder_delete` / `folder_rename` | Folder operations |
| `skill_list` / `skill_get` | List and load agent skills |

</details>

<details>
<summary><strong>Git & GitHub</strong> (full <code>/mcp</code> only)</summary>

| Tool | Description |
|---|---|
| `git_status` / `git_init` / `git_add` / `git_commit` | Local Git workflow |
| `git_push` / `git_pull` / `git_fetch` / `git_branch` / `git_merge` / `git_log` | Remote and history |
| `github_create_repo` / `github_connect_repo` / `github_set_repo_visibility` / `github_list_repos` | GitHub integration |

</details>

<details>
<summary><strong>Playground — Move, localnet, Ika</strong></summary>

| Tool | Description |
|---|---|
| `playground_get_status` / `playground_get_workspace` / `playground_write_files` | Workspace state |
| `playground_build` / `playground_publish` | Move compile and publish |
| `playground_start_sui_localnet` / `playground_stop_sui_localnet` / `playground_reset_sui_localnet` | Sui localnet |
| `playground_request_faucet` / `playground_get_localnet_logs` / `playground_get_localnet_overview` | Faucet and explorer data |
| `playground_list_wallets` / `playground_get_wallet_assets` | Playground wallets |
| `playground_start_ika_localnet` / `playground_stop_ika_localnet` / `playground_start_ika_stack` / … | Ika stack |
| `playground_create_dwallet` / `playground_list_dwallets` / `playground_get_ika_explorer` | dWallet and Ika explorer |

</details>

<details>
<summary><strong>Playground — DeFi sandbox</strong></summary>

| Tool | Description |
|---|---|
| `playground_defi_deploy_sandbox` | Build/publish beluga_defi (AMM + faucets); localnet/testnet |
| `playground_defi_get_deployment` | Current sandbox deployment |
| `playground_defi_create_pool` / `playground_defi_list_pools` / `playground_defi_set_active_pool` | Pool management |
| `playground_defi_faucet` | Mint sandbox coins |
| `playground_defi_add_liquidity` / `playground_defi_swap` | Liquidity and swaps |
| `playground_defi_get_pool_snapshot` | Pool state snapshot |

</details>

<details>
<summary><strong>Playground — PTB</strong></summary>

| Tool | Description |
|---|---|
| `playground_ptb_get_draft` / `playground_ptb_set_draft` | Read/write PTB draft |
| `playground_ptb_list_templates` / `playground_ptb_load_template` | Templates |
| `playground_ptb_preview` / `playground_ptb_execute` | Dry-run and execute |

</details>

<details>
<summary><strong>Packages</strong></summary>

| Tool | Description |
|---|---|
| `packages_list_catalog` / `packages_list_installed` | SDK and installed packages |
| `packages_list_custom` / `packages_create_custom` / `packages_update_custom` / `packages_delete_custom` | Custom bundle CRUD |
| `packages_install` / `packages_update` / `packages_uninstall` | Global install dir |
| `packages_install_to_project` / `packages_link_to_project` / `packages_unlink_from_project` | Project linking |
| `packages_get_toolchain_status` | Rust / suiup / Sui CLI status |

</details>

<details>
<summary><strong>App tools & wallet</strong></summary>

| Tool | Description |
|---|---|
| `tool_scan_token` / `tool_build_token_package` / `tool_build_nft_package` | Token and NFT helpers |
| `tool_list_grpc_catalog` / `tool_grpc_query` / `tool_fetch_address_graph` | gRPC and visualizer |
| `wallet_get_info` / `wallet_generate` / `wallet_get_balance` / `wallet_request_faucet` / `wallet_send_sui` | Wallet operations |

</details>

---

## Project config (`beluga.json`)

Each project can declare what Beluga attaches when an agent calls `project_open`:

```json
{
  "version": 1,
  "name": "my-move-app",
  "template": "move",
  "createdAt": "2026-07-12T10:00:00.000Z",
  "memories": ["memory-uuid-1"],
  "packages": ["sui-sdk", "my-custom-stack"],
  "skills": ["sui-move-reviewer"],
  "github": {
    "owner": "you",
    "repo": "my-move-app",
    "defaultBranch": "main"
  }
}
```

---

## Data locations

Beluga stores app data under Electron `userData`:

| OS | Path |
|---|---|
| macOS | `~/Library/Application Support/beluga/` |
| Windows | `%APPDATA%\beluga\` |
| Linux | `~/.config/beluga/` |

Notable subfolders:

| Path | Contents |
|---|---|
| `projects/` | Managed project workspaces |
| `skills/` | Your skills library |
| `sui-packages/` | Installed packages + `custom-registry.json` |
| `toolchain/` | Beluga-managed Rust / cargo / Ika artifacts (fallback) |
| `playground/workspace/` | Default playground files |

Toolchain installers may also use `~/.beluga/toolchain/` when system `~/.rustup` or `~/.cargo` are not writable.

---

## Development

### Requirements

- **Node.js** 20+ (LTS recommended)
- **npm** 10+
- macOS, Windows, or Linux for dev; packaged builds tested on **macOS arm64** and **Windows**

### Run from source

```bash
git clone https://github.com/TheRealMagyar/beluga.git
cd beluga
npm install
npm start
```

`npm start` runs a permission check first. If a prior `sudo` left root-owned folders, run:

```bash
npm run fix-permissions
```

### Build installers

```bash
npm run make
```

Output lands in `out/` (e.g. `out/Beluga-darwin-arm64/Beluga.app` on macOS).

The build runs `electron-rebuild` for native modules (`node-pty`) and copies runtime dependencies into the packaged app.

### Useful scripts

| Script | Purpose |
|---|---|
| `npm start` | Dev mode (Electron Forge + Vite) |
| `npm run make` | Production installer / ZIP |
| `npm run fix-permissions` | Fix root-owned Beluga / Rust / cargo dirs (macOS/Linux) |
| `npm run rustup-update` | Update Rust via Beluga toolchain paths |
| `npm run kill-sui` | Stop orphaned Sui localnet processes |
| `npm run kill-ika` | Stop orphaned Ika localnet processes |
| `npm run sync-walrus-skills` | Refresh bundled Walrus skills under `vendor/walrus-skills` |
| `npm run lint` | ESLint |

---

## Troubleshooting

### `rustup update` or `suiup` fails with permission errors

System `~/.rustup`, `~/.cargo`, or `~/.cache` may be owned by root after a prior `sudo` install. Run `npm run fix-permissions`, then use **Packages → Toolchain** in Beluga (installs to Beluga-managed paths) or retry after fixing ownership.

### Packaged app crashes on `Cannot find module 'node-pty'`

Rebuild the installer with `npm run make` so native modules are rebuilt and unpacked from the asar archive.

### MCP client cannot connect

1. Confirm Beluga is running (MCP server starts with the app).
2. Use `http://127.0.0.1:47823/mcp` (or a scoped path) with `mcp-remote` and `--allow-http`.
3. Check **Settings → MCP endpoint** for the live URL.

### Localnet stuck or port in use

```bash
npm run kill-sui   # Sui
npm run kill-ika   # Ika
```

Then restart localnet from **Playground**.

---

## Architecture (high level)

```
┌─────────────────────────────────────────────────────────────┐
│  Beluga Desktop (Electron)                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐ │
│  │ Renderer │  │ Main IPC │  │ Helpers  │  │ MCP :47823  │ │
│  │ React UI │◄─┤ handlers │◄─┤ Sui/Move │──► HTTP/SSE    │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────┬──────┘ │
└───────────────────────────────────────────────────│─────────┘
                                                    │
        ┌───────────────────┬───────────────────────┼───────────────┐
        ▼                   ▼                       ▼               ▼
 Claude / Cursor      Walrus Memory           Sui / Ika        DeepBook /
 VS Code / agents     (on-chain)              localnet         markets
```

---

## Tech stack

- **Electron** 42 + **Vite** + **React** 19 + **TypeScript**
- **Tailwind CSS** 4, **Monaco Editor**, **xterm.js**, **lightweight-charts**
- **@mysten/sui**, **@mysten/walrus**, **@mysten/dapp-kit**, **@mysten/deepbook-v3**, **@mysten-incubation/memwal**
- **@ika.xyz/sdk**, **@modelcontextprotocol/sdk**
- **node-pty** for the integrated console

---

## License

MIT — see [package.json](./package.json).

---

## Links

- [Walrus Memory](https://memory.walrus.xyz)
- [Sui Documentation](https://docs.sui.io)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [DeepBook](https://docs.sui.io/standards/deepbook)
- [Releases](https://github.com/TheRealMagyar/beluga/releases)
