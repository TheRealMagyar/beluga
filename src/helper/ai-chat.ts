import {
  BELUGA_ALL_TOOLS,
  toXaiResponsesTools,
} from "./beluga-tool-catalog";
import { executeBelugaTool } from "./beluga-tool-runner";
import { normalizeApiKey, validateApiKeyFormat } from "./ai-api-key";

const XAI_API_BASE = "https://api.x.ai/v1";
/** API round-trips that include tool calls (not individual tools per round). */
const MAX_TOOL_TURNS = 40;

export type AiChatRole = "system" | "user" | "assistant" | "tool";

export interface AiToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface AiChatMessage {
  role: AiChatRole;
  content: string | null;
  tool_calls?: AiToolCall[];
  tool_call_id?: string;
}

export interface AiStreamCallbacks {
  onChunk: (delta: string) => void;
  onToolCall: (
    toolCallId: string,
    toolName: string,
    args: Record<string, unknown>,
    argsDisplay: string,
  ) => void;
  onToolResult: (
    toolCallId: string,
    toolName: string,
    result: string,
  ) => void;
  onDone: (usage?: { promptTokens: number; completionTokens: number }) => void;
  onError: (message: string) => void;
}

export function buildBelugaSystemPrompt(
  pageContext?: string,
  allowToolUse?: boolean,
): string {
  const base = `You are Beluga Assistant, an AI helper embedded in the Beluga desktop app.

Beluga is a hub for Sui/Walrus development with these modules:
- Memory: Walrus persistent memory linked to projects
- Projects: local project manager with beluga.json metadata
- Skills: reusable instruction files linkable to projects
- Playground: Move/Sui localnet playground
- Packages: toolchain and dependency manager
- Tools: token scanner, NFT manager, gRPC explorer, etc.
- MCP: external AI agents connect via Model Context Protocol

Answer concisely and practically. When unsure about Beluga-specific behavior, say so rather than guessing.`;

  const toolHint = allowToolUse
    ? `

You have access to all Beluga MCP tools:
- Core: projects, files, folders, skills, Walrus memory (remember/recall)
- Playground: Sui/Ika localnet start/stop, logs, Move build/publish, dWallet create/list, DeFi sandbox, PTB builder, localnet wallet inspector (coins/NFTs/objects)
- Packages: install/update/uninstall SDK packages, link packages to projects
- Tools: token scanner, token/NFT package generator, gRPC queries, tx graph
- Wallet: balance, faucet, send SUI, wallet info
- Git/GitHub: status, commit, push, pull, merge, branches, create/link GitHub repos (requires GitHub token in Settings)

Use tools proactively when the user asks to develop, deploy, manage localnet, or use Beluga features.
Always call project_open before working on a project, then recall() if memory is attached.
For Playground deploy: playground_write_files (replaces workspace) → playground_build → playground_publish (wallet + localnet/faucet).
For DeFi sandbox (beluga_defi AMM): playground_start_sui_localnet → playground_request_faucet → playground_defi_deploy_sandbox → playground_defi_faucet → playground_defi_create_pool (e.g. sui + tb) → playground_defi_add_liquidity → playground_defi_swap. Use playground_defi_get_deployment / playground_defi_list_pools / playground_defi_get_pool_snapshot to inspect state. Localnet or testnet only.
For PTB Playground: playground_ptb_list_templates → playground_ptb_load_template or playground_ptb_set_draft → playground_ptb_preview → playground_ptb_execute. Steps: moveCall, splitCoins, mergeCoins, transferObjects. Args: gas, object id, pure (u64/u8/bool/address/string), or ref to prior step output.
For localnet wallet inspection: playground_list_wallets → playground_get_wallet_assets({ address }). Returns coin types, balances, coin object IDs, and owned NFTs/objects with types — use object IDs in PTB or DeFi steps.
Move 2024: structs need public visibility; use vector[] not vector::empty().
For Ika dWallet: playground_start_ika_stack → playground_heal_ika if needed → wallet_request_faucet → playground_create_dwallet.
Destructive actions (delete, reset, wallet_generate, send_sui) require explicit user confirmation first.
Be efficient: batch related steps, avoid repeating status checks unless needed, prefer one tool call per logical step.`
    : "";

  const pageHint = pageContext ? `\n\nThe user is currently viewing: ${pageContext}` : "";
  return `${base}${toolHint}${pageHint}`;
}

function extractApiErrorMessage(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as {
      error?: string | { message?: string; code?: string };
      message?: string;
      detail?: string;
      code?: string;
    };
    if (typeof parsed.error === "string") return parsed.error;
    return (
      parsed.error?.message ??
      parsed.message ??
      parsed.detail ??
      (parsed.code ? `API error: ${parsed.code}` : null)
    );
  } catch {
    return null;
  }
}

function friendlyApiError(status: number, body: string): string {
  const detail = extractApiErrorMessage(body);
  if (status === 401 || (status === 400 && detail?.toLowerCase().includes("api key"))) {
    return detail ?? "Invalid API key. Create a new one at console.x.ai → API Keys.";
  }
  if (status === 403) {
    return (
      detail ??
      "API access denied. Grok/X subscription does not include API usage — add prepaid credits at console.x.ai → Billing, or switch to Grok 3 Fast."
    );
  }
  if (status === 429) {
    return detail ?? "Rate limit reached. Wait a moment and try again.";
  }
  if (status === 400) {
    return detail ?? `Bad request. (${body.slice(0, 180)})`;
  }
  if (status >= 500) {
    return detail ?? "xAI service is temporarily unavailable.";
  }
  return detail ?? `Request failed (${status}).`;
}

type ResponsesOutputItem = {
  type: string;
  role?: string;
  call_id?: string;
  name?: string;
  arguments?: unknown;
  content?: Array<{ type: string; text?: string }>;
};

function normalizeArgumentsField(raw: unknown): string {
  if (raw == null) return "{}";
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return trimmed || "{}";
  }
  if (typeof raw === "object") {
    try {
      return JSON.stringify(raw);
    } catch {
      return "{}";
    }
  }
  return "{}";
}

export function parseToolArguments(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return {};
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // keep empty — display layer shows raw string
    }
  }
  return {};
}

export function formatToolArgumentsDisplay(raw: unknown): string {
  const parsed = parseToolArguments(raw);
  if (Object.keys(parsed).length > 0) {
    return JSON.stringify(parsed, null, 2);
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed) return trimmed;
  }
  return "{}";
}

type ResponsesApiResult = {
  content: string;
  toolCalls: AiToolCall[];
  usage?: { promptTokens: number; completionTokens: number };
};

function buildResponsesInput(messages: AiChatMessage[]): unknown[] {
  const input: unknown[] = [];

  for (const msg of messages) {
    if (msg.role === "system" || msg.role === "user") {
      input.push({ role: msg.role, content: msg.content ?? "" });
      continue;
    }

    if (msg.role === "assistant") {
      if (msg.tool_calls?.length) {
        for (const tc of msg.tool_calls) {
          input.push({
            type: "function_call",
            call_id: tc.id,
            name: tc.function.name,
            arguments: tc.function.arguments,
          });
        }
      }
      if (msg.content?.trim()) {
        input.push({ role: "assistant", content: msg.content });
      }
      continue;
    }

    if (msg.role === "tool" && msg.tool_call_id) {
      input.push({
        type: "function_call_output",
        call_id: msg.tool_call_id,
        output: msg.content ?? "",
      });
    }
  }

  return input;
}

function parseResponsesOutput(output: ResponsesOutputItem[] | undefined): ResponsesApiResult {
  let content = "";
  const toolCalls: AiToolCall[] = [];

  for (const item of output ?? []) {
    if (item.type === "message") {
      for (const part of item.content ?? []) {
        if (part.type === "output_text" && part.text) {
          content += part.text;
        }
      }
      continue;
    }

    if (item.type === "function_call" && item.call_id && item.name) {
      toolCalls.push({
        id: item.call_id,
        type: "function",
        function: {
          name: item.name,
          arguments: normalizeArgumentsField(item.arguments),
        },
      });
    }
  }

  return { content, toolCalls };
}

async function requestResponses(params: {
  apiKey: string;
  model: string;
  input: unknown[];
  tools?: ReturnType<typeof toXaiResponsesTools>;
  signal?: AbortSignal;
}): Promise<ResponsesApiResult> {
  const res = await fetch(`${XAI_API_BASE}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${normalizeApiKey(params.apiKey)}`,
    },
    body: JSON.stringify({
      model: params.model,
      input: params.input,
      store: false,
      ...(params.tools?.length
        ? { tools: params.tools, tool_choice: "auto" }
        : {}),
    }),
    signal: params.signal,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(friendlyApiError(res.status, text));
  }

  const data = (await res.json()) as {
    output?: ResponsesOutputItem[];
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
    };
  };

  const parsed = parseResponsesOutput(data.output);

  return {
    ...parsed,
    usage: data.usage
      ? {
          promptTokens: data.usage.input_tokens ?? 0,
          completionTokens: data.usage.output_tokens ?? 0,
        }
      : undefined,
  };
}

const FALLBACK_TEST_MODEL = "grok-3-fast";

function isAccessDeniedError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("access denied") ||
    lower.includes("permission") ||
    lower.includes("subscription") ||
    lower.includes("forbidden")
  );
}

function isBearerToken(value: string): boolean {
  return value.startsWith("eyJ");
}

export async function testAiConnection(apiKey: string, model: string): Promise<{
  ok: boolean;
  message: string;
  suggestedModel?: string;
}> {
  const normalized = normalizeApiKey(apiKey);
  if (!isBearerToken(normalized)) {
    const formatError = validateApiKeyFormat(normalized);
    if (formatError) {
      return { ok: false, message: formatError };
    }
  }

  const ping = async (testModel: string) =>
    requestResponses({
      apiKey: normalized,
      model: testModel,
      input: [{ role: "user", content: "ping" }],
    });

  try {
    await ping(model);
    return { ok: true, message: `Connection successful (${model}).` };
  } catch (err) {
    const primary =
      err instanceof Error ? err.message : "Network error.";

    if (
      model !== FALLBACK_TEST_MODEL &&
      isAccessDeniedError(primary)
    ) {
      try {
        await ping(FALLBACK_TEST_MODEL);
        return {
          ok: true,
          message: `Key works with ${FALLBACK_TEST_MODEL}. ${model} is not enabled on your account — switch model in Settings or add API credits at console.x.ai.`,
          suggestedModel: FALLBACK_TEST_MODEL,
        };
      } catch {
        // fall through
      }
    }

    return { ok: false, message: primary };
  }
}

async function streamAiChatAgentic(params: {
  apiKey: string;
  model: string;
  messages: AiChatMessage[];
  signal?: AbortSignal;
  callbacks: AiStreamCallbacks;
}): Promise<void> {
  const tools = toXaiResponsesTools(BELUGA_ALL_TOOLS);
  const conversation = [...params.messages];
  const totalUsage = { promptTokens: 0, completionTokens: 0 };

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const result = await requestResponses({
      apiKey: params.apiKey,
      model: params.model,
      input: buildResponsesInput(conversation),
      tools,
      signal: params.signal,
    });

    if (result.usage) {
      totalUsage.promptTokens += result.usage.promptTokens;
      totalUsage.completionTokens += result.usage.completionTokens;
    }

    if (result.toolCalls.length > 0) {
      conversation.push({
        role: "assistant",
        content: result.content || null,
        tool_calls: result.toolCalls,
      });

      const toolResults = await Promise.all(
        result.toolCalls.map(async (tc) => {
          const rawArgs = tc.function.arguments;
          const parsedArgs = parseToolArguments(rawArgs);
          const argsDisplay = formatToolArgumentsDisplay(rawArgs);

          params.callbacks.onToolCall(
            tc.id,
            tc.function.name,
            parsedArgs,
            argsDisplay,
          );

          const toolResult = await executeBelugaTool(
            tc.function.name,
            parsedArgs,
          );
          params.callbacks.onToolResult(
            tc.id,
            tc.function.name,
            toolResult.text,
          );
          return { tc, toolResult };
        }),
      );

      for (const { tc, toolResult } of toolResults) {
        conversation.push({
          role: "tool",
          tool_call_id: tc.id,
          content: toolResult.text,
        });
      }
      continue;
    }

    const text = result.content.trim();
    if (text) {
      params.callbacks.onChunk(text);
    } else {
      params.callbacks.onError("The model returned an empty response.");
      return;
    }

    params.callbacks.onDone(
      totalUsage.promptTokens + totalUsage.completionTokens > 0
        ? totalUsage
        : result.usage,
    );
    return;
  }

  try {
    const summary = await requestResponses({
      apiKey: params.apiKey,
      model: params.model,
      input: [
        ...buildResponsesInput(conversation),
        {
          role: "user",
          content:
            "You hit the tool-call step limit. Summarize what was completed, what failed, and the exact next step for the user. Be concise.",
        },
      ],
      signal: params.signal,
    });

    const text = summary.content.trim();
    if (text) {
      params.callbacks.onChunk(
        `${text}\n\n_(Tool step limit reached — say "continue" to pick up where we left off.)_`,
      );
      params.callbacks.onDone(summary.usage);
      return;
    }
  } catch {
    // fall through
  }

  params.callbacks.onError(
    "Too many tool steps for one request. Say \"continue\" to resume, or split into smaller tasks.",
  );
}

async function streamAiChatSimple(params: {
  apiKey: string;
  model: string;
  messages: AiChatMessage[];
  signal?: AbortSignal;
  callbacks: AiStreamCallbacks;
}): Promise<void> {
  const result = await requestResponses({
    apiKey: params.apiKey,
    model: params.model,
    input: buildResponsesInput(params.messages),
    signal: params.signal,
  });

  const text = result.content.trim();
  if (!text) {
    params.callbacks.onError("The model returned an empty response.");
    return;
  }

  params.callbacks.onChunk(text);
  params.callbacks.onDone(result.usage);
}

export async function streamAiChat(params: {
  apiKey: string;
  model: string;
  messages: AiChatMessage[];
  allowToolUse?: boolean;
  signal?: AbortSignal;
  callbacks: AiStreamCallbacks;
}): Promise<void> {
  const { apiKey, model, messages, allowToolUse, signal, callbacks } = params;

  const normalized = normalizeApiKey(apiKey);
  if (!isBearerToken(normalized)) {
    const formatError = validateApiKeyFormat(normalized);
    if (formatError) {
      callbacks.onError(formatError);
      return;
    }
  }

  try {
    if (allowToolUse) {
      await streamAiChatAgentic({
        apiKey: normalized,
        model,
        messages,
        signal,
        callbacks,
      });
      return;
    }

    await streamAiChatSimple({
      apiKey: normalized,
      model,
      messages,
      signal,
      callbacks,
    });
  } catch (err) {
    if (signal?.aborted) return;
    callbacks.onError(err instanceof Error ? err.message : "Request error.");
  }
}