#!/usr/bin/env node
/**
 * Full-featured MCP test server exposing tools, resources, AND prompts.
 * Used for testing that all three MCP primitive types are filtered correctly.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "full-test-server", version: "1.0.0" },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
);

// --- Tools ---
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "allowed_tool",
      description: "This tool should be allowed",
      inputSchema: {
        type: "object" as const,
        properties: { message: { type: "string" } },
      },
    },
    {
      name: "blocked_tool",
      description: "This tool should be blocked",
      inputSchema: {
        type: "object" as const,
        properties: { message: { type: "string" } },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name } = request.params;
  if (name === "allowed_tool") {
    return {
      content: [
        { type: "text", text: `Allowed: ${request.params.arguments?.message}` },
      ],
    };
  }
  if (name === "blocked_tool") {
    return {
      content: [
        { type: "text", text: `Blocked: ${request.params.arguments?.message}` },
      ],
    };
  }
  throw new Error(`Unknown tool: ${name}`);
});

// --- Resources ---
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: "file:///allowed_resource.txt",
      name: "allowed_resource",
      description: "This resource should be allowed",
    },
    {
      uri: "file:///blocked_resource.txt",
      name: "blocked_resource",
      description: "This resource should be blocked",
    },
    {
      uri: "file:///other_resource.txt",
      name: "other_resource",
      description: "Another resource for testing",
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  return {
    contents: [
      {
        uri,
        text: `Content of ${uri}`,
        mimeType: "text/plain",
      },
    ],
  };
});

// --- Prompts ---
server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: [
    {
      name: "allowed_prompt",
      description: "This prompt should be allowed",
      arguments: [{ name: "topic", description: "Topic to discuss", required: true }],
    },
    {
      name: "blocked_prompt",
      description: "This prompt should be blocked",
      arguments: [{ name: "topic", description: "Topic to discuss", required: true }],
    },
    {
      name: "other_prompt",
      description: "Another prompt for testing",
    },
  ],
}));

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name } = request.params;
  return {
    description: `Generated prompt for ${name}`,
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `This is the ${name} prompt. Topic: ${request.params.arguments?.topic ?? "default"}`,
        },
      },
    ],
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
