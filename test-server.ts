#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'test-server',
  version: '1.0.0',
});

// Add some test tools
server.tool(
  'echo',
  {
    description: 'Echo back a message',
    inputSchema: { message: z.string() },
  },
  async ({ message }) => ({
    content: [{ type: 'text', text: `Echo: ${message}` }],
  })
);

server.tool(
  'playwright_navigate',
  {
    description: 'Navigate to a URL (simulated)',
    inputSchema: { url: z.string() },
  },
  async ({ url }) => ({
    content: [{ type: 'text', text: `Navigated to: ${url}` }],
  })
);

server.tool(
  'playwright_click',
  {
    description: 'Click an element (simulated)',
    inputSchema: { selector: z.string() },
  },
  async ({ selector }) => ({
    content: [{ type: 'text', text: `Clicked: ${selector}` }],
  })
);

server.tool(
  'calculate',
  {
    description: 'Calculate a sum',
    inputSchema: { a: z.number(), b: z.number() },
  },
  async ({ a, b }) => ({
    content: [{ type: 'text', text: `Result: ${a + b}` }],
  })
);

// Add a test prompt
server.prompt(
  'greeting',
  {
    description: 'A greeting prompt',
    argsSchema: { name: z.string() },
  },
  ({ name }) => ({
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Hello, ${name}!`,
        },
      },
    ],
  })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Test MCP server running...');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
