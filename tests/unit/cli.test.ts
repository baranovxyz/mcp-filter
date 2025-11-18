import { describe, it, expect } from "vitest";
import { parseArgs } from "../../src/cli.js";
import type { StdioConfig, HttpConfig, SseConfig } from "../../src/types.js";

describe("CLI Parser", () => {
  describe("parseArgs - stdio transport (command after --)", () => {
    it("should parse single exclude pattern", () => {
      const result = parseArgs([
        "--exclude",
        "test*",
        "--",
        "node",
        "server.js",
      ]);

      expect(result.patterns).toEqual([{ type: "exclude", pattern: "test*" }]);
      expect(result.transportConfig.type).toBe("stdio");
      expect((result.transportConfig as StdioConfig).command).toEqual([
        "node",
        "server.js",
      ]);
    });

    it("should parse multiple exclude patterns", () => {
      const result = parseArgs([
        "--exclude",
        "playwright*",
        "--exclude",
        "debug_*",
        "--",
        "npx",
        "my-server",
      ]);

      expect(result.patterns).toEqual([
        { type: "exclude", pattern: "playwright*" },
        { type: "exclude", pattern: "debug_*" },
      ]);
      expect(result.transportConfig.type).toBe("stdio");
      expect((result.transportConfig as StdioConfig).command).toEqual([
        "npx",
        "my-server",
      ]);
    });

    it("should parse upstream command with arguments", () => {
      const result = parseArgs([
        "--exclude",
        "test",
        "--",
        "node",
        "server.js",
        "--port",
        "3000",
      ]);

      expect((result.transportConfig as StdioConfig).command).toEqual([
        "node",
        "server.js",
        "--port",
        "3000",
      ]);
    });

    it("should throw error if exclude has no pattern", () => {
      expect(() => parseArgs(["--exclude"])).toThrow(
        "--exclude requires a pattern argument"
      );
    });
  });

  describe("parseArgs - include patterns", () => {
    it("should parse single include pattern", () => {
      const result = parseArgs([
        "--include",
        "browser_*",
        "--",
        "node",
        "server.js",
      ]);

      expect(result.patterns).toEqual([
        { type: "include", pattern: "browser_*" },
      ]);
      expect(result.transportConfig.type).toBe("stdio");
      expect((result.transportConfig as StdioConfig).command).toEqual([
        "node",
        "server.js",
      ]);
    });

    it("should parse multiple include patterns", () => {
      const result = parseArgs([
        "--include",
        "browser_navigate",
        "--include",
        "browser_screenshot",
        "--",
        "npx",
        "my-server",
      ]);

      expect(result.patterns).toEqual([
        { type: "include", pattern: "browser_navigate" },
        { type: "include", pattern: "browser_screenshot" },
      ]);
      expect(result.transportConfig.type).toBe("stdio");
      expect((result.transportConfig as StdioConfig).command).toEqual([
        "npx",
        "my-server",
      ]);
    });

    it("should throw error if include has no pattern", () => {
      expect(() => parseArgs(["--include"])).toThrow(
        "--include requires a pattern argument"
      );
    });
  });

  describe("parseArgs - combination (rsync-style: order matters)", () => {
    it("should preserve pattern order: include then exclude", () => {
      const result = parseArgs([
        "--include",
        "browser_*",
        "--exclude",
        "browser_close",
        "--exclude",
        "browser_evaluate",
        "--",
        "node",
        "server.js",
      ]);

      expect(result.patterns).toEqual([
        { type: "include", pattern: "browser_*" },
        { type: "exclude", pattern: "browser_close" },
        { type: "exclude", pattern: "browser_evaluate" },
      ]);
      expect(result.transportConfig.type).toBe("stdio");
      expect((result.transportConfig as StdioConfig).command).toEqual([
        "node",
        "server.js",
      ]);
    });

    it("should preserve pattern order: exclude then include", () => {
      const result = parseArgs([
        "--exclude",
        "browser_close",
        "--include",
        "browser_*",
        "--",
        "node",
        "server.js",
      ]);

      expect(result.patterns).toEqual([
        { type: "exclude", pattern: "browser_close" },
        { type: "include", pattern: "browser_*" },
      ]);
      expect(result.transportConfig.type).toBe("stdio");
      expect((result.transportConfig as StdioConfig).command).toEqual([
        "node",
        "server.js",
      ]);
    });

    it("should handle patterns in any order (preserving exact order)", () => {
      const result = parseArgs([
        "--exclude",
        "test1",
        "--include",
        "allow1",
        "--exclude",
        "test2",
        "--include",
        "allow2",
        "--",
        "cmd",
      ]);

      expect(result.patterns).toEqual([
        { type: "exclude", pattern: "test1" },
        { type: "include", pattern: "allow1" },
        { type: "exclude", pattern: "test2" },
        { type: "include", pattern: "allow2" },
      ]);
    });

    it("should handle complex rsync-style pattern ordering", () => {
      const result = parseArgs([
        "--include",
        "browser_*",
        "--exclude",
        "browser_close*",
        "--include",
        "browser_close_tab",
        "--",
        "cmd",
      ]);

      expect(result.patterns).toEqual([
        { type: "include", pattern: "browser_*" },
        { type: "exclude", pattern: "browser_close*" },
        { type: "include", pattern: "browser_close_tab" },
      ]);
    });
  });

  describe("parseArgs - general cases", () => {
    it("should handle no filter patterns", () => {
      const result = parseArgs(["--", "node", "server.js"]);

      expect(result.patterns).toEqual([]);
      expect(result.transportConfig.type).toBe("stdio");
      expect((result.transportConfig as StdioConfig).command).toEqual([
        "node",
        "server.js",
      ]);
    });

    it("should throw error if no upstream server specified", () => {
      expect(() => parseArgs(["--exclude", "test"])).toThrow(
        "No upstream server specified"
      );
    });

    it("should throw error on unknown argument", () => {
      expect(() => parseArgs(["--unknown", "--", "node", "server.js"])).toThrow(
        "Unknown argument: --unknown"
      );
    });

    it("should handle empty command after --", () => {
      expect(() => parseArgs(["--"])).toThrow("No upstream server specified");
    });
  });

  describe("parseArgs - HTTP transport", () => {
    it("should parse HTTP URL", () => {
      const result = parseArgs([
        "--exclude",
        "test*",
        "--upstream-url",
        "https://mcp.example.com/mcp",
      ]);

      expect(result.patterns).toEqual([{ type: "exclude", pattern: "test*" }]);
      expect(result.transportConfig.type).toBe("http");
      expect((result.transportConfig as HttpConfig).url).toBe(
        "https://mcp.example.com/mcp"
      );
    });

    it("should parse HTTP URL with headers", () => {
      const result = parseArgs([
        "--upstream-url",
        "https://api.example.com/mcp",
        "--header",
        "Authorization: Bearer token123",
        "--header",
        "X-Custom-Header: value",
      ]);

      expect(result.transportConfig.type).toBe("http");
      expect((result.transportConfig as HttpConfig).headers).toEqual({
        Authorization: "Bearer token123",
        "X-Custom-Header": "value",
      });
    });

    it("should throw error for invalid URL", () => {
      expect(() => parseArgs(["--upstream-url", "not-a-url"])).toThrow(
        "Invalid URL"
      );
    });

    it("should throw error if --header used without --upstream-url", () => {
      expect(() =>
        parseArgs(["--header", "Auth: token", "--", "node", "server.js"])
      ).toThrow("--header can only be used with --upstream-url");
    });

    it("should throw error if both --upstream-url and command specified", () => {
      expect(() =>
        parseArgs([
          "--upstream-url",
          "https://example.com",
          "--",
          "node",
          "server.js",
        ])
      ).toThrow("Cannot specify both --upstream-url and command after --");
    });
  });

  describe("parseArgs - SSE transport", () => {
    it("should parse SSE URL with explicit transport flag", () => {
      const result = parseArgs([
        "--transport",
        "sse",
        "--upstream-url",
        "https://mcp.example.com/sse",
      ]);

      expect(result.transportConfig.type).toBe("sse");
      expect((result.transportConfig as SseConfig).url).toBe(
        "https://mcp.example.com/sse"
      );
    });

    it("should parse SSE URL with headers", () => {
      const result = parseArgs([
        "--transport",
        "sse",
        "--upstream-url",
        "https://api.example.com/sse",
        "--header",
        "X-API-Key: secret",
      ]);

      expect(result.transportConfig.type).toBe("sse");
      expect((result.transportConfig as SseConfig).headers).toEqual({
        "X-API-Key": "secret",
      });
    });
  });

  describe("parseArgs - transport flag validation", () => {
    it("should throw error for invalid transport type", () => {
      expect(() =>
        parseArgs(["--transport", "websocket", "--upstream-url", "ws://example.com"])
      ).toThrow("Invalid transport type");
    });

    it("should throw error if --transport stdio used with --upstream-url", () => {
      expect(() =>
        parseArgs([
          "--transport",
          "stdio",
          "--upstream-url",
          "https://example.com",
        ])
      ).toThrow("--transport stdio cannot be used with --upstream-url");
    });

    it("should throw error if --transport http used without --upstream-url", () => {
      expect(() =>
        parseArgs(["--transport", "http", "--", "node", "server.js"])
      ).toThrow("--transport http requires --upstream-url");
    });
  });
});
