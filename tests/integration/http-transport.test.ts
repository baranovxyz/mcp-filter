import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * HTTP Transport Integration Tests
 *
 * These tests verify that mcp-filter can successfully connect to and filter
 * real HTTP MCP servers using the Streamable HTTP transport.
 *
 * NOTE: These tests require network access to external HTTP MCP servers.
 * They may be skipped in environments with network restrictions.
 */
describe.sequential("HTTP Transport Integration (requires network access)", () => {
  const filterBin = path.resolve(__dirname, "../../dist/index.js");

  it("should filter resolve-* tools from context7 (user config scenario)", async () => {
    const client = new Client(
      { name: "context7-filter-test", version: "1.0.0" },
      { capabilities: {} }
    );

    // User's exact configuration: exclude resolve-* from context7
    const transport = new StdioClientTransport({
      command: "node",
      args: [
        filterBin,
        "--exclude", "resolve-*",
        "--upstream-url", "https://mcp.context7.com/mcp"
      ],
    });

    try {
      await client.connect(transport);

      const result = await client.listTools();
      expect(result.tools).toBeDefined();
      expect(Array.isArray(result.tools)).toBe(true);

      console.log(`Context7 tools found: ${result.tools.length}`);
      result.tools.forEach(tool => {
        console.log(`  - ${tool.name}`);
      });

      // Verify no tools matching resolve-* pattern are present
      const resolveTools = result.tools.filter(
        (tool) => tool.name.match(/^resolve-/)
      );
      expect(resolveTools.length).toBe(0);

      // Verify get-library-docs should still be present
      const getLibraryDocs = result.tools.find(
        (tool) => tool.name.includes("get-library-docs")
      );
      expect(getLibraryDocs).toBeDefined();
    } finally {
      await client.close();
    }
  }, 60000);

  it("should connect to context7 HTTP MCP server and filter tools", async () => {
    const client = new Client(
      { name: "http-filter-test", version: "1.0.0" },
      { capabilities: {} }
    );

    // Use mcp-filter to connect to context7's public HTTP endpoint
    // We'll exclude any 'delete' or 'remove' tools if they exist
    const transport = new StdioClientTransport({
      command: "node",
      args: [
        filterBin,
        "--exclude", "delete_*",
        "--exclude", "remove_*",
        "--upstream-url", "https://mcp.context7.com/mcp"
      ],
    });

    try {
      // Connection should succeed
      await client.connect(transport);

      // Should be able to list tools
      const result = await client.listTools();
      expect(result.tools).toBeDefined();
      expect(Array.isArray(result.tools)).toBe(true);

      console.log(`Connected to context7, found ${result.tools.length} tools`);

      // Verify no tools matching our exclusion patterns are present
      const excludedTools = result.tools.filter(
        (tool) => tool.name.startsWith("delete_") || tool.name.startsWith("remove_")
      );
      expect(excludedTools.length).toBe(0);
    } finally {
      await client.close();
    }
  }, 60000); // HTTP requests may take longer

  it("should connect to context7 with include filter", async () => {
    const client = new Client(
      { name: "http-include-test", version: "1.0.0" },
      { capabilities: {} }
    );

    // Use include mode to only allow 'search' related tools
    const transport = new StdioClientTransport({
      command: "node",
      args: [
        filterBin,
        "--include", "search_*",
        "--upstream-url", "https://mcp.context7.com/mcp"
      ],
    });

    try {
      await client.connect(transport);

      const result = await client.listTools();
      expect(result.tools).toBeDefined();

      console.log(`Include mode: ${result.tools.length} tools matched 'search_*'`);

      // All tools should match the include pattern or we should have 0 tools
      // (if no search tools exist on this server)
      const nonMatchingTools = result.tools.filter(
        (tool) => !tool.name.startsWith("search_")
      );
      expect(nonMatchingTools.length).toBe(0);
    } finally {
      await client.close();
    }
  }, 60000);

  it("should handle HTTP transport with custom headers", async () => {
    const client = new Client(
      { name: "http-headers-test", version: "1.0.0" },
      { capabilities: {} }
    );

    // Test that --header flag works (even if the server doesn't require it)
    const transport = new StdioClientTransport({
      command: "node",
      args: [
        filterBin,
        "--exclude", "admin_*",
        "--upstream-url", "https://mcp.context7.com/mcp",
        "--header", "X-Test-Header: test-value"
      ],
    });

    try {
      // Should connect successfully even with custom headers
      await client.connect(transport);

      const result = await client.listTools();
      expect(result.tools).toBeDefined();
    } finally {
      await client.close();
    }
  }, 60000);
});
