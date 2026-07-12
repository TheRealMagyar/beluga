export type BelugaToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

import {
  BELUGA_APP_TOOLS,
  PACKAGES_TOOLS,
  PLAYGROUND_TOOLS,
  WALLET_TOOLS,
} from "./beluga-tool-catalog-extended";
import { GIT_GITHUB_TOOLS } from "./beluga-tool-catalog-git";

export type { McpToolSetId } from "./beluga-tool-catalog-extended";

/** Projects, memory, files, skills — original MCP tool set */
export const BELUGA_CORE_TOOLS: BelugaToolDefinition[] = [
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
    description: `Opens a project and returns the full file/folder tree structure, memory credentials, and attached agent skills.

IMPORTANT: Always save the accountId and delegateKey values from the response and pass them to every subsequent tool call:
- recall() — call immediately at session start with these
- remember() — after every change
- file_write() — on every file write

Follow all attached skills instructions before making changes.
Use skill_get(skill_id) to reload a skill's full content if needed.

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

  // ── Skill tools ────────────────────────────────────────────────────────

  {
    name: "skill_list",
    description:
      "Lists all skills in the Beluga skills library (id, name, description).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "skill_get",
    description:
      "Fetches the full instructions for a skill by id. Use attached skills from project_open or list all via skill_list.",
    inputSchema: {
      type: "object",
      required: ["skill_id"],
      properties: {
        skill_id: {
          type: "string",
          description: "Skill id (from project_open attachedSkills or skill_list)",
        },
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
];

/** All tools available to in-app AI and the default /mcp endpoint */
export const BELUGA_ALL_TOOLS: BelugaToolDefinition[] = [
  ...BELUGA_CORE_TOOLS,
  ...GIT_GITHUB_TOOLS,
  ...PLAYGROUND_TOOLS,
  ...PACKAGES_TOOLS,
  ...BELUGA_APP_TOOLS,
  ...WALLET_TOOLS,
];

/** @deprecated Use BELUGA_CORE_TOOLS or BELUGA_ALL_TOOLS */
export const BELUGA_TOOLS = BELUGA_ALL_TOOLS;

export function getToolsForSet(set: McpToolSetId): BelugaToolDefinition[] {
  switch (set) {
    case "core":
      return BELUGA_CORE_TOOLS;
    case "playground":
      return [...BELUGA_CORE_TOOLS, ...PLAYGROUND_TOOLS];
    case "packages":
      return [...BELUGA_CORE_TOOLS, ...PACKAGES_TOOLS];
    case "tools":
      return [...BELUGA_CORE_TOOLS, ...BELUGA_APP_TOOLS];
    case "wallet":
      return [...BELUGA_CORE_TOOLS, ...WALLET_TOOLS];
    case "all":
    default:
      return BELUGA_ALL_TOOLS;
  }
}

export type OpenAiTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

function normalizeToolSchema(schema: Record<string, unknown>): Record<string, unknown> {
  if (schema.type === "object") {
    return {
      type: "object",
      properties: schema.properties ?? {},
      ...(Array.isArray(schema.required) ? { required: schema.required } : {}),
      additionalProperties: false,
    };
  }
  return schema;
}

export function toOpenAiTools(tools: BelugaToolDefinition[]): OpenAiTool[] {
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: normalizeToolSchema(tool.inputSchema),
    },
  }));
}

export type XaiResponsesTool = {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export function toXaiResponsesTools(tools: BelugaToolDefinition[]): XaiResponsesTool[] {
  return tools.map((tool) => ({
    type: "function" as const,
    name: tool.name,
    description: tool.description,
    parameters: normalizeToolSchema(tool.inputSchema),
  }));
}