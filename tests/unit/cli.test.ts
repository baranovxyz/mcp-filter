import { describe, it, expect } from "vitest";
import { parseArgs } from "../../src/cli.js";

describe("CLI Parser", () => {
  describe("parseArgs - exclude patterns", () => {
    it("should parse single exclude pattern", () => {
      const result = parseArgs([
        "--exclude",
        "test*",
        "--",
        "node",
        "server.js",
      ]);

      expect(result.excludePatterns).toEqual(["test*"]);
      expect(result.includePatterns).toEqual([]);
      expect(result.upstreamCommand).toEqual(["node", "server.js"]);
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

      expect(result.excludePatterns).toEqual(["playwright*", "debug_*"]);
      expect(result.includePatterns).toEqual([]);
      expect(result.upstreamCommand).toEqual(["npx", "my-server"]);
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

      expect(result.upstreamCommand).toEqual([
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

      expect(result.excludePatterns).toEqual([]);
      expect(result.includePatterns).toEqual(["browser_*"]);
      expect(result.upstreamCommand).toEqual(["node", "server.js"]);
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

      expect(result.excludePatterns).toEqual([]);
      expect(result.includePatterns).toEqual([
        "browser_navigate",
        "browser_screenshot",
      ]);
      expect(result.upstreamCommand).toEqual(["npx", "my-server"]);
    });

    it("should throw error if include has no pattern", () => {
      expect(() => parseArgs(["--include"])).toThrow(
        "--include requires a pattern argument"
      );
    });
  });

  describe("parseArgs - combination", () => {
    it("should parse both exclude and include patterns", () => {
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

      expect(result.excludePatterns).toEqual([
        "browser_close",
        "browser_evaluate",
      ]);
      expect(result.includePatterns).toEqual(["browser_*"]);
      expect(result.upstreamCommand).toEqual(["node", "server.js"]);
    });

    it("should handle patterns in any order", () => {
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

      expect(result.excludePatterns).toEqual(["test1", "test2"]);
      expect(result.includePatterns).toEqual(["allow1", "allow2"]);
    });
  });

  describe("parseArgs - general cases", () => {
    it("should handle no filter patterns", () => {
      const result = parseArgs(["--", "node", "server.js"]);

      expect(result.excludePatterns).toEqual([]);
      expect(result.includePatterns).toEqual([]);
      expect(result.upstreamCommand).toEqual(["node", "server.js"]);
    });

    it("should throw error if no upstream command", () => {
      expect(() => parseArgs(["--exclude", "test"])).toThrow(
        "No upstream command specified"
      );
    });

    it("should throw error on unknown argument", () => {
      expect(() => parseArgs(["--unknown", "--", "node", "server.js"])).toThrow(
        "Unknown argument: --unknown"
      );
    });

    it("should handle empty upstream command after --", () => {
      expect(() => parseArgs(["--"])).toThrow("No upstream command specified");
    });
  });
});
