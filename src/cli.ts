import {
  FilterPattern,
  FilterConfig,
  TransportConfig,
  TransportType,
} from "./types.js";

export function parseArgs(args: string[]): FilterConfig {
  const patterns: FilterPattern[] = [];
  const upstreamCommand: string[] = [];
  let upstreamUrl: string | undefined;
  let explicitTransport: TransportType | undefined;
  const headers: Record<string, string> = {};

  let inUpstreamCommand = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (inUpstreamCommand) {
      upstreamCommand.push(arg);
      continue;
    }

    if (arg === "--") {
      inUpstreamCommand = true;
      continue;
    }

    if (arg === "--exclude") {
      const pattern = args[++i];
      if (!pattern) {
        throw new Error("--exclude requires a pattern argument");
      }
      patterns.push({ type: "exclude", pattern });
      continue;
    }

    if (arg === "--include") {
      const pattern = args[++i];
      if (!pattern) {
        throw new Error("--include requires a pattern argument");
      }
      patterns.push({ type: "include", pattern });
      continue;
    }

    if (arg === "--upstream-url") {
      const url = args[++i];
      if (!url) {
        throw new Error("--upstream-url requires a URL argument");
      }
      upstreamUrl = url;
      continue;
    }

    if (arg === "--transport") {
      const transport = args[++i];
      if (!transport) {
        throw new Error("--transport requires a transport type argument");
      }
      if (transport !== "stdio" && transport !== "http" && transport !== "sse") {
        throw new Error(
          `Invalid transport type: ${transport}. Must be one of: stdio, http, sse`
        );
      }
      explicitTransport = transport;
      continue;
    }

    if (arg === "--header") {
      const header = args[++i];
      if (!header) {
        throw new Error("--header requires a header value");
      }
      const colonIndex = header.indexOf(":");
      if (colonIndex === -1) {
        throw new Error(
          `Invalid header format: ${header}. Expected format: "Key: Value"`
        );
      }
      const key = header.slice(0, colonIndex).trim();
      const value = header.slice(colonIndex + 1).trim();
      headers[key] = value;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      throw new Error("help");
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  // Validate: cannot specify both URL and command
  if (upstreamUrl && upstreamCommand.length > 0) {
    throw new Error(
      "Cannot specify both --upstream-url and command after --. Use one or the other."
    );
  }

  // Build transport config
  let transportConfig: TransportConfig;

  if (upstreamUrl) {
    // URL-based transport (http or sse)
    let transportType: "http" | "sse";

    if (explicitTransport) {
      if (explicitTransport === "stdio") {
        throw new Error(
          "--transport stdio cannot be used with --upstream-url. Use command after -- instead."
        );
      }
      transportType = explicitTransport;
    } else {
      // Auto-detect: default to http
      transportType = "http";
    }

    // Validate URL format
    try {
      new URL(upstreamUrl);
    } catch (e) {
      throw new Error(`Invalid URL: ${upstreamUrl}`);
    }

    if (transportType === "http") {
      transportConfig = {
        type: "http",
        url: upstreamUrl,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      };
    } else {
      transportConfig = {
        type: "sse",
        url: upstreamUrl,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      };
    }
  } else if (upstreamCommand.length > 0) {
    // Command-based transport (stdio)
    if (explicitTransport && explicitTransport !== "stdio") {
      throw new Error(
        `--transport ${explicitTransport} requires --upstream-url. Use --transport stdio or omit --transport for command-based servers.`
      );
    }

    if (Object.keys(headers).length > 0) {
      throw new Error("--header can only be used with --upstream-url");
    }

    transportConfig = {
      type: "stdio",
      command: upstreamCommand,
      env: process.env as Record<string, string>,
    };
  } else {
    throw new Error(
      "No upstream server specified. Use either:\n" +
        "  --upstream-url <url> for HTTP/SSE servers\n" +
        "  -- <command> for stdio servers"
    );
  }

  return {
    patterns,
    transportConfig,
  };
}
