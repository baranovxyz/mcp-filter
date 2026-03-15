#!/usr/bin/env node
/**
 * MCP server that returns paginated tool lists.
 * Used to test that the proxy drains all pages before filtering.
 *
 * Page 1 (no cursor): returns allowed_tool_1, allowed_tool_2
 * Page 2 (cursor=page2): returns blocked_tool, allowed_tool_3
 *
 * Without pagination support, the proxy would never see blocked_tool
 * and it would leak through to the downstream client on a re-list.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "paginated-test-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

const PAGE_1_TOOLS = [
  {
    name: "allowed_tool_1",
    description: "First allowed tool",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "allowed_tool_2",
    description: "Second allowed tool",
    inputSchema: { type: "object" as const, properties: {} },
  },
];

const PAGE_2_TOOLS = [
  {
    name: "blocked_tool",
    description: "This tool should be blocked by filter",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "allowed_tool_3",
    description: "Third allowed tool (on page 2)",
    inputSchema: { type: "object" as const, properties: {} },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async (request) => {
  const cursor = request.params?.cursor;

  if (!cursor) {
    // First page
    return {
      tools: PAGE_1_TOOLS,
      nextCursor: "page2",
    };
  }

  if (cursor === "page2") {
    // Second (and last) page
    return {
      tools: PAGE_2_TOOLS,
    };
  }

  // Unknown cursor
  return { tools: [] };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => ({
  content: [
    {
      type: "text",
      text: `Called: ${request.params.name}`,
    },
  ],
}));

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
