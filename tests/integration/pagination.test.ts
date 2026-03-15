import { describe, it, expect, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Pagination tests.
 *
 * Verifies that the proxy drains ALL pages from the upstream server
 * before applying filters. Without this, blocked items on page 2+
 * would silently leak through.
 */
describe.sequential("Pagination Support", () => {
  const filterBin = path.resolve(__dirname, "../../dist/index.js");
  const paginatedServer = path.resolve(
    __dirname,
    "../fixtures/paginated-server.ts"
  );

  let client: Client;

  const createClient = async (args: string[]) => {
    client = new Client(
      { name: "pagination-test", version: "1.0.0" },
      { capabilities: {} }
    );

    const transport = new StdioClientTransport({
      command: "node",
      args: [filterBin, ...args, "--", "npx", "tsx", paginatedServer],
    });

    await client.connect(transport);
  };

  afterEach(async () => {
    if (client) {
      await client.close();
    }
  });

  it("should collect tools from all pages before filtering", async () => {
    await createClient(["--exclude", "blocked_*"]);

    const result = await client.listTools();
    const names = result.tools.map((t) => t.name);

    // Should have all 3 allowed tools from both pages
    expect(names).toContain("allowed_tool_1");
    expect(names).toContain("allowed_tool_2");
    expect(names).toContain("allowed_tool_3");

    // blocked_tool is on page 2 — must still be filtered
    expect(names).not.toContain("blocked_tool");
  });

  it("should return all tools from all pages with no filters", async () => {
    await createClient([]);

    const result = await client.listTools();
    const names = result.tools.map((t) => t.name);

    // All 4 tools from both pages
    expect(names).toHaveLength(4);
    expect(names).toContain("allowed_tool_1");
    expect(names).toContain("allowed_tool_2");
    expect(names).toContain("allowed_tool_3");
    expect(names).toContain("blocked_tool");
  });

  it("should handle include mode across pages", async () => {
    await createClient(["--include", "allowed_*"]);

    const result = await client.listTools();
    const names = result.tools.map((t) => t.name);

    expect(names).toHaveLength(3);
    expect(names).toContain("allowed_tool_1");
    expect(names).toContain("allowed_tool_2");
    expect(names).toContain("allowed_tool_3");
    expect(names).not.toContain("blocked_tool");
  });

  it("should block calling tools from page 2 that are excluded", async () => {
    await createClient(["--exclude", "blocked_*"]);

    await expect(
      client.callTool({ name: "blocked_tool", arguments: {} })
    ).rejects.toThrow();
  });

  it("should allow calling tools from page 2 that are not excluded", async () => {
    await createClient(["--exclude", "blocked_*"]);

    const result = await client.callTool({
      name: "allowed_tool_3",
      arguments: {},
    });

    const content = result.content as Array<{ type: string; text?: string }>;
    expect(content[0].text).toContain("Called: allowed_tool_3");
  });
});
