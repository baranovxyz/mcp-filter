#!/usr/bin/env node
/**
 * Local SSE MCP server fixture for integration testing.
 * Uses SSEServerTransport (deprecated but needs test coverage) with Express.
 *
 * Endpoints:
 *   GET  /sse       → SSE stream (client connects here)
 *   POST /messages  → receives JSON-RPC messages from client
 *
 * Usage: npx tsx tests/fixtures/sse-server.ts [port]
 * Prints "LISTENING:<port>" to stdout when ready.
 */
import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

function createMcpServer(): Server {
  const server = new Server(
    { name: "sse-test-server", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "allowed_tool",
        description: "This tool should be allowed",
        inputSchema: { type: "object" as const, properties: { message: { type: "string" } } },
      },
      {
        name: "blocked_tool",
        description: "This tool should be blocked",
        inputSchema: { type: "object" as const, properties: { message: { type: "string" } } },
      },
      {
        name: "another_tool",
        description: "Another test tool",
        inputSchema: { type: "object" as const, properties: {} },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => ({
    content: [
      {
        type: "text",
        text: `Called: ${request.params.name} with ${JSON.stringify(request.params.arguments)}`,
      },
    ],
  }));

  return server;
}

const app = express();
app.use(express.json());

const transports = new Map<string, SSEServerTransport>();

// SSE endpoint: client connects here for server-sent events
app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  const sessionId = transport.sessionId;
  transports.set(sessionId, transport);

  transport.onclose = () => {
    transports.delete(sessionId);
  };

  const mcpServer = createMcpServer();
  // connect() calls transport.start() internally — do NOT call start() again
  await mcpServer.connect(transport);
});

// Message endpoint: receives JSON-RPC messages from client
app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = sessionId ? transports.get(sessionId) : undefined;

  if (!transport) {
    res.status(400).json({ error: "Invalid session ID" });
    return;
  }

  await transport.handlePostMessage(req, res, req.body);
});

const port = parseInt(process.argv[2] || "0", 10);

const server = app.listen(port, "127.0.0.1", () => {
  const addr = server.address();
  const actualPort = typeof addr === "object" && addr ? addr.port : port;
  process.stdout.write(`LISTENING:${actualPort}\n`);
});

process.on("SIGTERM", () => {
  for (const t of transports.values()) t.close();
  server.close();
  process.exit(0);
});
process.on("SIGINT", () => {
  for (const t of transports.values()) t.close();
  server.close();
  process.exit(0);
});
