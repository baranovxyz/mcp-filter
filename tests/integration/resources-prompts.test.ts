import { describe, it, expect, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Integration tests for resource and prompt filtering.
 *
 * The proxy handles three MCP primitives: tools, resources, and prompts.
 * Tools are well-tested elsewhere; these tests cover the other two.
 */
describe.sequential("Resource and Prompt Filtering", () => {
  const fixtureServer = path.resolve(__dirname, "../fixtures/full-server.ts");
  const filterBin = path.resolve(__dirname, "../../dist/index.js");

  let client: Client;

  const createClient = async (args: string[]) => {
    client = new Client(
      { name: "rp-test-client", version: "1.0.0" },
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

  describe("Resource filtering", () => {
    it("should list only non-excluded resources", async () => {
      await createClient(["--exclude", "blocked_*"]);

      const result = await client.listResources();
      const names = result.resources.map((r) => r.name);

      expect(names).toContain("allowed_resource");
      expect(names).toContain("other_resource");
      expect(names).not.toContain("blocked_resource");
    });

    it("should list only included resources (whitelist mode)", async () => {
      await createClient(["--include", "allowed_*"]);

      const result = await client.listResources();
      const names = result.resources.map((r) => r.name);

      expect(names).toContain("allowed_resource");
      expect(names).not.toContain("blocked_resource");
      expect(names).not.toContain("other_resource");
    });

    it("should pass through all resources with no filters", async () => {
      await createClient([]);

      const result = await client.listResources();
      const names = result.resources.map((r) => r.name);

      expect(names).toContain("allowed_resource");
      expect(names).toContain("blocked_resource");
      expect(names).toContain("other_resource");
    });

    it("should still allow reading resources (forwarded by URI)", async () => {
      await createClient(["--exclude", "blocked_*"]);

      // Even blocked resources can be read by URI — this is documented behavior
      const result = await client.readResource({
        uri: "file:///blocked_resource.txt",
      });

      expect(result.contents).toBeDefined();
      expect(result.contents.length).toBeGreaterThan(0);
      expect(result.contents[0].text).toContain("file:///blocked_resource.txt");
    });
  });

  describe("Prompt filtering", () => {
    it("should list only non-excluded prompts", async () => {
      await createClient(["--exclude", "blocked_*"]);

      const result = await client.listPrompts();
      const names = result.prompts.map((p) => p.name);

      expect(names).toContain("allowed_prompt");
      expect(names).toContain("other_prompt");
      expect(names).not.toContain("blocked_prompt");
    });

    it("should list only included prompts (whitelist mode)", async () => {
      await createClient(["--include", "allowed_*"]);

      const result = await client.listPrompts();
      const names = result.prompts.map((p) => p.name);

      expect(names).toContain("allowed_prompt");
      expect(names).not.toContain("blocked_prompt");
      expect(names).not.toContain("other_prompt");
    });

    it("should pass through all prompts with no filters", async () => {
      await createClient([]);

      const result = await client.listPrompts();
      const names = result.prompts.map((p) => p.name);

      expect(names).toContain("allowed_prompt");
      expect(names).toContain("blocked_prompt");
      expect(names).toContain("other_prompt");
    });

    it("should allow calling allowed prompts", async () => {
      await createClient(["--exclude", "blocked_*"]);

      const result = await client.getPrompt({
        name: "allowed_prompt",
        arguments: { topic: "testing" },
      });

      expect(result.messages).toBeDefined();
      expect(result.messages.length).toBeGreaterThan(0);
    });

    it("should block calling excluded prompts", async () => {
      await createClient(["--exclude", "blocked_*"]);

      await expect(
        client.getPrompt({
          name: "blocked_prompt",
          arguments: { topic: "testing" },
        })
      ).rejects.toThrow();
    });

    it("should block calling prompts not in include whitelist", async () => {
      await createClient(["--include", "allowed_*"]);

      await expect(
        client.getPrompt({
          name: "other_prompt",
        })
      ).rejects.toThrow();
    });
  });

  describe("Cross-primitive filtering consistency", () => {
    it("should apply same filter pattern across tools, resources, and prompts", async () => {
      await createClient(["--exclude", "blocked_*"]);

      const tools = await client.listTools();
      const resources = await client.listResources();
      const prompts = await client.listPrompts();

      // All blocked_* items should be excluded across all three primitives
      expect(tools.tools.map((t) => t.name)).not.toContain("blocked_tool");
      expect(resources.resources.map((r) => r.name)).not.toContain("blocked_resource");
      expect(prompts.prompts.map((p) => p.name)).not.toContain("blocked_prompt");

      // All allowed_* items should be present
      expect(tools.tools.map((t) => t.name)).toContain("allowed_tool");
      expect(resources.resources.map((r) => r.name)).toContain("allowed_resource");
      expect(prompts.prompts.map((p) => p.name)).toContain("allowed_prompt");
    });
  });
});
