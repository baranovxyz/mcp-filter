#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { parseArgs } from "./cli.js";
import { Filter } from "./filter.js";
import { ProxyServer } from "./proxy.js";
import { createClientTransport } from "./transport.js";

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);

  let config;
  try {
    config = parseArgs(args);
  } catch (error) {
    if ((error as Error).message === "help") {
      console.log("Usage:");
      console.log(
        "  mcp-filter [options] -- <command> [args...]           # stdio transport"
      );
      console.log(
        "  mcp-filter [options] --upstream-url <url>             # HTTP transport"
      );
      console.log("");
      console.log("Options:");
      console.log("  --exclude <pattern>     Exclude items matching pattern");
      console.log("  --include <pattern>     Include items matching pattern");
      console.log(
        "  --upstream-url <url>    Connect to HTTP/SSE server (mutually exclusive with --)"
      );
      console.log(
        "  --transport <type>      Transport type: stdio, http, sse (auto-detected if omitted)"
      );
      console.log(
        "  --header <header>       Add HTTP header (format: 'Key: Value', HTTP/SSE only)"
      );
      console.log("  --help, -h              Show this help message");
      console.log("");
      console.log("Examples:");
      console.log("  # Stdio transport (local servers)");
      console.log(
        '  mcp-filter --exclude "test*" -- npx tsx test-server.ts'
      );
      console.log("");
      console.log("  # HTTP transport (remote servers)");
      console.log(
        '  mcp-filter --exclude "dangerous_*" --upstream-url https://mcp.notion.com/mcp'
      );
      console.log("");
      console.log("  # SSE transport (deprecated, legacy servers)");
      console.log(
        '  mcp-filter --transport sse --upstream-url https://mcp.asana.com/sse'
      );
      process.exit(0);
    }

    console.error(`Error: ${(error as Error).message}`);
    console.error("");
    console.error("Usage:");
    console.error(
      "  mcp-filter [options] -- <command> [args...]           # stdio transport"
    );
    console.error(
      "  mcp-filter [options] --upstream-url <url>             # HTTP transport"
    );
    console.error("");
    console.error("Options:");
    console.error("  --exclude <pattern>     Exclude items matching pattern");
    console.error("  --include <pattern>     Include items matching pattern");
    console.error(
      "  --upstream-url <url>    Connect to HTTP/SSE server (mutually exclusive with --)"
    );
    console.error(
      "  --transport <type>      Transport type: stdio, http, sse (auto-detected if omitted)"
    );
    console.error(
      "  --header <header>       Add HTTP header (format: 'Key: Value', HTTP/SSE only)"
    );
    console.error("");
    console.error("Examples:");
    console.error("  # Stdio transport (local servers)");
    console.error(
      '  mcp-filter --exclude "test*" -- npx tsx test-server.ts'
    );
    console.error("");
    console.error("  # HTTP transport (remote servers)");
    console.error(
      '  mcp-filter --exclude "dangerous_*" --upstream-url https://mcp.notion.com/mcp'
    );
    console.error("");
    console.error("  # SSE transport (deprecated, legacy servers)");
    console.error(
      '  mcp-filter --transport sse --upstream-url https://mcp.asana.com/sse'
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

  console.error(`Transport: ${config.transportConfig.type}`);

  // Create filter
  const filter = new Filter(config.patterns);

  // Create proxy server
  const proxy = new ProxyServer(
    {
      name: "mcp-filter",
      version: "0.5.0",
    },
    filter
  );

  // Connect client to upstream server
  // Transport factory handles creating the appropriate transport (stdio, http, sse)
  const clientTransport = createClientTransport(config.transportConfig);

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
