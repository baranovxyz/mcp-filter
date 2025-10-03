import { describe, it, expect } from "vitest";
import { Filter } from "../../src/filter.js";

describe("Filter", () => {
  describe("shouldExclude - exclude mode only", () => {
    it("should match exact name", () => {
      const filter = new Filter(["exact_match"]);

      expect(filter.shouldExclude("exact_match")).toBe(true);
      expect(filter.shouldExclude("not_exact")).toBe(false);
    });

    it("should match wildcard patterns", () => {
      const filter = new Filter(["playwright*"]);

      expect(filter.shouldExclude("playwright_navigate")).toBe(true);
      expect(filter.shouldExclude("playwright_click")).toBe(true);
      expect(filter.shouldExclude("playwright")).toBe(true);
      expect(filter.shouldExclude("other_tool")).toBe(false);
    });

    it("should match suffix patterns", () => {
      const filter = new Filter(["*_admin"]);

      expect(filter.shouldExclude("delete_admin")).toBe(true);
      expect(filter.shouldExclude("user_admin")).toBe(true);
      expect(filter.shouldExclude("admin_tool")).toBe(false);
    });

    it("should match middle patterns", () => {
      const filter = new Filter(["test_*_debug"]);

      expect(filter.shouldExclude("test_foo_debug")).toBe(true);
      expect(filter.shouldExclude("test_bar_baz_debug")).toBe(true);
      expect(filter.shouldExclude("test_debug")).toBe(false);
    });

    it("should match any pattern in list", () => {
      const filter = new Filter(["playwright*", "debug_*", "admin"]);

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

  describe("shouldExclude - include mode only", () => {
    it("should allow only included tools", () => {
      const filter = new Filter([], ["browser_navigate", "browser_screenshot"]);

      expect(filter.shouldExclude("browser_navigate")).toBe(false);
      expect(filter.shouldExclude("browser_screenshot")).toBe(false);
      expect(filter.shouldExclude("browser_close")).toBe(true);
      expect(filter.shouldExclude("other_tool")).toBe(true);
    });

    it("should work with wildcard patterns", () => {
      const filter = new Filter([], ["browser_*"]);

      expect(filter.shouldExclude("browser_navigate")).toBe(false);
      expect(filter.shouldExclude("browser_click")).toBe(false);
      expect(filter.shouldExclude("page_screenshot")).toBe(true);
    });

    it("should allow multiple include patterns", () => {
      const filter = new Filter([], ["browser_*", "page_*"]);

      expect(filter.shouldExclude("browser_navigate")).toBe(false);
      expect(filter.shouldExclude("page_screenshot")).toBe(false);
      expect(filter.shouldExclude("console_log")).toBe(true);
    });
  });

  describe("shouldExclude - combination mode", () => {
    it("should exclude excluded tools even if included", () => {
      const filter = new Filter(["browser_close"], ["browser_*"]);

      expect(filter.shouldExclude("browser_navigate")).toBe(false);
      expect(filter.shouldExclude("browser_screenshot")).toBe(false);
      expect(filter.shouldExclude("browser_close")).toBe(true); // exclude wins
      expect(filter.shouldExclude("other_tool")).toBe(true); // not included
    });

    it("should handle multiple patterns in both lists", () => {
      const filter = new Filter(
        ["browser_close", "browser_evaluate"],
        ["browser_*", "page_*"]
      );

      expect(filter.shouldExclude("browser_navigate")).toBe(false); // included
      expect(filter.shouldExclude("browser_close")).toBe(true); // excluded
      expect(filter.shouldExclude("browser_evaluate")).toBe(true); // excluded
      expect(filter.shouldExclude("page_screenshot")).toBe(false); // included
      expect(filter.shouldExclude("console_log")).toBe(true); // not included
    });

    it("should handle complex patterns", () => {
      const filter = new Filter(
        ["*_admin", "*_debug"],
        ["browser_*", "safe_*"]
      );

      expect(filter.shouldExclude("browser_navigate")).toBe(false);
      expect(filter.shouldExclude("browser_admin")).toBe(true); // exclude wins
      expect(filter.shouldExclude("safe_tool")).toBe(false);
      expect(filter.shouldExclude("safe_debug")).toBe(true); // exclude wins
      expect(filter.shouldExclude("unsafe_tool")).toBe(true); // not included
    });
  });

  describe("filterList", () => {
    it("should filter items by name", () => {
      const filter = new Filter(["test*"]);
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
      const filter = new Filter(["nonexistent"]);
      const items = [
        { name: "tool1", desc: "a" },
        { name: "tool2", desc: "b" },
      ];

      const result = filter.filterList(items);

      expect(result).toEqual(items);
    });

    it("should filter all items when pattern matches all", () => {
      const filter = new Filter(["*"]);
      const items = [{ name: "tool1" }, { name: "tool2" }, { name: "tool3" }];

      const result = filter.filterList(items);

      expect(result).toEqual([]);
    });

    it("should handle empty item list", () => {
      const filter = new Filter(["test*"]);
      const result = filter.filterList([]);

      expect(result).toEqual([]);
    });
  });
});
