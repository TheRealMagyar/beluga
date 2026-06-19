import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { BrowserWindow, ipcMain } from "electron";
import http from "node:http";
import { randomUUID } from "node:crypto";
import {
  remember as walrusRemember,
  recall as walrusRecall,
  analyze as walrusAnalyze,
  health as walrusHealth,
} from "../helper/walrus-memory";
import type { WalrusCredentials } from "../helper/walrus-memory";

const MCP_PORT = 47823;

async function callRenderer<T>(channel: string, payload?: any): Promise<T> {
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) throw new Error("No active BrowserWindow");

  return new Promise((resolve, reject) => {
    const responseChannel = `${channel}-response-${Date.now() + Math.random()}`;

    const timeoutId = setTimeout(() => {
      ipcMain.removeAllListeners(responseChannel);
      reject(new Error(`MCP IPC timeout: ${channel} (60s)`));
    }, 60_000);

    ipcMain.once(responseChannel, (_event, result) => {
      clearTimeout(timeoutId);
      if (result?.error) {
        reject(new Error(result.error));
      } else {
        resolve(result);
      }
    });

    win.webContents.send(channel, { responseChannel, payload });
  });
}

// ── MCP server builder ────────────────────────────────────────────────────────
function buildServer(): Server {
  const server = new Server(
    { name: "walrus-memory-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      // ── Walrus Memory tools ────────────────────────────────────────────────
      {
        name: "get_account_info",
        description:
          "Returns the current Walrus Memory account data (wallet address, account ID, network)",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "remember",
        description: `[REQUIRED] Saves text to the Walrus Memory network — this is the project's only persistent memory.

WHEN TO CALL (every single time, without exception):
- After every file_write (if accountId/delegateKey were not provided to file_write)
- After every decision, architectural change, or bugfix
- After every discovery that needs to be known in the next session

HOW TO CALL:
The accountId and delegateKey values come from the project_open response.
These MUST always be passed — without them, memory does not work.

EXAMPLE:
remember(
  text: "We moved the CSS from index.html to style.css. The link tag: <link rel='stylesheet' href='style.css'>",
  accountId: "0x...",   ← from project_open response
  delegateKey: "a60...", ← from project_open response
  network: "mainnet",
  namespace: "default"
)`,
        inputSchema: {
          type: "object",
          required: ["text", "accountId", "delegateKey"],
          properties: {
            text: { type: "string", description: "The text to save" },
            accountId: {
              type: "string",
              description:
                "Memory account ID (from the project_open response) — REQUIRED",
            },
            delegateKey: {
              type: "string",
              description:
                "Memory delegate private key (from the project_open response) — REQUIRED",
            },
            network: {
              type: "string",
              enum: ["mainnet", "testnet"],
              description: "Network (from the project_open response)",
            },
            namespace: {
              type: "string",
              description:
                "Namespace (from the project_open response, default: default)",
            },
          },
        },
      },
      {
        name: "recall",
        description: `[REQUIRED AT SESSION START] Semantic search in Walrus Memory — returns all previous decisions, changes, and context for the project.

WHEN TO CALL:
1. AT THE VERY START OF EVERY SESSION — the first thing you do, even before reading files.
2. If you are uncertain about anything — always recall first, never guess.

HOW TO CALL:
The accountId and delegateKey values come from the project_open response.

EXAMPLE at session start:
recall(
  query: "all changes decisions architecture history file structure",
  accountId: "0x...",   ← from project_open response
  delegateKey: "a60...", ← from project_open response
  network: "mainnet",
  namespace: "default"
)

If recall returns nothing: no memory has been saved yet, continue normally.`,
        inputSchema: {
          type: "object",
          required: ["query", "accountId", "delegateKey"],
          properties: {
            query: { type: "string", description: "Search query" },
            limit: {
              type: "number",
              description: "Maximum number of results (default: 5)",
            },
            accountId: {
              type: "string",
              description:
                "Memory account ID (from the project_open response) — REQUIRED",
            },
            delegateKey: {
              type: "string",
              description:
                "Memory delegate private key (from the project_open response) — REQUIRED",
            },
            network: {
              type: "string",
              enum: ["mainnet", "testnet"],
              description: "Network (from the project_open response)",
            },
            namespace: {
              type: "string",
              description: "Namespace (from the project_open response)",
            },
          },
        },
      },
      {
        name: "analyze",
        description:
          "Analyzes text, extracts facts, and saves them. Requires accountId and delegateKey from the project_open tool response.",
        inputSchema: {
          type: "object",
          required: ["text", "accountId", "delegateKey"],
          properties: {
            text: { type: "string", description: "The text to analyze" },
            accountId: {
              type: "string",
              description:
                "Memory account ID (from the project_open response)",
            },
            delegateKey: {
              type: "string",
              description:
                "Memory delegate private key (from the project_open response)",
            },
            network: {
              type: "string",
              enum: ["mainnet", "testnet"],
              description: "Network (from the project_open response)",
            },
            namespace: {
              type: "string",
              description: "Namespace (from the project_open response)",
            },
          },
        },
      },
      {
        name: "get_health",
        description:
          "Returns the relayer connection status for a specific memory",
        inputSchema: {
          type: "object",
          required: ["accountId", "delegateKey"],
          properties: {
            accountId: {
              type: "string",
              description: "Memory account ID",
            },
            delegateKey: {
              type: "string",
              description: "Memory delegate private key",
            },
            network: {
              type: "string",
              enum: ["mainnet", "testnet"],
              description: "Network",
            },
          },
        },
      },

      // ── Project Manager tools ──────────────────────────────────────────────

      {
        name: "project_list",
        description:
          "Lists all existing projects (name, path, file count, creation date)",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "project_open",
        description: `Opens a project and returns the full file/folder tree structure along with memory credentials.

IMPORTANT: Always save the accountId and delegateKey values from the response and pass them to every subsequent tool call:
- recall() — call immediately at session start with these
- remember() — after every change
- file_write() — on every file write

Without the credentials, Walrus Memory will not work and memory will be lost.`,
        inputSchema: {
          type: "object",
          required: ["project_name"],
          properties: {
            project_name: {
              type: "string",
              description:
                "The project name (exactly as it appears in the list)",
            },
          },
        },
      },
      {
        name: "project_create",
        description:
          "Creates a new project with default files (agents.md, tasks.md, memory.md, README.md)",
        inputSchema: {
          type: "object",
          required: ["project_name"],
          properties: {
            project_name: {
              type: "string",
              description:
                "Project name — letters, numbers, hyphens, and underscores only",
            },
          },
        },
      },
      {
        name: "project_delete",
        description:
          "Deletes an entire project along with all its files. Irreversible!",
        inputSchema: {
          type: "object",
          required: ["project_name"],
          properties: {
            project_name: {
              type: "string",
              description: "Name of the project to delete",
            },
          },
        },
      },
      {
        name: "project_rename",
        description: "Renames a project",
        inputSchema: {
          type: "object",
          required: ["old_name", "new_name"],
          properties: {
            old_name: { type: "string", description: "Current project name" },
            new_name: { type: "string", description: "New project name" },
          },
        },
      },

      // ── File tools ─────────────────────────────────────────────────────────

      {
        name: "file_read",
        description:
          'Reads the contents of a file. The path is relative to the project root (e.g. "src/index.ts") OR an absolute path.',
        inputSchema: {
          type: "object",
          required: ["project_name", "file_path"],
          properties: {
            project_name: { type: "string", description: "Project name" },
            file_path: {
              type: "string",
              description: "File path (relative to the project or absolute)",
            },
          },
        },
      },
      {
        name: "file_write",
        description: `Creates or overwrites a file with the given content.

⚠️ REQUIRED: Always provide the accountId and delegateKey parameters (from the project_open response).
If omitted, Walrus Memory will silently be skipped — the change will not be saved,
and context will be lost in the next session. This is a usage error on your part.

The server automatically:
1. Runs recall() before writing (to load previous context)
2. Runs remember() after writing (to save the change)

BUT ONLY IF accountId AND delegateKey ARE PROVIDED!

CORRECT USAGE:
file_write(
  project_name: "my-project",
  file_path: "src/index.ts",
  content: "...",
  accountId: "0x...",    ← ALWAYS PROVIDE (from project_open response)
  delegateKey: "a60...", ← ALWAYS PROVIDE (from project_open response)
  network: "mainnet",
  namespace: "default"
)`,
        inputSchema: {
          type: "object",
          required: ["project_name", "file_path", "content"],
          properties: {
            project_name: { type: "string", description: "Project name" },
            file_path: {
              type: "string",
              description: "File path (relative to the project)",
            },
            content: {
              type: "string",
              description: "The full content to write to the file",
            },
            accountId: {
              type: "string",
              description:
                "⚠️ REQUIRED for memory — Walrus Memory account ID (from the project_open response). If omitted, memory will not work.",
            },
            delegateKey: {
              type: "string",
              description:
                "⚠️ REQUIRED for memory — Walrus Memory delegate key (from the project_open response). If omitted, memory will not work.",
            },
            network: {
              type: "string",
              enum: ["mainnet", "testnet"],
              description: "Network (default: mainnet)",
            },
            namespace: {
              type: "string",
              description: "Namespace (default: default)",
            },
          },
        },
      },
      {
        name: "file_delete",
        description: "Deletes a file from the project",
        inputSchema: {
          type: "object",
          required: ["project_name", "file_path"],
          properties: {
            project_name: { type: "string", description: "Project name" },
            file_path: {
              type: "string",
              description: "Path of the file to delete (relative)",
            },
          },
        },
      },
      {
        name: "file_rename",
        description: "Renames or moves a file within the project",
        inputSchema: {
          type: "object",
          required: ["project_name", "old_path", "new_path"],
          properties: {
            project_name: { type: "string", description: "Project name" },
            old_path: {
              type: "string",
              description: "Current file path (relative)",
            },
            new_path: {
              type: "string",
              description: "New file path (relative)",
            },
          },
        },
      },

      // ── Folder tools ────────────────────────────────────────────────────────

      {
        name: "folder_create",
        description:
          "Creates a folder (and all intermediate folders) within the project",
        inputSchema: {
          type: "object",
          required: ["project_name", "folder_path"],
          properties: {
            project_name: { type: "string", description: "Project name" },
            folder_path: {
              type: "string",
              description:
                'Folder path (relative to the project, e.g. "src/utils")',
            },
          },
        },
      },
      {
        name: "folder_delete",
        description:
          "Deletes a folder and all its contents from the project. Irreversible!",
        inputSchema: {
          type: "object",
          required: ["project_name", "folder_path"],
          properties: {
            project_name: { type: "string", description: "Project name" },
            folder_path: {
              type: "string",
              description: "Path of the folder to delete (relative)",
            },
          },
        },
      },
      {
        name: "folder_rename",
        description: "Renames or moves a folder within the project",
        inputSchema: {
          type: "object",
          required: ["project_name", "old_path", "new_path"],
          properties: {
            project_name: { type: "string", description: "Project name" },
            old_path: {
              type: "string",
              description: "Current folder path (relative)",
            },
            new_path: {
              type: "string",
              description: "New folder path (relative)",
            },
          },
        },
      },
    ],
  }));

  // ── Tool handlers ───────────────────────────────────────────────────────────
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        // ── Walrus Memory ────────────────────────────────────────────────────

        case "get_account_info": {
          const info = await callRenderer<{
            walletAddress: string | null;
            accountId: string | null;
            network: string;
            health: string | null;
          }>("mcp:get-account-info");
          return {
            content: [{ type: "text", text: JSON.stringify(info, null, 2) }],
          };
        }

        case "remember": {
          const creds: WalrusCredentials = {
            accountId: args?.accountId as string,
            delegateKey: args?.delegateKey as string,
            network: (args?.network as "mainnet" | "testnet") ?? "mainnet",
            namespace: (args?.namespace as string) ?? "default",
          };
          if (!creds.accountId || !creds.delegateKey) {
            return {
              content: [
                {
                  type: "text",
                  text: "❌ Error: missing accountId/delegateKey. Call the project_open tool first and use the credentials from its response.",
                },
              ],
              isError: true,
            };
          }
          const result = await walrusRemember(creds, args?.text as string);
          return {
            content: [
              {
                type: "text",
                text: `✅ Saved! Blob ID: ${result.blob_id}`,
              },
            ],
          };
        }

        case "recall": {
          const creds: WalrusCredentials = {
            accountId: args?.accountId as string,
            delegateKey: args?.delegateKey as string,
            network: (args?.network as "mainnet" | "testnet") ?? "mainnet",
            namespace: (args?.namespace as string) ?? "default",
          };
          if (!creds.accountId || !creds.delegateKey) {
            return {
              content: [
                {
                  type: "text",
                  text: "❌ Error: missing accountId/delegateKey. Call the project_open tool first and use the credentials from its response.",
                },
              ],
              isError: true,
            };
          }
          const result = await walrusRecall(creds, args?.query as string, {
            limit: (args?.limit as number) ?? 5,
          });
          const formatted = result.results
            .map((r, i) => `${i + 1}. [${r.relevance}% relevance]\n${r.text}`)
            .join("\n\n");
          return {
            content: [
              {
                type: "text",
                text:
                  result.total === 0
                    ? "No results found"
                    : `${result.total} results:\n\n${formatted}`,
              },
            ],
          };
        }

        case "analyze": {
          const creds: WalrusCredentials = {
            accountId: args?.accountId as string,
            delegateKey: args?.delegateKey as string,
            network: (args?.network as "mainnet" | "testnet") ?? "mainnet",
            namespace: (args?.namespace as string) ?? "default",
          };
          if (!creds.accountId || !creds.delegateKey) {
            return {
              content: [
                {
                  type: "text",
                  text: "❌ Error: missing accountId/delegateKey. Call the project_open tool first and use the credentials from its response.",
                },
              ],
              isError: true,
            };
          }
          const result = await walrusAnalyze(creds, args?.text as string);
          const formatted = result.facts
            .map((f, i) => `${i + 1}. ${f.text}`)
            .join("\n");
          return {
            content: [
              {
                type: "text",
                text: `${result.fact_count} facts extracted:\n\n${formatted}`,
              },
            ],
          };
        }

        case "get_health": {
          const creds: WalrusCredentials = {
            accountId: args?.accountId as string,
            delegateKey: args?.delegateKey as string,
            network: (args?.network as "mainnet" | "testnet") ?? "mainnet",
          };
          if (!creds.accountId || !creds.delegateKey) {
            return {
              content: [
                { type: "text", text: "❌ Error: missing accountId/delegateKey." },
              ],
              isError: true,
            };
          }
          const result = await walrusHealth(creds);
          return {
            content: [
              { type: "text", text: `Relayer status: ${result.status}` },
            ],
          };
        }

        // ── Project Manager ───────────────────────────────────────────────────

        case "project_list": {
          const result = await callRenderer<{
            projects: Array<{
              name: string;
              path: string;
              fileCount: number;
              createdAt: string;
            }>;
          }>("mcp:project-list");
          if (result.projects.length === 0) {
            return {
              content: [{ type: "text", text: "No projects found." }],
            };
          }
          const lines = result.projects.map(
            (p) =>
              `📁 ${p.name}\n   Files: ${p.fileCount} | Created: ${new Date(p.createdAt).toLocaleDateString("en-US")}\n   Path: ${p.path}`,
          );
          return {
            content: [
              {
                type: "text",
                text: `${result.projects.length} project(s):\n\n${lines.join("\n\n")}`,
              },
            ],
          };
        }

        case "project_open": {
          console.log("[project_open] args:", args);
          try {
            const result = await callRenderer<{
              name: string;
              path: string;
              tree: string;
              memoryCredentials: Array<{
                id: string;
                label: string;
                accountId: string;
                delegateKey: string;
                network: "mainnet" | "testnet";
                namespace: string;
              }>;
            }>("mcp:project-open", { project_name: args?.project_name });

            console.log("[project_open] result:", result);

            const credentialsText =
              (result.memoryCredentials ?? []).length > 0
                ? result.memoryCredentials
                    .map(
                      (c) =>
                        `  - ${c.label} (Account id: ${c.accountId}, Delegation key: ${c.delegateKey}) [${c.network}/${c.namespace}]`,
                    )
                    .join("\n")
                : "  (no memory attached)";

            return {
              content: [
                {
                  type: "text",
                  text: [
                    `Project: ${result.name}`,
                    `Path: ${result.path}`,
                    ``,
                    `File structure:`,
                    result.tree,
                    ``,
                    `Attached memories:`,
                    credentialsText,
                    ``,
                    `⚠️ NEXT REQUIRED STEP:`,
                    `Immediately call the recall() tool with the following parameters,`,
                    `before doing anything else:`,
                    `  query: "all changes decisions architecture history"`,
                    `  accountId: ${result.memoryCredentials?.[0]?.accountId ?? "<see above>"}`,
                    `  delegateKey: ${result.memoryCredentials?.[0]?.delegateKey ?? "<see above>"}`,
                    `  network: ${result.memoryCredentials?.[0]?.network ?? "mainnet"}`,
                    `  namespace: ${result.memoryCredentials?.[0]?.namespace ?? "default"}`,
                  ].join("\n"),
                },
              ],
            };
          } catch (err) {
            console.error("[project_open] error:", err);
            throw err;
          }
        }

        case "project_create": {
          await callRenderer<void>("mcp:project-create", {
            project_name: args?.project_name,
          });
          return {
            content: [
              {
                type: "text",
                text: `✅ Project created: ${args?.project_name}\nDefault files: WALRUS.md, CLAUDE.md, README.md`,
              },
            ],
          };
        }

        case "project_delete": {
          await callRenderer<void>("mcp:project-delete", {
            project_name: args?.project_name,
          });
          return {
            content: [
              {
                type: "text",
                text: `✅ Project deleted: ${args?.project_name}`,
              },
            ],
          };
        }

        case "project_rename": {
          await callRenderer<void>("mcp:project-rename", {
            old_name: args?.old_name,
            new_name: args?.new_name,
          });
          return {
            content: [
              {
                type: "text",
                text: `✅ Renamed: ${args?.old_name} → ${args?.new_name}`,
              },
            ],
          };
        }

        // ── File operations ──────────────────────────────────────────────────

        case "file_read": {
          const result = await callRenderer<{ content: string; path: string }>(
            "mcp:file-read",
            { project_name: args?.project_name, file_path: args?.file_path },
          );
          return {
            content: [
              {
                type: "text",
                text: `// ${result.path}\n\n${result.content}`,
              },
            ],
          };
        }

        case "file_write": {
          const creds: WalrusCredentials | null =
            args?.accountId && args?.delegateKey
              ? {
                  accountId: args.accountId as string,
                  delegateKey: args.delegateKey as string,
                  network:
                    (args?.network as "mainnet" | "testnet") ?? "mainnet",
                  namespace: (args?.namespace as string) ?? "default",
                }
              : null;

          // 1. RECALL — what was previously related to this file/project
          let recallContext = "";
          if (creds) {
            try {
              const recallResult = await walrusRecall(
                creds,
                `${args?.project_name} ${args?.file_path} file changes and history`,
                { limit: 5 },
              );
              if (recallResult.total > 0) {
                recallContext = recallResult.results
                  .map((r, i) => `${i + 1}. [${r.relevance}%] ${r.text}`)
                  .join("\n");
                console.log(
                  `[file_write] Recall result (${recallResult.total} hit(s)):\n${recallContext}`,
                );
              } else {
                console.log(
                  "[file_write] Recall: no previous memory for this file.",
                );
              }
            } catch (e: any) {
              console.warn(
                "[file_write] Recall error (non-fatal):",
                e.message,
              );
            }
          }

          // 2. WRITE — the actual file write
          const result = await callRenderer<{ path: string; created: boolean }>(
            "mcp:file-write",
            {
              project_name: args?.project_name,
              file_path: args?.file_path,
              content: args?.content,
            },
          );

          // 3. REMEMBER — what we wrote, when, and to which file
          if (creds) {
            try {
              const contentPreview = ((args?.content as string) ?? "").slice(
                0,
                300,
              );
              const memoryText = [
                `[file_write] Project: ${args?.project_name}`,
                `File: ${args?.file_path}`,
                `Operation: ${result.created ? "created" : "updated"}`,
                `Timestamp: ${new Date().toISOString()}`,
                `Content preview (first 300 chars): ${contentPreview}`,
                recallContext
                  ? `Previous context found: yes (${recallContext.split("\n").length} result(s))`
                  : "Previous context: none",
              ].join("\n");

              await walrusRemember(creds, memoryText);
              console.log(
                "[file_write] Remember: file write saved to Walrus Memory.",
              );
            } catch (e: any) {
              console.warn(
                "[file_write] Remember error (non-fatal):",
                e.message,
              );
            }
          }

          return {
            content: [
              {
                type: "text",
                text: [
                  result.created
                    ? `✅ File created: ${result.path}`
                    : `✅ File updated: ${result.path}`,
                  creds
                    ? `🧠 Walrus: recall completed${recallContext ? ` (${recallContext.split("\n").length} previous memory item(s))` : " (no prior history)"}, remember saved.`
                    : "❌ WARNING: accountId/delegateKey was not provided — Walrus Memory did NOT run! The change will be lost in the next session. Call the remember() tool manually now!",
                ].join("\n"),
              },
            ],
          };
        }

        case "file_delete": {
          const result = await callRenderer<{ path: string }>(
            "mcp:file-delete",
            { project_name: args?.project_name, file_path: args?.file_path },
          );
          return {
            content: [
              { type: "text", text: `✅ File deleted: ${result.path}` },
            ],
          };
        }

        case "file_rename": {
          const result = await callRenderer<{
            old_path: string;
            new_path: string;
          }>("mcp:file-rename", {
            project_name: args?.project_name,
            old_path: args?.old_path,
            new_path: args?.new_path,
          });
          return {
            content: [
              {
                type: "text",
                text: `✅ Renamed: ${result.old_path} → ${result.new_path}`,
              },
            ],
          };
        }

        // ── Folder operations ─────────────────────────────────────────────────

        case "folder_create": {
          const result = await callRenderer<{ path: string }>(
            "mcp:folder-create",
            {
              project_name: args?.project_name,
              folder_path: args?.folder_path,
            },
          );
          return {
            content: [
              { type: "text", text: `✅ Folder created: ${result.path}` },
            ],
          };
        }

        case "folder_delete": {
          const result = await callRenderer<{ path: string }>(
            "mcp:folder-delete",
            {
              project_name: args?.project_name,
              folder_path: args?.folder_path,
            },
          );
          return {
            content: [
              { type: "text", text: `✅ Folder deleted: ${result.path}` },
            ],
          };
        }

        case "folder_rename": {
          const result = await callRenderer<{
            old_path: string;
            new_path: string;
          }>("mcp:folder-rename", {
            project_name: args?.project_name,
            old_path: args?.old_path,
            new_path: args?.new_path,
          });
          return {
            content: [
              {
                type: "text",
                text: `✅ Folder renamed: ${result.old_path} → ${result.new_path}`,
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (e: any) {
      return {
        content: [{ type: "text", text: `❌ Error: ${e.message}` }],
        isError: true,
      };
    }
  });

  return server;
}

// ── HTTP server (Streamable HTTP + SSE fallback) ──────────────────────────────
let httpServer: http.Server | null = null;

export function startMcpHttpServer(): void {
  const sseTransports = new Map<string, any>();

  httpServer = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Accept, Mcp-Session-Id",
    );

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // ── 1. Streamable HTTP ──────────────────────────────────────────────────
    if (req.url === "/mcp") {
      try {
        const { StreamableHTTPServerTransport } =
          await import("@modelcontextprotocol/sdk/server/streamableHttp.js");
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: false,
        });
        const server = buildServer();
        await server.connect(transport);
        await transport.handleRequest(req, res);
        res.on("finish", () => server.close().catch(() => {}));
      } catch (e: any) {
        console.error("[MCP] Streamable HTTP error:", e);
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message }));
        }
      }
      return;
    }

    // ── 2. SSE transport ────────────────────────────────────────────────────
    if (req.method === "GET" && req.url === "/sse") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      try {
        const { SSEServerTransport } =
          await import("@modelcontextprotocol/sdk/server/sse.js");
        const transport = new SSEServerTransport("/message", res);
        const sessionId: string = transport.sessionId ?? randomUUID();
        const server = buildServer();
        sseTransports.set(sessionId, { transport, server });
        console.log(`[MCP] SSE client connected: ${sessionId}`);
        res.on("close", () => {
          sseTransports.delete(sessionId);
          server.close().catch(() => {});
          console.log(`[MCP] SSE disconnected: ${sessionId}`);
        });
        await server.connect(transport);
      } catch (e: any) {
        console.error("[MCP] SSE error:", e);
      }
      return;
    }

    // ── 3. SSE POST ─────────────────────────────────────────────────────────
    if (req.method === "POST" && req.url === "/message") {
      const urlParams = new URL(req.url!, `http://0.0.0.0:${MCP_PORT}`)
        .searchParams;
      const sessionId =
        urlParams.get("sessionId") ?? (req.headers["mcp-session-id"] as string);
      const entry = sessionId
        ? sseTransports.get(sessionId)
        : [...sseTransports.values()][0];

      if (!entry) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "No active SSE session." }));
        return;
      }
      try {
        await entry.transport.handlePostMessage(req, res);
      } catch (e: any) {
        console.error("[MCP] POST error:", e);
        if (!res.headersSent) {
          res.writeHead(500);
          res.end();
        }
      }
      return;
    }

    // ── 4. Health check ─────────────────────────────────────────────────────
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          activeSseSessions: sseTransports.size,
          endpoints: {
            streamableHttp: `http://0.0.0.0:${MCP_PORT}/mcp`,
            sse: `http://0.0.0.0:${MCP_PORT}/sse`,
            ssePost: `http://0.0.0.0:${MCP_PORT}/message`,
          },
        }),
      );
      return;
    }

    res.writeHead(404);
    res.end();
  });

  httpServer.listen(MCP_PORT, "0.0.0.0", () => {
    console.log(`[MCP] Server running:`);
    console.log(`  Streamable HTTP : http://0.0.0.0:${MCP_PORT}/mcp`);
    console.log(`  SSE (fallback)  : http://0.0.0.0:${MCP_PORT}/sse`);
    console.log(`  Health check    : http://0.0.0.0:${MCP_PORT}/health`);
  });
}

export function stopMcpServer(): void {
  httpServer?.close(() => console.log("[MCP] Stopped"));
  httpServer = null;
}

export const MCP_URL = `http://0.0.0.0:${MCP_PORT}`;