#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'simple-test-server',
  version: '1.0.0',
});

server.tool(
  'allowed_tool',
  {
    description: 'This tool should be allowed',
    inputSchema: { message: z.string() },
  },
  async ({ message }) => ({
    content: [{ type: 'text', text: `Allowed: ${message}` }],
  })
);

server.tool(
  'blocked_tool',
  {
    description: 'This tool should be blocked',
    inputSchema: { message: z.string() },
  },
  async ({ message }) => ({
    content: [{ type: 'text', text: `Blocked: ${message}` }],
  })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
