import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Proxy Integration", () => {
  let client: Client;

  beforeAll(async () => {
    const fixtureServer = path.resolve(
      __dirname,
      "../fixtures/simple-server.ts"
    );
    const filterBin = path.resolve(__dirname, "../../dist/index.js");

    client = new Client(
      { name: "test-client", version: "1.0.0" },
      { capabilities: {} }
    );

    const transport = new StdioClientTransport({
      command: "node",
      args: [
        filterBin,
        "--exclude",
        "blocked_*",
        "--",
        "npx",
        "tsx",
        fixtureServer,
      ],
    });

    await client.connect(transport);
  });

  afterAll(async () => {
    await client.close();
  });

  it("should list only allowed tools", async () => {
    const result = await client.listTools();

    const toolNames = result.tools.map((t) => t.name);
    expect(toolNames).toContain("allowed_tool");
    expect(toolNames).not.toContain("blocked_tool");
  });

  it("should allow calling allowed tools", async () => {
    const result = await client.callTool({
      name: "allowed_tool",
      arguments: { message: "test" },
    });

    const content = result.content as Array<{ type: string; text?: string }>;
    expect(content[0].type).toBe("text");
    expect(content[0].text).toContain("Allowed:");
  });

  it("should block calling filtered tools", async () => {
    await expect(
      client.callTool({
        name: "blocked_tool",
        arguments: { message: "test" },
      })
    ).rejects.toThrow();
  });
});
