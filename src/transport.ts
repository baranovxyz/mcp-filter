import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { TransportConfig } from "./types.js";

/**
 * Creates a client transport based on the provided configuration.
 *
 * @param config - The transport configuration (stdio, http, or sse)
 * @returns A configured Transport instance
 * @throws Error if the configuration is invalid or transport creation fails
 */
export function createClientTransport(config: TransportConfig): Transport {
  switch (config.type) {
    case "stdio": {
      if (config.command.length === 0) {
        throw new Error("Stdio transport requires a command");
      }

      return new StdioClientTransport({
        command: config.command[0],
        args: config.command.slice(1),
        env: config.env || (process.env as Record<string, string>),
        stderr: "inherit",
      });
    }

    case "http": {
      let url: URL;
      try {
        url = new URL(config.url);
      } catch (e) {
        throw new Error(`Invalid HTTP URL: ${config.url}`);
      }

      // Add custom headers to requestInit if provided
      const requestInit: RequestInit | undefined =
        config.headers && Object.keys(config.headers).length > 0
          ? { headers: config.headers }
          : undefined;

      return new StreamableHTTPClientTransport(url, { requestInit });
    }

    case "sse": {
      console.warn(
        "⚠️  WARNING: SSE transport is deprecated as of protocol version 2024-11-05. " +
          "Consider using HTTP transport instead for better performance and compatibility."
      );

      let url: URL;
      try {
        url = new URL(config.url);
      } catch (e) {
        throw new Error(`Invalid SSE URL: ${config.url}`);
      }

      return new SSEClientTransport(url);
    }

    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = config;
      throw new Error(`Unknown transport type: ${(_exhaustive as any).type}`);
    }
  }
}
