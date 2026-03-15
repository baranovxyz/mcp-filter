#!/usr/bin/env node

import { createRequire } from "node:module";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { parseArgs } from "./cli.js";
import { Filter } from "./filter.js";
import { logger } from "./logger.js";
import { ProxyServer } from "./proxy.js";
import { createClientTransport } from "./transport.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json");

function printUsage() {
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
  console.error("  --help                  Show this help message");
  console.error("  --version               Show version number");
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
}

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);

  // Handle --help and --version before parsing
  if (args.includes("--help") || args.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  if (args.includes("--version") || args.includes("-v")) {
    console.log(version);
    process.exit(0);
  }

  let config;
  try {
    config = parseArgs(args);
  } catch (error) {
    logger.error((error as Error).message);
    console.error("");
    printUsage();
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
      version,
    },
    filter
  );

  // Connect to upstream server, read its capabilities, and create the
  // downstream server with mirrored capabilities and forwarding handlers.
  const clientTransport = createClientTransport(config.transportConfig);

  // Handle cleanup (defined early so onerror/onclose can reference it)
  let isShuttingDown = false;
  const cleanup = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info("Shutting down...");
    try {
      await proxy.getServer().close();
      await proxy.getClient().close();
    } catch {
      // Best-effort cleanup — don't block exit on errors
    }
    process.exit(0);
  };

  const CONNECTION_TIMEOUT_MS = 30_000;
  let connectionTimeoutId: ReturnType<typeof setTimeout>;
  await Promise.race([
    proxy.connectToUpstream(clientTransport),
    new Promise<never>((_, reject) => {
      connectionTimeoutId = setTimeout(
        () => reject(new Error("Timed out connecting to upstream server")),
        CONNECTION_TIMEOUT_MS
      );
    }),
  ]);
  clearTimeout(connectionTimeoutId!);
  logger.success("Connected to upstream server");

  // Connect server to current process stdio (for the MCP client calling us)
  const serverTransport = new StdioServerTransport();
  await proxy.getServer().connect(serverTransport);
  logger.success("MCP filter proxy ready");

  // Propagate upstream transport errors/close to downstream
  proxy.getClient().onerror = (error) => {
    logger.error("Upstream transport error:", error.message);
  };
  proxy.getClient().onclose = () => {
    logger.info("Upstream connection closed, shutting down...");
    cleanup();
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

main().catch((error) => {
  logger.fatal(error);
  process.exit(1);
});
