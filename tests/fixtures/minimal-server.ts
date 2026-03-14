#!/usr/bin/env node
/**
 * Minimal MCP test server with only tools capability.
 * Used to test that the proxy does NOT advertise resources/prompts
 * when upstream doesn't support them.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "minimal-server", version: "1.0.0" },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "test_tool",
      description: "A test tool",
      inputSchema: {
        type: "object" as const,
        properties: {},
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => ({
  content: [
    { type: "text", text: `Called: ${request.params.name}` },
  ],
}));

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
