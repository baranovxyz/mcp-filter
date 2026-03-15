import { describe, it, expect, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * MCP Specification Compliance Tests
 *
 * Tests the proxy against the MCP specification (2025-11-25) to verify
 * correct handling of all protocol methods, notifications, and capabilities.
 *
 * Reference: https://spec.modelcontextprotocol.io/
 */
describe.sequential("MCP Spec Compliance", () => {
  const specServer = path.resolve(__dirname, "../fixtures/spec-server.ts");
  const filterBin = path.resolve(__dirname, "../../dist/index.js");

  let client: Client;

  const createClient = async (
    filterArgs: string[],
    clientCapabilities: Record<string, unknown> = {}
  ) => {
    client = new Client(
      { name: "spec-test-client", version: "1.0.0" },
      { capabilities: clientCapabilities }
    );

    const transport = new StdioClientTransport({
      command: "node",
      args: [filterBin, ...filterArgs, "--", "npx", "tsx", specServer],
    });

    await client.connect(transport);
  };

  afterEach(async () => {
    if (client) {
      try {
        await client.close();
      } catch {
        // Best-effort cleanup
      }
    }
  });

  // ===================================================================
  // 1. INITIALIZATION & CAPABILITIES (MCP Spec §5.1)
  // ===================================================================
  describe("Initialization & Capabilities", () => {
    it("should complete initialization handshake", async () => {
      await createClient(["--exclude", "blocked_*"]);

      const serverVersion = client.getServerVersion();
      expect(serverVersion).toBeDefined();
      expect(serverVersion!.name).toBe("mcp-filter");
    });

    it("should advertise tools capability", async () => {
      await createClient([]);

      const caps = client.getServerCapabilities();
      expect(caps?.tools).toBeDefined();
    });

    it("should advertise resources capability", async () => {
      await createClient([]);

      const caps = client.getServerCapabilities();
      expect(caps?.resources).toBeDefined();
    });

    it("should advertise prompts capability", async () => {
      await createClient([]);

      const caps = client.getServerCapabilities();
      expect(caps?.prompts).toBeDefined();
    });

    it("should mirror logging capability from upstream", async () => {
      await createClient([]);

      const caps = client.getServerCapabilities();
      expect(caps?.logging).toBeDefined();
    });

    it("should mirror completions capability from upstream", async () => {
      await createClient([]);

      const caps = client.getServerCapabilities();
      expect(caps?.completions).toBeDefined();
    });

    it("should mirror resources.subscribe from upstream", async () => {
      await createClient([]);

      const caps = client.getServerCapabilities();
      expect(caps?.resources?.subscribe).toBe(true);
    });

    it("should mirror listChanged flags from upstream", async () => {
      await createClient([]);

      const caps = client.getServerCapabilities();
      expect(caps?.tools?.listChanged).toBe(true);
      expect(caps?.resources?.listChanged).toBe(true);
      expect(caps?.prompts?.listChanged).toBe(true);
    });
  });

  // ===================================================================
  // 2. PING (MCP Spec §6.1)
  // ===================================================================
  describe("Ping", () => {
    it("should respond to ping requests", async () => {
      await createClient([]);

      const result = await client.ping();
      expect(result).toEqual({});
    });
  });

  // ===================================================================
  // 3. TOOLS (MCP Spec §6.4)
  // ===================================================================
  describe("Tools", () => {
    it("should filter tools/list results", async () => {
      await createClient(["--exclude", "blocked_*"]);

      const result = await client.listTools();
      const names = result.tools.map((t) => t.name);

      expect(names).toContain("allowed_tool");
      expect(names).not.toContain("blocked_tool");
    });

    it("should forward tools/call for allowed tools", async () => {
      await createClient(["--exclude", "blocked_*"]);

      const result = await client.callTool({
        name: "allowed_tool",
        arguments: { message: "hello" },
      });

      const content = result.content as Array<{ type: string; text?: string }>;
      expect(content[0].text).toContain("allowed_tool");
    });

    it("should block tools/call for excluded tools", async () => {
      await createClient(["--exclude", "blocked_*"]);

      await expect(
        client.callTool({
          name: "blocked_tool",
          arguments: { message: "hello" },
        })
      ).rejects.toThrow();
    });

    it("should preserve tool metadata (description, inputSchema)", async () => {
      await createClient([]);

      const result = await client.listTools();
      const tool = result.tools.find((t) => t.name === "allowed_tool");

      expect(tool).toBeDefined();
      expect(tool!.description).toBe("This tool should be allowed");
      expect(tool!.inputSchema).toBeDefined();
      expect(tool!.inputSchema.properties).toHaveProperty("message");
    });
  });

  // ===================================================================
  // 4. RESOURCES (MCP Spec §6.5)
  // ===================================================================
  describe("Resources", () => {
    it("should filter resources/list results", async () => {
      await createClient(["--exclude", "blocked_*"]);

      const result = await client.listResources();
      const names = result.resources.map((r) => r.name);

      expect(names).toContain("allowed_resource");
      expect(names).not.toContain("blocked_resource");
    });

    it("should filter resources/templates/list results", async () => {
      await createClient(["--exclude", "blocked_*"]);

      const result = await client.listResourceTemplates();
      const names = result.resourceTemplates.map((t) => t.name);

      expect(names).toContain("allowed_template");
      expect(names).not.toContain("blocked_template");
    });

    it("should forward resources/read (by URI, not filtered)", async () => {
      await createClient(["--exclude", "blocked_*"]);

      const result = await client.readResource({
        uri: "file:///allowed.txt",
      });

      expect(result.contents).toBeDefined();
      expect(result.contents[0].text).toContain("file:///allowed.txt");
    });

    it("should preserve resource metadata (uri, description, mimeType)", async () => {
      await createClient([]);

      const result = await client.listResources();
      const resource = result.resources.find(
        (r) => r.name === "allowed_resource"
      );

      expect(resource).toBeDefined();
      expect(resource!.uri).toBe("file:///allowed.txt");
      expect(resource!.description).toBe("Allowed resource");
    });
  });

  // ===================================================================
  // 5. RESOURCE SUBSCRIPTIONS (MCP Spec §6.5.4)
  // ===================================================================
  describe("Resource Subscriptions", () => {
    it("should forward resources/subscribe to upstream", async () => {
      await createClient([]);

      // Should succeed — proxy forwards to upstream which supports subscriptions
      const result = await client.subscribeResource({
        uri: "file:///allowed.txt",
      });
      expect(result).toEqual({});
    });

    it("should forward resources/unsubscribe to upstream", async () => {
      await createClient([]);

      // Subscribe first, then unsubscribe
      await client.subscribeResource({ uri: "file:///allowed.txt" });

      const result = await client.unsubscribeResource({
        uri: "file:///allowed.txt",
      });
      expect(result).toEqual({});
    });
  });

  // ===================================================================
  // 6. PROMPTS (MCP Spec §6.6)
  // ===================================================================
  describe("Prompts", () => {
    it("should filter prompts/list results", async () => {
      await createClient(["--exclude", "blocked_*"]);

      const result = await client.listPrompts();
      const names = result.prompts.map((p) => p.name);

      expect(names).toContain("allowed_prompt");
      expect(names).not.toContain("blocked_prompt");
    });

    it("should forward prompts/get for allowed prompts", async () => {
      await createClient(["--exclude", "blocked_*"]);

      const result = await client.getPrompt({
        name: "allowed_prompt",
        arguments: { topic: "testing" },
      });

      expect(result.messages).toBeDefined();
      expect(result.messages.length).toBeGreaterThan(0);
    });

    it("should block prompts/get for excluded prompts", async () => {
      await createClient(["--exclude", "blocked_*"]);

      await expect(
        client.getPrompt({
          name: "blocked_prompt",
          arguments: { topic: "testing" },
        })
      ).rejects.toThrow();
    });

    it("should preserve prompt metadata (description, arguments)", async () => {
      await createClient([]);

      const result = await client.listPrompts();
      const prompt = result.prompts.find((p) => p.name === "allowed_prompt");

      expect(prompt).toBeDefined();
      expect(prompt!.description).toBe("Allowed prompt");
      expect(prompt!.arguments).toBeDefined();
      expect(prompt!.arguments![0].name).toBe("topic");
      expect(prompt!.arguments![0].required).toBe(true);
    });
  });

  // ===================================================================
  // 7. LOGGING (MCP Spec §6.9)
  // ===================================================================
  describe("Logging", () => {
    it("should forward logging/setLevel to upstream", async () => {
      await createClient([]);

      // Proxy mirrors logging capability, so this should succeed
      const result = await client.setLoggingLevel("warning");
      expect(result).toEqual({});
    });

    it("should forward logging/setLevel for all valid levels", async () => {
      await createClient([]);

      // Test multiple log levels per MCP spec (RFC 5424)
      for (const level of ["debug", "info", "warning", "error"] as const) {
        const result = await client.setLoggingLevel(level);
        expect(result).toEqual({});
      }
    });
  });

  // ===================================================================
  // 8. COMPLETIONS (MCP Spec §6.8)
  // ===================================================================
  describe("Completions", () => {
    it("should forward completion/complete for allowed prompts", async () => {
      await createClient([]);

      const result = await client.complete({
        ref: { type: "ref/prompt", name: "allowed_prompt" },
        argument: { name: "topic", value: "opt" },
      });

      expect(result.completion).toBeDefined();
      expect(result.completion.values).toContain("option1");
      expect(result.completion.values).toContain("option2");
      expect(result.completion.values).toContain("option3");
    });

    it("should forward completion/complete for resource templates", async () => {
      await createClient([]);

      const result = await client.complete({
        ref: { type: "ref/resource", uri: "file:///docs/{id}" },
        argument: { name: "id", value: "doc" },
      });

      expect(result.completion).toBeDefined();
      expect(result.completion.values).toContain("doc1");
      expect(result.completion.values).toContain("doc2");
      expect(result.completion.values).toContain("doc3");
    });

    it("should block completion for excluded prompts", async () => {
      await createClient(["--exclude", "blocked_*"]);

      await expect(
        client.complete({
          ref: { type: "ref/prompt", name: "blocked_prompt" },
          argument: { name: "topic", value: "opt" },
        })
      ).rejects.toThrow(/not available/);
    });
  });

  // ===================================================================
  // 9. FILTER EDGE CASES
  // ===================================================================
  describe("Filter Edge Cases", () => {
    it("should return empty lists when all items are filtered out", async () => {
      // Use an include pattern that matches nothing
      await createClient(["--include", "nonexistent_*"]);

      const tools = await client.listTools();
      const resources = await client.listResources();
      const prompts = await client.listPrompts();
      const templates = await client.listResourceTemplates();

      expect(tools.tools).toEqual([]);
      expect(resources.resources).toEqual([]);
      expect(prompts.prompts).toEqual([]);
      expect(templates.resourceTemplates).toEqual([]);
    });

    it("should pass through everything with no filters", async () => {
      await createClient([]);

      const tools = await client.listTools();
      const resources = await client.listResources();
      const prompts = await client.listPrompts();
      const templates = await client.listResourceTemplates();

      expect(tools.tools.length).toBe(4);
      expect(resources.resources.length).toBe(2);
      expect(prompts.prompts.length).toBe(2);
      expect(templates.resourceTemplates.length).toBe(2);
    });

    it("should apply include-only whitelist across all primitives", async () => {
      await createClient(["--include", "allowed_*"]);

      const tools = await client.listTools();
      const resources = await client.listResources();
      const prompts = await client.listPrompts();
      const templates = await client.listResourceTemplates();

      expect(tools.tools.every((t) => t.name.startsWith("allowed_"))).toBe(
        true
      );
      expect(
        resources.resources.every((r) => r.name.startsWith("allowed_"))
      ).toBe(true);
      expect(
        prompts.prompts.every((p) => p.name.startsWith("allowed_"))
      ).toBe(true);
      expect(
        templates.resourceTemplates.every((t) => t.name.startsWith("allowed_"))
      ).toBe(true);
    });

    it("should apply exclude filter across all primitives", async () => {
      await createClient(["--exclude", "blocked_*"]);

      const tools = await client.listTools();
      const resources = await client.listResources();
      const prompts = await client.listPrompts();
      const templates = await client.listResourceTemplates();

      expect(tools.tools.every((t) => !t.name.startsWith("blocked_"))).toBe(
        true
      );
      expect(
        resources.resources.every((r) => !r.name.startsWith("blocked_"))
      ).toBe(true);
      expect(
        prompts.prompts.every((p) => !p.name.startsWith("blocked_"))
      ).toBe(true);
      expect(
        templates.resourceTemplates.every(
          (t) => !t.name.startsWith("blocked_")
        )
      ).toBe(true);
    });

    it("should handle rsync-style include+exclude ordering", async () => {
      await createClient([
        "--include",
        "allowed_*",
        "--exclude",
        "*",
      ]);

      const tools = await client.listTools();
      expect(tools.tools.length).toBe(1);
      expect(tools.tools[0].name).toBe("allowed_tool");
    });

    it("should block calls to tools not in whitelist", async () => {
      await createClient(["--include", "allowed_*"]);

      await expect(
        client.callTool({
          name: "blocked_tool",
          arguments: { message: "test" },
        })
      ).rejects.toThrow();
    });

    it("should block prompts/get for prompts not in whitelist", async () => {
      await createClient(["--include", "allowed_*"]);

      await expect(
        client.getPrompt({
          name: "blocked_prompt",
          arguments: { topic: "test" },
        })
      ).rejects.toThrow();
    });
  });

  // ===================================================================
  // 10. ERROR HANDLING (MCP Spec §5.3)
  // ===================================================================
  describe("Error Handling", () => {
    it("should return error for excluded tool call (not crash)", async () => {
      await createClient(["--exclude", "blocked_*"]);

      try {
        await client.callTool({
          name: "blocked_tool",
          arguments: {},
        });
        expect.unreachable("Should have thrown");
      } catch (error: unknown) {
        expect(error).toBeDefined();
        expect((error as Error).message).toContain("not available");
      }
    });

    it("should return error for excluded prompt get (not crash)", async () => {
      await createClient(["--exclude", "blocked_*"]);

      try {
        await client.getPrompt({
          name: "blocked_prompt",
          arguments: { topic: "test" },
        });
        expect.unreachable("Should have thrown");
      } catch (error: unknown) {
        expect(error).toBeDefined();
        expect((error as Error).message).toContain("not available");
      }
    });

    it("should forward unknown tool calls to upstream (proxy does not validate tool existence)", async () => {
      await createClient([]);

      const result = await client.callTool({
        name: "nonexistent_tool",
        arguments: {},
      });

      const content = result.content as Array<{ type: string; text?: string }>;
      expect(content[0].type).toBe("text");
    });

    it("should return InvalidParams (-32602) error code for excluded tool", async () => {
      await createClient(["--exclude", "blocked_*"]);

      try {
        await client.callTool({
          name: "blocked_tool",
          arguments: {},
        });
        expect.unreachable("Should have thrown");
      } catch (error: unknown) {
        expect((error as { code?: number }).code).toBe(-32602);
      }
    });

    it("should return InvalidParams (-32602) error code for excluded prompt", async () => {
      await createClient(["--exclude", "blocked_*"]);

      try {
        await client.getPrompt({
          name: "blocked_prompt",
          arguments: { topic: "test" },
        });
        expect.unreachable("Should have thrown");
      } catch (error: unknown) {
        expect((error as { code?: number }).code).toBe(-32602);
      }
    });

    it("should return InvalidParams (-32602) error code for excluded completion", async () => {
      await createClient(["--exclude", "blocked_*"]);

      try {
        await client.complete({
          ref: { type: "ref/prompt", name: "blocked_prompt" },
          argument: { name: "topic", value: "opt" },
        });
        expect.unreachable("Should have thrown");
      } catch (error: unknown) {
        expect((error as { code?: number }).code).toBe(-32602);
      }
    });
  });

  // ===================================================================
  // 11. CAPABILITY GATING
  // ===================================================================
  describe("Capability Gating", () => {
    it("should only advertise capabilities that upstream supports", async () => {
      const minimalServer = path.resolve(
        __dirname,
        "../fixtures/minimal-server.ts"
      );

      client = new Client(
        { name: "cap-test-client", version: "1.0.0" },
        {}
      );

      const transport = new StdioClientTransport({
        command: "node",
        args: [filterBin, "--", "npx", "tsx", minimalServer],
      });

      await client.connect(transport);

      const caps = client.getServerCapabilities();
      expect(caps?.tools).toBeDefined();
      expect(caps?.resources).toBeUndefined();
      expect(caps?.prompts).toBeUndefined();
      expect(caps?.logging).toBeUndefined();
      expect(caps?.completions).toBeUndefined();
    });

    it("should still allow tool operations with minimal upstream", async () => {
      const minimalServer = path.resolve(
        __dirname,
        "../fixtures/minimal-server.ts"
      );

      client = new Client(
        { name: "cap-test-client", version: "1.0.0" },
        {}
      );

      const transport = new StdioClientTransport({
        command: "node",
        args: [filterBin, "--", "npx", "tsx", minimalServer],
      });

      await client.connect(transport);

      const result = await client.listTools();
      expect(result.tools.length).toBe(1);
      expect(result.tools[0].name).toBe("test_tool");
    });
  });
});
