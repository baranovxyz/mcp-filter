#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { parseArgs } from "./cli.js";
import { Filter } from "./filter.js";
import { ProxyServer } from "./proxy.js";

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);

  let config;
  try {
    config = parseArgs(args);
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    console.error(
      "Usage: mcp-filter [--exclude <pattern>]... [--include <pattern>]... -- <upstream-command> [args...]"
    );
    console.error("Examples:");
    console.error(
      '  mcp-filter --exclude "playwright*" -- npx @playwright/mcp'
    );
    console.error(
      '  mcp-filter --include "browser_navigate" --include "browser_screenshot" -- npx @playwright/mcp'
    );
    console.error(
      '  mcp-filter --include "browser_*" --exclude "browser_close" -- npx @playwright/mcp'
    );
    process.exit(1);
  }

  console.error(
    `Starting MCP filter with ${config.patterns.length} pattern(s)`
  );
  config.patterns.forEach((p) =>
    console.error(
      `  ${p.type === "include" ? "Include" : "Exclude"}: ${p.pattern}`
    )
  );

  const hasInclude = config.patterns.some((p) => p.type === "include");
  const hasExclude = config.patterns.some((p) => p.type === "exclude");

  if (hasInclude && hasExclude) {
    console.error(
      "Note: Using rsync-style filtering - patterns evaluated in order, first match wins."
    );
  }

  // Create filter
  const filter = new Filter(config.patterns);

  // Create proxy server
  const proxy = new ProxyServer(
    {
      name: "mcp-filter",
      version: "0.2.0",
    },
    filter
  );

  // Connect client to upstream server via subprocess stdio
  // StdioClientTransport spawns and manages the subprocess
  const clientTransport = new StdioClientTransport({
    command: config.upstreamCommand[0],
    args: config.upstreamCommand.slice(1),
    env: process.env as Record<string, string>, // Pass current environment
    stderr: "inherit", // Forward upstream stderr to our stderr
  });

  await proxy.getClient().connect(clientTransport);
  console.error("Connected to upstream server");

  // Connect server to current process stdio (for the MCP client calling us)
  const serverTransport = new StdioServerTransport();
  await proxy.getServer().connect(serverTransport);
  console.error("MCP filter proxy ready");

  // Handle cleanup
  const cleanup = () => {
    console.error("Shutting down...");
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
