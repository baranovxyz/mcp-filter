#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { parseArgs } from "./cli.js";
import { Filter } from "./filter.js";
import { logger } from "./logger.js";
import { ProxyServer } from "./proxy.js";
import { createClientTransport } from "./transport.js";

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);

  let config;
  try {
    config = parseArgs(args);
  } catch (error) {
    const helpText = `Usage:
  mcp-filter [options] -- <command> [args...]           # stdio transport
  mcp-filter [options] --upstream-url <url>             # HTTP transport

Options:
  --exclude <pattern>     Exclude items matching pattern
  --include <pattern>     Include items matching pattern
  --upstream-url <url>    Connect to HTTP/SSE server (mutually exclusive with --)
  --transport <type>      Transport type: stdio, http, sse (auto-detected if omitted)
  --header <header>       Add HTTP header (format: 'Key: Value', HTTP/SSE only)
  --help, -h              Show this help message

Examples:
  # Stdio transport (local servers)
  mcp-filter --exclude "test*" -- npx tsx test-server.ts

  # HTTP transport (remote servers)
  mcp-filter --exclude "dangerous_*" --upstream-url https://mcp.notion.com/mcp

  # SSE transport (deprecated, legacy servers)
  mcp-filter --transport sse --upstream-url https://mcp.asana.com/sse`;

    if ((error as Error).message === "help") {
      logger.log(helpText);
      process.exit(0);
    }

    logger.error((error as Error).message);
    logger.log(helpText);
    process.exit(1);
  }

  logger.info(`Starting MCP filter with ${config.patterns.length} pattern(s)`);
  config.patterns.forEach((p) =>
    logger.info(`  ${p.type === "include" ? "Include" : "Exclude"}: ${p.pattern}`)
  );

  const hasInclude = config.patterns.some((p) => p.type === "include");
  const hasExclude = config.patterns.some((p) => p.type === "exclude");

  if (hasInclude && hasExclude) {
    logger.info(
      "Note: Using rsync-style filtering - patterns evaluated in order, first match wins."
    );
  }

  logger.info(`Transport: ${config.transportConfig.type}`);

  // Create filter
  const filter = new Filter(config.patterns);

  // Create proxy server
  const proxy = new ProxyServer(
    {
      name: "mcp-filter",
      version: "0.6.0",
    },
    filter
  );

  // Connect client to upstream server
  // Transport factory handles creating the appropriate transport (stdio, http, sse)
  const clientTransport = createClientTransport(config.transportConfig);

  await proxy.getClient().connect(clientTransport);
  logger.success("Connected to upstream server");

  // Connect server to current process stdio (for the MCP client calling us)
  const serverTransport = new StdioServerTransport();
  await proxy.getServer().connect(serverTransport);
  logger.success("MCP filter proxy ready");

  // Handle cleanup
  const cleanup = () => {
    logger.info("Shutting down...");
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

main().catch((error) => {
  logger.fatal(error);
  process.exit(1);
});
