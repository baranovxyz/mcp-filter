#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

/**
 * Fixture MCP server simulating browser tools like @playwright/mcp
 * Used for validating README.md examples
 */
const server = new McpServer({
  name: "browser-test-server",
  version: "1.0.0",
});

// Safe, read-only browser tools
server.tool(
  "browser_navigate",
  {
    description: "Navigate to a URL",
    inputSchema: { url: z.string() },
  },
  async ({ url }) => ({
    content: [{ type: "text", text: `Navigated to ${url}` }],
  })
);

server.tool(
  "browser_screenshot",
  {
    description: "Take a screenshot (deprecated name)",
    inputSchema: {},
  },
  async () => ({
    content: [{ type: "text", text: "Screenshot taken" }],
  })
);

server.tool(
  "browser_take_screenshot",
  {
    description: "Take a screenshot",
    inputSchema: {},
  },
  async () => ({
    content: [{ type: "text", text: "Screenshot taken" }],
  })
);

server.tool(
  "browser_snapshot",
  {
    description: "Capture accessibility snapshot",
    inputSchema: {},
  },
  async () => ({
    content: [{ type: "text", text: "Snapshot captured" }],
  })
);

server.tool(
  "browser_console_messages",
  {
    description: "Get console messages",
    inputSchema: {},
  },
  async () => ({
    content: [{ type: "text", text: "Console messages: []" }],
  })
);

server.tool(
  "browser_network_requests",
  {
    description: "Get network requests",
    inputSchema: {},
  },
  async () => ({
    content: [{ type: "text", text: "Network requests: []" }],
  })
);

// Interactive/write operations (potentially dangerous)
server.tool(
  "browser_click",
  {
    description: "Click an element",
    inputSchema: { element: z.string(), ref: z.string() },
  },
  async ({ element }) => ({
    content: [{ type: "text", text: `Clicked ${element}` }],
  })
);

server.tool(
  "browser_type",
  {
    description: "Type text into an element",
    inputSchema: { element: z.string(), ref: z.string(), text: z.string() },
  },
  async ({ element, text }) => ({
    content: [{ type: "text", text: `Typed "${text}" into ${element}` }],
  })
);

server.tool(
  "browser_fill_form",
  {
    description: "Fill form fields",
    inputSchema: { fields: z.array(z.object({})) },
  },
  async () => ({
    content: [{ type: "text", text: "Form filled" }],
  })
);

// Dangerous/destructive operations
server.tool(
  "browser_close",
  {
    description: "Close the browser",
    inputSchema: {},
  },
  async () => ({
    content: [{ type: "text", text: "Browser closed" }],
  })
);

server.tool(
  "browser_evaluate",
  {
    description: "Evaluate JavaScript",
    inputSchema: { function: z.string() },
  },
  async ({ function: fn }) => ({
    content: [{ type: "text", text: `Evaluated: ${fn}` }],
  })
);

server.tool(
  "browser_tabs",
  {
    description: "Manage browser tabs",
    inputSchema: { action: z.string() },
  },
  async ({ action }) => ({
    content: [{ type: "text", text: `Tab action: ${action}` }],
  })
);

// Non-browser tool for testing wildcard filtering
server.tool(
  "other_tool",
  {
    description: "A tool that doesn't match browser_ pattern",
    inputSchema: { message: z.string().optional() },
  },
  async ({ message = "test" }) => ({
    content: [{ type: "text", text: `Other: ${message}` }],
  })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
