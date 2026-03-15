#!/usr/bin/env node
/**
 * Full-featured MCP test server for spec compliance testing.
 * Supports: tools, resources, prompts, logging, completions, resource subscriptions.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
  CompleteRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "spec-test-server", version: "1.0.0" },
  {
    capabilities: {
      tools: { listChanged: true },
      resources: { subscribe: true, listChanged: true },
      prompts: { listChanged: true },
      logging: {},
      completions: {},
    },
    instructions:
      "This is a test server. Use allowed_tool for testing. Do not use blocked_tool.",
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
    {
      name: "slow_tool",
      description: "A slow tool that sends progress notifications",
      inputSchema: {
        type: "object" as const,
        properties: {},
      },
    },
    {
      name: "log_tool",
      description: "A tool that emits a logging message",
      inputSchema: {
        type: "object" as const,
        properties: {},
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
  const { name } = request.params;

  if (name === "log_tool") {
    await server.sendLoggingMessage({
      level: "warning",
      logger: "spec-server",
      data: "Log from log_tool",
    });
    return {
      content: [{ type: "text", text: "Log message sent" }],
    };
  }

  if (name === "slow_tool") {
    const progressToken = extra._meta?.progressToken;
    for (let i = 1; i <= 3; i++) {
      if (progressToken !== undefined) {
        await extra.sendNotification({
          method: "notifications/progress",
          params: {
            progressToken,
            progress: i,
            total: 3,
            message: `Step ${i} of 3`,
          },
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (extra.signal?.aborted) {
        return {
          content: [{ type: "text", text: "Cancelled" }],
          isError: true,
        };
      }
    }
    return {
      content: [{ type: "text", text: "Slow tool completed" }],
    };
  }

  return {
    content: [
      { type: "text", text: `Called: ${name} with ${JSON.stringify(request.params.arguments)}` },
    ],
  };
});

// --- Resources ---
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: "file:///allowed.txt",
      name: "allowed_resource",
      description: "Allowed resource",
    },
    {
      uri: "file:///blocked.txt",
      name: "blocked_resource",
      description: "Blocked resource",
    },
  ],
}));

server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
  resourceTemplates: [
    {
      uriTemplate: "file:///docs/{id}",
      name: "allowed_template",
      description: "Allowed template",
    },
    {
      uriTemplate: "file:///secret/{id}",
      name: "blocked_template",
      description: "Blocked template",
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => ({
  contents: [
    {
      uri: request.params.uri,
      text: `Content of ${request.params.uri}`,
      mimeType: "text/plain",
    },
  ],
}));

// --- Resource Subscriptions ---
const subscriptions = new Set<string>();

server.setRequestHandler(SubscribeRequestSchema, async (request) => {
  subscriptions.add(request.params.uri);
  return {};
});

server.setRequestHandler(UnsubscribeRequestSchema, async (request) => {
  subscriptions.delete(request.params.uri);
  return {};
});

// --- Prompts ---
server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: [
    {
      name: "allowed_prompt",
      description: "Allowed prompt",
      arguments: [{ name: "topic", description: "Topic", required: true }],
    },
    {
      name: "blocked_prompt",
      description: "Blocked prompt",
      arguments: [{ name: "topic", description: "Topic", required: true }],
    },
  ],
}));

server.setRequestHandler(GetPromptRequestSchema, async (request) => ({
  description: `Prompt: ${request.params.name}`,
  messages: [
    {
      role: "user",
      content: {
        type: "text",
        text: `${request.params.name}: ${request.params.arguments?.topic ?? "default"}`,
      },
    },
  ],
}));

// --- Completions ---
server.setRequestHandler(CompleteRequestSchema, async (request) => {
  const ref = request.params.ref;
  const argName = request.params.argument.name;
  const argValue = request.params.argument.value;

  if (ref.type === "ref/prompt") {
    // Return completions for prompt arguments
    const values = ["option1", "option2", "option3"].filter((v) =>
      v.startsWith(argValue)
    );
    return {
      completion: { values, hasMore: false },
    };
  }

  if (ref.type === "ref/resource") {
    const values = ["doc1", "doc2", "doc3"].filter((v) =>
      v.startsWith(argValue)
    );
    return {
      completion: { values, hasMore: false },
    };
  }

  return {
    completion: { values: [] },
  };
});

// --- Send a logging message on startup ---
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Emit a log message after connection to test logging forwarding
  await server.sendLoggingMessage({
    level: "info",
    logger: "spec-server",
    data: "Server started successfully",
  });
}

main();
