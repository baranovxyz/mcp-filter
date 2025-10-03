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

      expect(result.patterns).toEqual([{ type: "exclude", pattern: "test*" }]);
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

      expect(result.patterns).toEqual([
        { type: "exclude", pattern: "playwright*" },
        { type: "exclude", pattern: "debug_*" },
      ]);
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

      expect(result.patterns).toEqual([
        { type: "include", pattern: "browser_*" },
      ]);
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

      expect(result.patterns).toEqual([
        { type: "include", pattern: "browser_navigate" },
        { type: "include", pattern: "browser_screenshot" },
      ]);
      expect(result.upstreamCommand).toEqual(["npx", "my-server"]);
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
      expect(result.upstreamCommand).toEqual(["node", "server.js"]);
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
      expect(result.upstreamCommand).toEqual(["node", "server.js"]);
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
