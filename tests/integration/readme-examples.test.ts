import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Integration tests validating ALL examples from README.md
 * These tests ensure documentation is accurate and examples work correctly
 */
describe.sequential("README Examples Validation", () => {
  const fixtureServer = path.resolve(
    __dirname,
    "../fixtures/browser-server.ts"
  );
  const filterBin = path.resolve(__dirname, "../../dist/index.js");

  let client: Client;

  const createClient = async (args: string[]) => {
    client = new Client(
      { name: "test-client", version: "1.0.0" },
      { capabilities: {} }
    );

    const transport = new StdioClientTransport({
      command: "node",
      args: [filterBin, ...args, "--", "npx", "tsx", fixtureServer],
    });

    await client.connect(transport);
  };

  afterEach(async () => {
    if (client) {
      await client.close();
    }
  });

  describe("Basic Usage Examples (from Usage section)", () => {
    it("Exclude mode: filter out specific tools", async () => {
      await createClient(["--exclude", "browser_close"]);

      const result = await client.listTools();
      const toolNames = result.tools.map((t) => t.name);

      expect(toolNames).toContain("browser_navigate");
      expect(toolNames).toContain("browser_screenshot");
      expect(toolNames).not.toContain("browser_close");
    });

    it("Include mode: only allow specific tools", async () => {
      await createClient([
        "--include",
        "browser_navigate",
        "--include",
        "browser_screenshot",
      ]);

      const result = await client.listTools();
      const toolNames = result.tools.map((t) => t.name);

      expect(toolNames).toContain("browser_navigate");
      expect(toolNames).toContain("browser_screenshot");
      expect(toolNames).not.toContain("browser_close");
      expect(toolNames).not.toContain("browser_evaluate");
    });

    it("Combination: include with exceptions (CORRECT order)", async () => {
      await createClient([
        "--exclude",
        "browser_close",
        "--include",
        "browser_*",
      ]);

      const result = await client.listTools();
      const toolNames = result.tools.map((t) => t.name);

      expect(toolNames).toContain("browser_navigate");
      expect(toolNames).toContain("browser_screenshot");
      expect(toolNames).not.toContain("browser_close"); // excluded
      expect(toolNames).not.toContain("other_tool"); // not in include pattern
    });
  });

  describe("Filtering Modes", () => {
    it("Exclude Mode: blocks specific items, allows everything else", async () => {
      await createClient([
        "--exclude",
        "browser_close",
        "--exclude",
        "browser_evaluate",
      ]);

      const result = await client.listTools();
      const toolNames = result.tools.map((t) => t.name);

      // Allowed
      expect(toolNames).toContain("browser_navigate");
      expect(toolNames).toContain("browser_screenshot");
      expect(toolNames).toContain("browser_snapshot");
      expect(toolNames).toContain("other_tool");

      // Blocked
      expect(toolNames).not.toContain("browser_close");
      expect(toolNames).not.toContain("browser_evaluate");
    });

    it("Include Mode: allows ONLY specified items", async () => {
      await createClient([
        "--include",
        "browser_navigate",
        "--include",
        "browser_screenshot",
      ]);

      const result = await client.listTools();
      const toolNames = result.tools.map((t) => t.name);

      // Only these two allowed
      expect(toolNames).toHaveLength(2);
      expect(toolNames).toContain("browser_navigate");
      expect(toolNames).toContain("browser_screenshot");

      // Everything else blocked
      expect(toolNames).not.toContain("browser_close");
      expect(toolNames).not.toContain("browser_snapshot");
      expect(toolNames).not.toContain("other_tool");
    });
  });

  describe("Combination Mode - Rsync-Style Ordering", () => {
    it("Example 1: Include first, then exclude (DOES NOT WORK - documents wrong pattern)", async () => {
      await createClient([
        "--include",
        "browser_*",
        "--exclude",
        "browser_close",
      ]);

      const result = await client.listTools();
      const toolNames = result.tools.map((t) => t.name);

      // browser_close IS INCLUDED because browser_* matches first
      expect(toolNames).toContain("browser_close");
      expect(toolNames).toContain("browser_navigate");
      expect(toolNames).toContain("browser_screenshot");

      // other_tool is excluded (whitelist mode, doesn't match any include)
      expect(toolNames).not.toContain("other_tool");
    });

    it("Example 2: Exclude first, then include (CORRECT pattern)", async () => {
      await createClient([
        "--exclude",
        "browser_close",
        "--include",
        "browser_*",
      ]);

      const result = await client.listTools();
      const toolNames = result.tools.map((t) => t.name);

      // browser_close IS EXCLUDED (matched exclude first)
      expect(toolNames).not.toContain("browser_close");

      // Other browser_* tools are included
      expect(toolNames).toContain("browser_navigate");
      expect(toolNames).toContain("browser_screenshot");
      expect(toolNames).toContain("browser_evaluate");

      // other_tool is excluded (whitelist mode)
      expect(toolNames).not.toContain("other_tool");
    });

    it("Example 3: Multiple exclusions, then broad include (recommended pattern)", async () => {
      await createClient([
        "--exclude",
        "browser_close",
        "--exclude",
        "browser_evaluate",
        "--include",
        "browser_*",
      ]);

      const result = await client.listTools();
      const toolNames = result.tools.map((t) => t.name);

      // Excluded (matched first)
      expect(toolNames).not.toContain("browser_close");
      expect(toolNames).not.toContain("browser_evaluate");

      // Included
      expect(toolNames).toContain("browser_navigate");
      expect(toolNames).toContain("browser_screenshot");
      expect(toolNames).toContain("browser_snapshot");

      // Not matching any pattern in whitelist mode
      expect(toolNames).not.toContain("other_tool");
    });
  });

  describe("Claude Code Practical Examples", () => {
    it("Monitoring agent (read-only)", async () => {
      await createClient([
        "--include",
        "browser_navigate",
        "--include",
        "browser_snapshot",
        "--include",
        "browser_console_messages",
        "--include",
        "browser_network_requests",
        "--include",
        "browser_take_screenshot",
      ]);

      const result = await client.listTools();
      const toolNames = result.tools.map((t) => t.name);

      // Allowed read-only tools
      expect(toolNames).toContain("browser_navigate");
      expect(toolNames).toContain("browser_snapshot");
      expect(toolNames).toContain("browser_console_messages");
      expect(toolNames).toContain("browser_network_requests");
      expect(toolNames).toContain("browser_take_screenshot");

      // Blocked write/dangerous operations
      expect(toolNames).not.toContain("browser_close");
      expect(toolNames).not.toContain("browser_click");
      expect(toolNames).not.toContain("browser_type");
      expect(toolNames).not.toContain("browser_evaluate");
    });

    it("Testing agent (no destructive actions)", async () => {
      await createClient([
        "--exclude",
        "browser_close",
        "--exclude",
        "browser_tabs",
        "--exclude",
        "browser_evaluate",
        "--include",
        "browser_*",
      ]);

      const result = await client.listTools();
      const toolNames = result.tools.map((t) => t.name);

      // Excluded (matched first)
      expect(toolNames).not.toContain("browser_close");
      expect(toolNames).not.toContain("browser_tabs");
      expect(toolNames).not.toContain("browser_evaluate");

      // Included (other browser_ tools)
      expect(toolNames).toContain("browser_navigate");
      expect(toolNames).toContain("browser_screenshot");
      expect(toolNames).toContain("browser_snapshot");
      expect(toolNames).toContain("browser_click");
      expect(toolNames).toContain("browser_type");
    });

    it("Production debugging (safe operations only)", async () => {
      await createClient([
        "--exclude",
        "browser_click",
        "--exclude",
        "browser_type",
        "--exclude",
        "browser_evaluate",
        "--exclude",
        "browser_fill_form",
        "--include",
        "browser_*",
      ]);

      const result = await client.listTools();
      const toolNames = result.tools.map((t) => t.name);

      // Excluded (dangerous operations)
      expect(toolNames).not.toContain("browser_click");
      expect(toolNames).not.toContain("browser_type");
      expect(toolNames).not.toContain("browser_evaluate");
      expect(toolNames).not.toContain("browser_fill_form");

      // Included (safe operations)
      expect(toolNames).toContain("browser_navigate");
      expect(toolNames).toContain("browser_snapshot");
      expect(toolNames).toContain("browser_screenshot");
      expect(toolNames).toContain("browser_console_messages");
    });
  });

  describe("Tool Calling Validation", () => {
    it("should allow calling included tools", async () => {
      await createClient(["--include", "browser_navigate"]);

      const result = await client.callTool({
        name: "browser_navigate",
        arguments: { url: "https://example.com" },
      });

      const content = result.content as Array<{ type: string; text?: string }>;
      expect(content[0].type).toBe("text");
      expect(content[0].text).toContain("Navigated to");
    });

    it("should block calling excluded tools", async () => {
      await createClient(["--exclude", "browser_close"]);

      await expect(
        client.callTool({
          name: "browser_close",
          arguments: {},
        })
      ).rejects.toThrow();
    });

    it("should block calling tools not in include whitelist", async () => {
      await createClient(["--include", "browser_navigate"]);

      await expect(
        client.callTool({
          name: "browser_close",
          arguments: {},
        })
      ).rejects.toThrow();
    });
  });

  describe("Edge Cases", () => {
    it("should handle no patterns (passthrough mode)", async () => {
      await createClient([]);

      const result = await client.listTools();
      const toolNames = result.tools.map((t) => t.name);

      // All tools should be available
      expect(toolNames).toContain("browser_navigate");
      expect(toolNames).toContain("browser_close");
      expect(toolNames).toContain("browser_screenshot");
      expect(toolNames).toContain("other_tool");
    });

    it("should handle wildcard include", async () => {
      await createClient(["--include", "browser_*"]);

      const result = await client.listTools();
      const toolNames = result.tools.map((t) => t.name);

      // All browser_ tools included
      expect(toolNames).toContain("browser_navigate");
      expect(toolNames).toContain("browser_close");

      // Non-browser tools excluded
      expect(toolNames).not.toContain("other_tool");
    });

    it("should handle exact name matching", async () => {
      await createClient(["--exclude", "browser_close"]);

      const result = await client.listTools();
      const toolNames = result.tools.map((t) => t.name);

      // Only exact match excluded
      expect(toolNames).not.toContain("browser_close");

      // Similar names not affected
      expect(toolNames).toContain("browser_navigate");
      expect(toolNames).toContain("browser_snapshot");
    });
  });
});
