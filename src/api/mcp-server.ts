import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import http from "node:http";
import { randomUUID } from "node:crypto";
import {
  getToolsForSet,
  type McpToolSetId,
} from "../helper/beluga-tool-catalog";
import { executeBelugaTool } from "../helper/beluga-tool-runner";

const MCP_PORT = 47823;

const MCP_PATH_SETS: Record<string, McpToolSetId> = {
  "/mcp": "all",
  "/mcp/core": "core",
  "/mcp/playground": "playground",
  "/mcp/packages": "packages",
  "/mcp/tools": "tools",
  "/mcp/wallet": "wallet",
};

function buildServer(toolSet: McpToolSetId): Server {
  const tools = getToolsForSet(toolSet);
  const server = new Server(
    { name: `beluga-mcp-${toolSet}`, version: "1.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const result = await executeBelugaTool(
      name,
      args as Record<string, unknown> | undefined,
    );
    return {
      content: [{ type: "text", text: result.text }],
      ...(result.isError ? { isError: true } : {}),
    };
  });

  return server;
}

let httpServer: http.Server | null = null;

export function startMcpHttpServer(): void {
  const sseTransports = new Map<
    string,
    { transport: any; server: Server; toolSet: McpToolSetId }
  >();

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

    const pathname = req.url?.split("?")[0] ?? "";
    const toolSet = MCP_PATH_SETS[pathname];

    if (toolSet && req.method === "POST") {
      try {
        const { StreamableHTTPServerTransport } =
          await import("@modelcontextprotocol/sdk/server/streamableHttp.js");
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: false,
        });
        const server = buildServer(toolSet);
        await server.connect(transport);
        await transport.handleRequest(req, res);
        res.on("finish", () => server.close().catch(() => {}));
      } catch (e: any) {
        console.error(`[MCP] Streamable HTTP error (${pathname}):`, e);
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message }));
        }
      }
      return;
    }

    if (req.method === "GET" && pathname === "/sse") {
      const setParam = new URL(req.url ?? "", `http://0.0.0.0:${MCP_PORT}`)
        .searchParams.get("set");
      const sseSets: Record<string, McpToolSetId> = {
        core: "core",
        playground: "playground",
        packages: "packages",
        tools: "tools",
        wallet: "wallet",
        all: "all",
      };
      const toolSet: McpToolSetId = sseSets[setParam ?? ""] ?? "all";

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
        const server = buildServer(toolSet);
        sseTransports.set(sessionId, { transport, server, toolSet });
        console.log(`[MCP] SSE client connected: ${sessionId} (${toolSet})`);
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

    if (req.method === "POST" && pathname === "/message") {
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

    if (req.method === "GET" && pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          activeSseSessions: sseTransports.size,
          endpoints: Object.fromEntries(
            Object.entries(MCP_PATH_SETS).map(([path, set]) => [
              path,
              {
                toolSet: set,
                toolCount: getToolsForSet(set).length,
                streamableHttp: `http://0.0.0.0:${MCP_PORT}${path}`,
              },
            ]),
          ),
          sse: `http://0.0.0.0:${MCP_PORT}/sse?set=playground`,
          ssePost: `http://0.0.0.0:${MCP_PORT}/message`,
        }),
      );
      return;
    }

    res.writeHead(404);
    res.end();
  });

  httpServer.listen(MCP_PORT, "0.0.0.0", () => {
    console.log("[MCP] Server running:");
    for (const [path, set] of Object.entries(MCP_PATH_SETS)) {
      console.log(
        `  ${path.padEnd(18)} ${set} (${getToolsForSet(set).length} tools)`,
      );
    }
    console.log(`  SSE (fallback)  : http://0.0.0.0:${MCP_PORT}/sse`);
    console.log(`  Health check    : http://0.0.0.0:${MCP_PORT}/health`);
  });
}

export function stopMcpServer(): void {
  httpServer?.close(() => console.log("[MCP] Stopped"));
  httpServer = null;
}

export const MCP_URL = `http://0.0.0.0:${MCP_PORT}`;