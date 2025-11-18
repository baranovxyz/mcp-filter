import { describe, it, expect } from "vitest";
import { Filter } from "../../src/filter.js";
import { FilterPattern } from "../../src/cli.js";

describe("Filter - rsync-style", () => {
  describe("exclude mode only", () => {
    it("should match exact name", () => {
      const filter = new Filter([{ type: "exclude", pattern: "exact_match" }]);

      expect(filter.shouldExclude("exact_match")).toBe(true);
      expect(filter.shouldExclude("not_exact")).toBe(false);
    });

    it("should exclude resolve-* pattern (context7 use case)", () => {
      const filter = new Filter([{ type: "exclude", pattern: "resolve-*" }]);

      expect(filter.shouldExclude("resolve-library-id")).toBe(true);
      expect(filter.shouldExclude("resolve-dependencies")).toBe(true);
      expect(filter.shouldExclude("resolve")).toBe(false); // exact match, no suffix
      expect(filter.shouldExclude("get-library-docs")).toBe(false);
      expect(filter.shouldExclude("search-packages")).toBe(false);
    });

    it("should match wildcard patterns", () => {
      const filter = new Filter([{ type: "exclude", pattern: "playwright*" }]);

      expect(filter.shouldExclude("playwright_navigate")).toBe(true);
      expect(filter.shouldExclude("playwright_click")).toBe(true);
      expect(filter.shouldExclude("playwright")).toBe(true);
      expect(filter.shouldExclude("other_tool")).toBe(false);
    });

    it("should match suffix patterns", () => {
      const filter = new Filter([{ type: "exclude", pattern: "*_admin" }]);

      expect(filter.shouldExclude("delete_admin")).toBe(true);
      expect(filter.shouldExclude("user_admin")).toBe(true);
      expect(filter.shouldExclude("admin_tool")).toBe(false);
    });

    it("should match middle patterns", () => {
      const filter = new Filter([{ type: "exclude", pattern: "test_*_debug" }]);

      expect(filter.shouldExclude("test_foo_debug")).toBe(true);
      expect(filter.shouldExclude("test_bar_baz_debug")).toBe(true);
      expect(filter.shouldExclude("test_debug")).toBe(false);
    });

    it("should match any pattern in list (first match wins)", () => {
      const filter = new Filter([
        { type: "exclude", pattern: "playwright*" },
        { type: "exclude", pattern: "debug_*" },
        { type: "exclude", pattern: "admin" },
      ]);

      expect(filter.shouldExclude("playwright_click")).toBe(true);
      expect(filter.shouldExclude("debug_log")).toBe(true);
      expect(filter.shouldExclude("admin")).toBe(true);
      expect(filter.shouldExclude("safe_tool")).toBe(false);
    });

    it("should handle empty pattern list", () => {
      const filter = new Filter([]);

      expect(filter.shouldExclude("any_tool")).toBe(false);
    });
  });

  describe("include mode only", () => {
    it("should allow only included tools", () => {
      const filter = new Filter([
        { type: "include", pattern: "browser_navigate" },
        { type: "include", pattern: "browser_screenshot" },
      ]);

      expect(filter.shouldExclude("browser_navigate")).toBe(false);
      expect(filter.shouldExclude("browser_screenshot")).toBe(false);
      expect(filter.shouldExclude("browser_close")).toBe(true); // not in whitelist
      expect(filter.shouldExclude("other_tool")).toBe(true); // not in whitelist
    });

    it("should work with wildcard patterns", () => {
      const filter = new Filter([{ type: "include", pattern: "browser_*" }]);

      expect(filter.shouldExclude("browser_navigate")).toBe(false);
      expect(filter.shouldExclude("browser_click")).toBe(false);
      expect(filter.shouldExclude("page_screenshot")).toBe(true); // not in whitelist
    });

    it("should allow multiple include patterns", () => {
      const filter = new Filter([
        { type: "include", pattern: "browser_*" },
        { type: "include", pattern: "page_*" },
      ]);

      expect(filter.shouldExclude("browser_navigate")).toBe(false);
      expect(filter.shouldExclude("page_screenshot")).toBe(false);
      expect(filter.shouldExclude("console_log")).toBe(true); // not in whitelist
    });
  });

  describe("rsync-style: order matters, first match wins", () => {
    it("include then exclude - exclude wins for matching item", () => {
      const filter = new Filter([
        { type: "include", pattern: "browser_*" },
        { type: "exclude", pattern: "browser_close" },
      ]);

      expect(filter.shouldExclude("browser_navigate")).toBe(false); // matches include
      expect(filter.shouldExclude("browser_close")).toBe(false); // matches include first!
      expect(filter.shouldExclude("other_tool")).toBe(true); // not in whitelist
    });

    it("exclude then include - exclude wins for matching item", () => {
      const filter = new Filter([
        { type: "exclude", pattern: "browser_close" },
        { type: "include", pattern: "browser_*" },
      ]);

      expect(filter.shouldExclude("browser_navigate")).toBe(false); // matches include
      expect(filter.shouldExclude("browser_close")).toBe(true); // matches exclude first!
      expect(filter.shouldExclude("other_tool")).toBe(true); // not in whitelist
    });

    it("complex layering: include, exclude, include more specific", () => {
      const filter = new Filter([
        { type: "include", pattern: "browser_*" },
        { type: "exclude", pattern: "browser_close*" },
        { type: "include", pattern: "browser_close_tab" },
      ]);

      expect(filter.shouldExclude("browser_navigate")).toBe(false); // matches first include
      expect(filter.shouldExclude("browser_close")).toBe(false); // matches first include (browser_*)
      expect(filter.shouldExclude("browser_close_tab")).toBe(false); // matches first include (browser_*)
      expect(filter.shouldExclude("browser_close_window")).toBe(false); // matches first include (browser_*)
    });

    it("complex layering: exclude specific, then include broad", () => {
      const filter = new Filter([
        { type: "exclude", pattern: "browser_close" },
        { type: "exclude", pattern: "browser_evaluate" },
        { type: "include", pattern: "browser_*" },
      ]);

      expect(filter.shouldExclude("browser_navigate")).toBe(false); // matches include
      expect(filter.shouldExclude("browser_close")).toBe(true); // matches exclude first
      expect(filter.shouldExclude("browser_evaluate")).toBe(true); // matches exclude first
      expect(filter.shouldExclude("other_tool")).toBe(true); // not in whitelist
    });

    it("multiple patterns with different precedence", () => {
      const filter = new Filter([
        { type: "exclude", pattern: "*_admin" },
        { type: "exclude", pattern: "*_debug" },
        { type: "include", pattern: "browser_*" },
        { type: "include", pattern: "safe_*" },
      ]);

      expect(filter.shouldExclude("browser_navigate")).toBe(false);
      expect(filter.shouldExclude("browser_admin")).toBe(true); // exclude wins
      expect(filter.shouldExclude("safe_tool")).toBe(false);
      expect(filter.shouldExclude("safe_debug")).toBe(true); // exclude wins
      expect(filter.shouldExclude("unsafe_tool")).toBe(true); // not in whitelist
    });
  });

  describe("filterList", () => {
    it("should filter items by name", () => {
      const filter = new Filter([{ type: "exclude", pattern: "test*" }]);
      const items = [
        { name: "test_one", value: 1 },
        { name: "keep_this", value: 2 },
        { name: "test_two", value: 3 },
        { name: "also_keep", value: 4 },
      ];

      const result = filter.filterList(items);

      expect(result).toEqual([
        { name: "keep_this", value: 2 },
        { name: "also_keep", value: 4 },
      ]);
    });

    it("should preserve all items when no patterns match", () => {
      const filter = new Filter([{ type: "exclude", pattern: "nonexistent" }]);
      const items = [
        { name: "tool1", desc: "a" },
        { name: "tool2", desc: "b" },
      ];

      const result = filter.filterList(items);

      expect(result).toEqual(items);
    });

    it("should filter all items when pattern matches all", () => {
      const filter = new Filter([{ type: "exclude", pattern: "*" }]);
      const items = [{ name: "tool1" }, { name: "tool2" }, { name: "tool3" }];

      const result = filter.filterList(items);

      expect(result).toEqual([]);
    });

    it("should handle empty item list", () => {
      const filter = new Filter([{ type: "exclude", pattern: "test*" }]);
      const result = filter.filterList([]);

      expect(result).toEqual([]);
    });

    it("should handle include mode with filterList", () => {
      const filter = new Filter([{ type: "include", pattern: "browser_*" }]);
      const items = [
        { name: "browser_navigate" },
        { name: "page_screenshot" },
        { name: "browser_click" },
      ];

      const result = filter.filterList(items);

      expect(result).toEqual([
        { name: "browser_navigate" },
        { name: "browser_click" },
      ]);
    });
  });
});
