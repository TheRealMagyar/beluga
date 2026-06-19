# 🐋 Beluga

**An AI-native project manager built on Sui — with persistent, on-chain memory for your AI agents.**

Beluga lets you connect AI agents (Claude, Cursor, VS Code, and any other MCP-compatible client) directly to projects on your machine. Agents can read and write your project files, and — thanks to [Walrus Memory](https://memory.walrus.xyz) — they never forget the context of a project between sessions. Every decision, fact, and piece of context is stored as an encrypted, vectorized memory on the Walrus network, so a brand-new chat session (or even a completely different AI model) can pick up exactly where the last one left off.

## Overview

- **Project management** — create, open, rename, and delete local projects, each with its own file tree.
- **AI agent access** — any MCP-compatible AI agent can connect to Beluga and read/write files inside your projects.
- **Persistent memory** — agents store and retrieve context via Walrus Memory, so nothing is lost when a chat ends, the model changes, or you switch machines.
- **Multiple memories per project** — attach one or several Walrus Memory accounts/namespaces to the same project to organize or combine context.
- **Built-in Sui wallet** — Beluga ships with an integrated Sui wallet. Today it's used to pay the on-chain fee for creating a Walrus Memory account; going forward, it will let agents generate signatures and interact on-chain directly — handy if you're building dApps.
- **Sui-first, but not Sui-only** — Beluga is primarily designed for managing Sui projects (dApps, smart contracts), but you can connect and manage any kind of project with it.

## How It Works

1. You connect a Sui wallet inside Beluga (or import an existing one).
2. You create or import a **Walrus Memory** account — an on-chain, encrypted memory store for your AI agent.
3. You create a **project** and attach one or more Walrus Memory accounts to it.
4. You point an MCP-compatible AI client (Claude Desktop, Cursor, VS Code, etc.) at Beluga.
5. The agent calls `recall()` at the start of a session to pull prior context, and `remember()` whenever something worth keeping happens — all transparently, over MCP.

Because memory lives on Walrus and is keyed to your account and project (not to a single chat window), you can swap agents mid-task and the new one will have full context.

## Quick Start

1. **Install Beluga** using one of the [download links](#download) below, or build it from source (see [Custom Installer](#building-a-custom-installer) below).
2. **Connect or import a Sui wallet.** Any Sui-compatible wallet works (Slush, Suiet, Phantom). Make sure it holds a small amount of SUI — creating a Walrus Memory account is an on-chain transaction.
3. **Create or import a Walrus Memory account.** Optionally set a namespace to keep different memories separated (default namespace is `default`).
4. **Create a project** and attach your Walrus Memory account to it. Beluga scaffolds starter files (`WALRUS.md`, `CLAUDE.md`, `README.md`) automatically.
5. **Connect your AI agent over MCP** (see below) and start working — try something like *"Open the project and check where we left off."*

> 💡 Tip: Generate a **delegate key** from the Walrus Playground instead of exposing your main wallet key to an agent. Delegate keys are scoped to memory operations only.

## Connecting an AI Agent (MCP)

Beluga exposes its functionality over the [Model Context Protocol](https://modelcontextprotocol.io). Currently supported clients:

| Client | Status |
|---|---|
| Claude Desktop | ✅ Supported |
| Cursor / VS Code | ✅ Supported |
| GPT-4 (OpenAI) | 🔜 Coming soon |

**Claude Desktop** — add this to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "walrus-memory": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://0.0.0.0:47823/mcp",
        "--allow-http"
      ]
    }
  }
}
```

**Cursor / VS Code** — add this to `.cursor/mcp.json` at your project root:

```json
{
  "mcpServers": {
    "walrus-memory": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://0.0.0.0:47823/mcp",
        "--allow-http"
      ]
    }
  }
}
```

### Available MCP Tools

| Tool | Description |
|---|---|
| `project_list` | List all projects (name, path, file count, last modified). |
| `project_open` | Open a project — returns the file tree and memory credentials. |
| `project_create` | Create a new project with starter files. |
| `project_delete` | Delete a project (irreversible). |
| `project_rename` | Rename a project. |
| `file_read` / `file_write` / `file_delete` / `file_rename` | Standard file operations inside a project. Writes can auto-trigger recall + remember. |
| `folder_create` / `folder_delete` / `folder_rename` | Folder operations inside a project. |
| `remember` | Save text to Walrus Memory as a vector embedding. |
| `recall` | Semantic search over memory — call at the start of every session. |
| `analyze` | Extract discrete facts from a longer passage and save each one. |
| `get_health` | Check relayer connectivity and account status. |
| `get_account_info` | Return the active wallet address, account ID, and network details. |

## Download

| Platform | Link |
|---|---|
| Windows | _coming soon_ |
| macOS | _coming soon_ |

## Building a Custom Installer

If you'd rather build Beluga yourself:

```bash
git clone https://github.com/yourusername/beluga.git
cd beluga
npm install
npm run make
```

Once the build finishes, the installer will be in the `out/` directory.

## Resources

- [Walrus Playground](https://memory.walrus.xyz)
- [Sui Explorer](https://suiscan.xyz)
- [Model Context Protocol Spec](https://modelcontextprotocol.io)

## License

TBD