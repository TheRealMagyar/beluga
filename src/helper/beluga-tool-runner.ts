import { callRenderer } from "./renderer-ipc";
import { executeExtendedBelugaTool } from "./beluga-tool-runner-extended";
import {
  remember as walrusRemember,
  recall as walrusRecall,
  analyze as walrusAnalyze,
  health as walrusHealth,
} from "../helper/walrus-memory";
import type { WalrusCredentials } from "../helper/walrus-memory";

export async function executeBelugaTool(
  name: string,
  args: Record<string, unknown> | undefined,
): Promise<{ text: string; isError: boolean }> {
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
          text: JSON.stringify(info, null, 2),
          isError: false,
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
            text: "❌ Error: missing accountId/delegateKey. Call the project_open tool first and use the credentials from its response.",
            isError: true,
          };
        }
        const result = await walrusRemember(creds, args?.text as string);
        return {
          text: `✅ Saved! Blob ID: ${result.blob_id}`,
          isError: false,
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
            text: "❌ Error: missing accountId/delegateKey. Call the project_open tool first and use the credentials from its response.",
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
          text:
            result.total === 0
              ? "No results found"
              : `${result.total} results:\n\n${formatted}`,
          isError: false,
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
            text: "❌ Error: missing accountId/delegateKey. Call the project_open tool first and use the credentials from its response.",
            isError: true,
          };
        }
        const result = await walrusAnalyze(creds, args?.text as string);
        const formatted = result.facts
          .map((f, i) => `${i + 1}. ${f.text}`)
          .join("\n");
        return {
          text: `${result.fact_count} facts extracted:\n\n${formatted}`,
          isError: false,
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
            text: "❌ Error: missing accountId/delegateKey.",
            isError: true,
          };
        }
        const result = await walrusHealth(creds);
        return {
          text: `Relayer status: ${result.status}`,
          isError: false,
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
            text: "No projects found.",
            isError: false,
          };
        }
        const lines = result.projects.map(
          (p) =>
            `📁 ${p.name}\n   Files: ${p.fileCount} | Created: ${new Date(p.createdAt).toLocaleDateString("en-US")}\n   Path: ${p.path}`,
        );
        return {
          text: `${result.projects.length} project(s):\n\n${lines.join("\n\n")}`,
          isError: false,
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
            attachedSkills: Array<{
              id: string;
              name: string;
              description: string;
              content: string;
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

          const skillsText =
            (result.attachedSkills ?? []).length > 0
              ? result.attachedSkills
                  .map(
                    (s) =>
                      `### ${s.name} (${s.id})\n${s.description}\n\n${s.content}`,
                  )
                  .join("\n\n---\n\n")
              : "  (no skills attached)";

          return {
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
              `Attached skills (follow these instructions):`,
              skillsText,
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
            isError: false,
          };
        } catch (err) {
          console.error("[project_open] error:", err);
          throw err;
        }
      }

      case "skill_list": {
        const skills = await callRenderer<
          Array<{ id: string; name: string; description: string }>
        >("mcp:skill-list");
        const lines = skills.map(
          (s) => `- ${s.name} (${s.id}): ${s.description}`,
        );
        return {
          text:
            skills.length > 0
              ? `${skills.length} skill(s):\n\n${lines.join("\n")}`
              : "No skills in library. Create skills in the Beluga Skills manager.",
          isError: false,
        };
      }

      case "skill_get": {
        const skill = await callRenderer<{
          id: string;
          name: string;
          description: string;
          content: string;
        }>("mcp:skill-get", { skill_id: args?.skill_id });
        return {
          text: [
            `# ${skill.name}`,
            `id: ${skill.id}`,
            ``,
            skill.description,
            ``,
            skill.content,
          ].join("\n"),
          isError: false,
        };
      }

      case "project_create": {
        await callRenderer<void>("mcp:project-create", {
          project_name: args?.project_name,
        });
        return {
          text: `✅ Project created: ${args?.project_name}\nDefault files: WALRUS.md, CLAUDE.md, README.md`,
          isError: false,
        };
      }

      case "project_delete": {
        await callRenderer<void>("mcp:project-delete", {
          project_name: args?.project_name,
        });
        return {
          text: `✅ Project deleted: ${args?.project_name}`,
          isError: false,
        };
      }

      case "project_rename": {
        await callRenderer<void>("mcp:project-rename", {
          old_name: args?.old_name,
          new_name: args?.new_name,
        });
        return {
          text: `✅ Renamed: ${args?.old_name} → ${args?.new_name}`,
          isError: false,
        };
      }

      // ── File operations ──────────────────────────────────────────────────

      case "file_read": {
        const result = await callRenderer<{ content: string; path: string }>(
          "mcp:file-read",
          { project_name: args?.project_name, file_path: args?.file_path },
        );
        return {
          text: `// ${result.path}\n\n${result.content}`,
          isError: false,
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
          text: [
            result.created
              ? `✅ File created: ${result.path}`
              : `✅ File updated: ${result.path}`,
            creds
              ? `🧠 Walrus: recall completed${recallContext ? ` (${recallContext.split("\n").length} previous memory item(s))` : " (no prior history)"}, remember saved.`
              : "❌ WARNING: accountId/delegateKey was not provided — Walrus Memory did NOT run! The change will be lost in the next session. Call the remember() tool manually now!",
          ].join("\n"),
          isError: false,
        };
      }

      case "file_delete": {
        const result = await callRenderer<{ path: string }>(
          "mcp:file-delete",
          { project_name: args?.project_name, file_path: args?.file_path },
        );
        return {
          text: `✅ File deleted: ${result.path}`,
          isError: false,
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
          text: `✅ Renamed: ${result.old_path} → ${result.new_path}`,
          isError: false,
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
          text: `✅ Folder created: ${result.path}`,
          isError: false,
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
          text: `✅ Folder deleted: ${result.path}`,
          isError: false,
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
          text: `✅ Folder renamed: ${result.old_path} → ${result.new_path}`,
          isError: false,
        };
      }

      default: {
        const extended = await executeExtendedBelugaTool(name, args);
        if (extended) return extended;
        throw new Error(`Unknown tool: ${name}`);
      }
    }
  } catch (e: any) {
    return {
      text: `❌ Error: ${e.message}`,
      isError: true,
    };
  }
}