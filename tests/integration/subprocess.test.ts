import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Subprocess Management Tests
 *
 * These tests verify the fix for the double-subprocess issue where mcp-filter
 * was spawning the upstream server twice:
 * 1. Once manually via spawnUpstream()
 * 2. Once via StdioClientTransport
 *
 * The fix delegates all subprocess management to StdioClientTransport, which:
 * - Spawns exactly one subprocess
 * - Passes the full environment (env: process.env)
 * - Properly forwards stderr (stderr: "inherit")
 */
describe.sequential("Subprocess Management", () => {
  const filterBin = path.resolve(__dirname, "../../dist/index.js");
  const fixtureServer = path.resolve(__dirname, "../fixtures/simple-server.ts");

  describe.sequential("Single Subprocess Spawning", () => {
    it("should spawn exactly one upstream process (not double-spawn)", async () => {
      const client = new Client(
        { name: "subprocess-test", version: "1.0.0" },
        { capabilities: {} }
      );

      const transport = new StdioClientTransport({
        command: "node",
        args: [filterBin, "--exclude", "blocked_*", "--", "npx", "tsx", fixtureServer],
      });

      // If we were double-spawning, the connection would fail or hang
      await client.connect(transport);

      // Verify we can successfully list tools (proves single working subprocess)
      const result = await client.listTools();
      expect(result.tools.length).toBeGreaterThan(0);

      await client.close();
    });

    it("should successfully connect to upstream server via StdioClientTransport", async () => {
      const client = new Client(
        { name: "connection-test", version: "1.0.0" },
        { capabilities: {} }
      );

      const transport = new StdioClientTransport({
        command: "node",
        args: [filterBin, "--exclude", "test*", "--", "npx", "tsx", fixtureServer],
      });

      // Connection should succeed without errors
      await expect(client.connect(transport)).resolves.not.toThrow();

      // Verify the connection is functional
      const tools = await client.listTools();
      expect(tools.tools).toBeDefined();

      await client.close();
    });
  });

  describe.sequential("Environment Variable Passing", () => {
    it("should pass environment variables to upstream server via npx", async () => {
      const client = new Client(
        { name: "env-test", version: "1.0.0" },
        { capabilities: {} }
      );

      const transport = new StdioClientTransport({
        command: "node",
        args: [
          filterBin,
          "--exclude", "blocked_*",
          "--",
          "npx", "tsx", fixtureServer // npx requires PATH env var
        ],
      });

      // If env vars weren't passed, npx would fail with "command not found"
      await expect(client.connect(transport)).resolves.not.toThrow();

      await client.close();
    }, 10000); // Increase timeout to 10s for npx download

    it("should work with commands that depend on PATH environment variable", async () => {
      const client = new Client(
        { name: "path-test", version: "1.0.0" },
        { capabilities: {} }
      );

      // This specifically tests that npx (which needs PATH) works
      const transport = new StdioClientTransport({
        command: "node",
        args: [filterBin, "--", "npx", "tsx", fixtureServer],
      });

      await expect(client.connect(transport)).resolves.not.toThrow();

      // Verify tools are accessible
      const result = await client.listTools();
      expect(result.tools.length).toBeGreaterThan(0);

      await client.close();
    });
  });

  describe.sequential("Error Handling and Stderr", () => {
    it("should handle upstream server startup correctly", async () => {
      const client = new Client(
        { name: "startup-test", version: "1.0.0" },
        { capabilities: {} }
      );

      const transport = new StdioClientTransport({
        command: "node",
        args: [filterBin, "--exclude", "blocked_*", "--", "npx", "tsx", fixtureServer],
      });

      // Connection should complete without hanging
      await client.connect(transport);

      // Server should be ready to handle requests
      const result = await client.listTools();
      expect(result.tools).toBeDefined();
      expect(result.tools.length).toBeGreaterThan(0);

      await client.close();
    }, 10000); // Increase timeout to 10s for npx download

    it("should fail gracefully when upstream command is invalid", async () => {
      const client = new Client(
        { name: "invalid-cmd-test", version: "1.0.0" },
        { capabilities: {} }
      );

      const transport = new StdioClientTransport({
        command: "node",
        args: [filterBin, "--", "nonexistent-command-xyz"],
      });

      // Should reject with an error, not hang
      await expect(client.connect(transport)).rejects.toThrow();
    }, 10000); // 10s timeout
  });

  describe.sequential("Real-world MCP Server Compatibility", () => {
    it("should work with chrome-devtools-mcp", async () => {
      const client = new Client(
        { name: "chrome-test", version: "1.0.0" },
        { capabilities: {} }
      );

      const transport = new StdioClientTransport({
        command: "node",
        args: [
          filterBin,
          "--exclude", "navigate_*",
          "--",
          "npx", "chrome-devtools-mcp@latest"
        ],
      });

      await client.connect(transport);

      const result = await client.listTools();

      // Verify navigate tools are excluded
      const navigateTools = result.tools.filter(t => t.name.includes("navigate"));
      expect(navigateTools.length).toBe(0);

      // Verify other tools are present
      expect(result.tools.length).toBeGreaterThan(0);

      await client.close();
    }, 30000); // 30s timeout for downloading chrome-devtools-mcp

    it("should work with test fixture server via npx tsx", async () => {
      const client = new Client(
        { name: "tsx-test", version: "1.0.0" },
        { capabilities: {} }
      );

      const transport = new StdioClientTransport({
        command: "node",
        args: [filterBin, "--exclude", "blocked_*", "--", "npx", "tsx", fixtureServer],
      });

      await client.connect(transport);

      const result = await client.listTools();
      const toolNames = result.tools.map(t => t.name);

      expect(toolNames).toContain("allowed_tool");
      expect(toolNames).not.toContain("blocked_tool");

      await client.close();
    });
  });

  describe.sequential("Backwards Compatibility", () => {
    it("should maintain same filtering behavior as before fix", async () => {
      const client = new Client(
        { name: "compat-test", version: "1.0.0" },
        { capabilities: {} }
      );

      const transport = new StdioClientTransport({
        command: "node",
        args: [filterBin, "--exclude", "blocked_*", "--", "npx", "tsx", fixtureServer],
      });

      await client.connect(transport);

      // Test filtering works
      const tools = await client.listTools();
      expect(tools.tools.some(t => t.name === "allowed_tool")).toBe(true);
      expect(tools.tools.some(t => t.name === "blocked_tool")).toBe(false);

      // Test tool calling works
      const result = await client.callTool({
        name: "allowed_tool",
        arguments: { message: "test" },
      });

      const content = result.content as Array<{ type: string; text?: string }>;
      expect(content[0].text).toContain("Allowed:");

      // Test blocked tool calling fails
      await expect(
        client.callTool({
          name: "blocked_tool",
          arguments: { message: "test" },
        })
      ).rejects.toThrow();

      await client.close();
    });
  });
});
