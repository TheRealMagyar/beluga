import type { BelugaToolDefinition } from "./beluga-tool-catalog";

export const GIT_GITHUB_TOOLS: BelugaToolDefinition[] = [
  {
    name: "git_status",
    description:
      "Returns git status for a Beluga project: branch, staged/unstaged/untracked files, ahead/behind, remote.",
    inputSchema: {
      type: "object",
      required: ["project_name"],
      properties: {
        project_name: { type: "string", description: "Beluga project name" },
      },
    },
  },
  {
    name: "git_init",
    description: "Initialize a git repository in a Beluga project (if not already).",
    inputSchema: {
      type: "object",
      required: ["project_name"],
      properties: {
        project_name: { type: "string" },
        branch: { type: "string", description: "Initial branch name (default: main)" },
      },
    },
  },
  {
    name: "git_add",
    description: "Stage files for commit. Omit paths to stage all changes.",
    inputSchema: {
      type: "object",
      required: ["project_name"],
      properties: {
        project_name: { type: "string" },
        paths: {
          type: "array",
          items: { type: "string" },
          description: "Relative file paths to stage",
        },
      },
    },
  },
  {
    name: "git_commit",
    description: "Create a git commit with the given message.",
    inputSchema: {
      type: "object",
      required: ["project_name", "message"],
      properties: {
        project_name: { type: "string" },
        message: { type: "string", description: "Commit message" },
      },
    },
  },
  {
    name: "git_push",
    description:
      "Push the current branch to GitHub. Requires GitHub connected in Settings and a configured remote.",
    inputSchema: {
      type: "object",
      required: ["project_name"],
      properties: {
        project_name: { type: "string" },
        branch: { type: "string" },
        remote: { type: "string", description: "Default: origin" },
        set_upstream: { type: "boolean" },
      },
    },
  },
  {
    name: "git_pull",
    description: "Pull from GitHub remote into the current branch.",
    inputSchema: {
      type: "object",
      required: ["project_name"],
      properties: {
        project_name: { type: "string" },
        branch: { type: "string" },
        remote: { type: "string" },
      },
    },
  },
  {
    name: "git_fetch",
    description: "Fetch from GitHub remote without merging.",
    inputSchema: {
      type: "object",
      required: ["project_name"],
      properties: {
        project_name: { type: "string" },
        remote: { type: "string" },
      },
    },
  },
  {
    name: "git_branch",
    description: "List, create, or checkout git branches in a project.",
    inputSchema: {
      type: "object",
      required: ["project_name", "action"],
      properties: {
        project_name: { type: "string" },
        action: {
          type: "string",
          enum: ["list", "create", "checkout"],
        },
        name: { type: "string", description: "Branch name (create/checkout)" },
        checkout: {
          type: "boolean",
          description: "When creating, checkout the new branch (default true)",
        },
      },
    },
  },
  {
    name: "git_merge",
    description: "Merge a branch into the current branch.",
    inputSchema: {
      type: "object",
      required: ["project_name", "branch"],
      properties: {
        project_name: { type: "string" },
        branch: { type: "string", description: "Branch to merge in" },
        message: { type: "string", description: "Optional merge commit message" },
      },
    },
  },
  {
    name: "git_log",
    description: "Recent commit history for a project.",
    inputSchema: {
      type: "object",
      required: ["project_name"],
      properties: {
        project_name: { type: "string" },
        limit: { type: "number", description: "Max commits (default 15)" },
      },
    },
  },
  {
    name: "github_create_repo",
    description:
      "Create a new GitHub repo for a Beluga project, add remote, optionally push initial commit. Requires GitHub token in Settings.",
    inputSchema: {
      type: "object",
      required: ["project_name"],
      properties: {
        project_name: { type: "string" },
        repo_name: { type: "string", description: "GitHub repo name (default: project name)" },
        description: { type: "string" },
        private: {
          type: "boolean",
          description: "Create as private repo (default true)",
        },
        push: {
          type: "boolean",
          description: "Push after creating (default true)",
        },
      },
    },
  },
  {
    name: "github_connect_repo",
    description:
      "Link a Beluga project to an existing GitHub repository and set origin remote.",
    inputSchema: {
      type: "object",
      required: ["project_name", "owner", "repo"],
      properties: {
        project_name: { type: "string" },
        owner: { type: "string" },
        repo: { type: "string" },
        push: {
          type: "boolean",
          description: "Commit and push local changes after linking",
        },
      },
    },
  },
  {
    name: "github_set_repo_visibility",
    description:
      "Change a linked GitHub repository between public and private visibility.",
    inputSchema: {
      type: "object",
      required: ["project_name", "private"],
      properties: {
        project_name: { type: "string" },
        private: {
          type: "boolean",
          description: "true = private, false = public",
        },
      },
    },
  },
  {
    name: "github_list_repos",
    description: "List GitHub repositories for the signed-in user.",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "number", description: "Page number (default 1)" },
      },
    },
  },
];