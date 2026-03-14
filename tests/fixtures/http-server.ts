#!/usr/bin/env node
/**
 * Local HTTP MCP server fixture for integration testing.
 * Uses StreamableHTTPServerTransport in stateless mode with Express.
 *
 * Usage: npx tsx tests/fixtures/http-server.ts [port]
 * Prints "LISTENING:<port>" to stdout when ready.
 */
import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

function createMcpServer(): Server {
  const server = new Server(
    { name: "http-test-server", version: "1.0.0" },
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

app.post("/mcp", async (req, res) => {
  try {
    const mcpServer = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
      enableJsonResponse: true,
    });

    res.on("close", () => transport.close());

    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

const port = parseInt(process.argv[2] || "0", 10);

const server = app.listen(port, "127.0.0.1", () => {
  const addr = server.address();
  const actualPort = typeof addr === "object" && addr ? addr.port : port;
  process.stdout.write(`LISTENING:${actualPort}\n`);
});

process.on("SIGTERM", () => { server.close(); process.exit(0); });
process.on("SIGINT", () => { server.close(); process.exit(0); });
