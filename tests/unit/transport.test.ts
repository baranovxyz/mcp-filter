import { describe, it, expect, vi, afterEach } from "vitest";
import { createClientTransport } from "../../src/transport.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { StdioConfig, HttpConfig, SseConfig } from "../../src/types.js";

describe("createClientTransport", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("stdio transport", () => {
    it("should create a StdioClientTransport for stdio config", () => {
      const config: StdioConfig = {
        type: "stdio",
        command: ["node", "server.js"],
      };

      const transport = createClientTransport(config);
      expect(transport).toBeInstanceOf(StdioClientTransport);
    });

    it("should throw error for empty command", () => {
      const config: StdioConfig = {
        type: "stdio",
        command: [],
      };

      expect(() => createClientTransport(config)).toThrow(
        "Stdio transport requires a command"
      );
    });

    it("should use provided env when specified", () => {
      const customEnv = { PATH: "/custom/path", MY_VAR: "value" };
      const config: StdioConfig = {
        type: "stdio",
        command: ["node", "server.js"],
        env: customEnv,
      };

      // Should not throw — env is passed through
      const transport = createClientTransport(config);
      expect(transport).toBeInstanceOf(StdioClientTransport);
    });

    it("should default to process.env when no env specified", () => {
      const config: StdioConfig = {
        type: "stdio",
        command: ["node", "server.js"],
      };

      // Should not throw — defaults to process.env
      const transport = createClientTransport(config);
      expect(transport).toBeInstanceOf(StdioClientTransport);
    });
  });

  describe("http transport", () => {
    it("should create a StreamableHTTPClientTransport for http config", () => {
      const config: HttpConfig = {
        type: "http",
        url: "https://mcp.example.com/mcp",
      };

      const transport = createClientTransport(config);
      expect(transport).toBeInstanceOf(StreamableHTTPClientTransport);
    });

    it("should accept http config with headers", () => {
      const config: HttpConfig = {
        type: "http",
        url: "https://api.example.com/mcp",
        headers: {
          Authorization: "Bearer token123",
          "X-Custom": "value",
        },
      };

      const transport = createClientTransport(config);
      expect(transport).toBeInstanceOf(StreamableHTTPClientTransport);
    });

    it("should accept http config with empty headers", () => {
      const config: HttpConfig = {
        type: "http",
        url: "https://mcp.example.com/mcp",
        headers: {},
      };

      const transport = createClientTransport(config);
      expect(transport).toBeInstanceOf(StreamableHTTPClientTransport);
    });

    it("should throw error for invalid HTTP URL", () => {
      const config: HttpConfig = {
        type: "http",
        url: "not-a-url",
      };

      expect(() => createClientTransport(config)).toThrow("Invalid HTTP URL");
    });
  });

  describe("sse transport", () => {
    it("should create an SSEClientTransport for sse config", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const config: SseConfig = {
        type: "sse",
        url: "https://mcp.example.com/sse",
      };

      const transport = createClientTransport(config);
      expect(transport).toBeInstanceOf(SSEClientTransport);
      warnSpy.mockRestore();
    });

    it("should emit deprecation warning for SSE transport", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const config: SseConfig = {
        type: "sse",
        url: "https://mcp.example.com/sse",
      };

      createClientTransport(config);

      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy.mock.calls[0][0]).toContain("SSE transport is deprecated");
      warnSpy.mockRestore();
    });

    it("should throw error for invalid SSE URL", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const config: SseConfig = {
        type: "sse",
        url: "not-a-url",
      };

      expect(() => createClientTransport(config)).toThrow("Invalid SSE URL");
      warnSpy.mockRestore();
    });
  });

  describe("exhaustiveness check", () => {
    it("should throw error for unknown transport type", () => {
      const config = {
        type: "websocket",
        url: "ws://example.com",
      } as any;

      expect(() => createClientTransport(config)).toThrow(
        "Unknown transport type"
      );
    });
  });
});
