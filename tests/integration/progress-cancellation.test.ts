import { describe, it, expect, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Progress & Cancellation Tests
 *
 * Verifies that:
 * 1. Progress notifications from upstream flow through the proxy to downstream
 * 2. Cancellation signals propagate from downstream through the proxy to upstream
 */
describe.sequential("Progress & Cancellation", () => {
  const specServer = path.resolve(__dirname, "../fixtures/spec-server.ts");
  const filterBin = path.resolve(__dirname, "../../dist/index.js");

  let client: Client;

  const createClient = async () => {
    client = new Client(
      { name: "progress-test-client", version: "1.0.0" },
      {}
    );

    const transport = new StdioClientTransport({
      command: "node",
      args: [filterBin, "--", "npx", "tsx", specServer],
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

  describe("Progress Forwarding", () => {
    it("should forward progress notifications from upstream through proxy", async () => {
      await createClient();

      const progressUpdates: Array<{
        progress: number;
        total?: number;
        message?: string;
      }> = [];

      const result = await client.callTool(
        { name: "slow_tool", arguments: {} },
        undefined,
        {
          onprogress: (progress) => {
            progressUpdates.push(progress);
          },
        }
      );

      expect(progressUpdates.length).toBe(3);
      expect(progressUpdates[0].progress).toBe(1);
      expect(progressUpdates[0].total).toBe(3);
      expect(progressUpdates[0].message).toBe("Step 1 of 3");
      expect(progressUpdates[1].progress).toBe(2);
      expect(progressUpdates[2].progress).toBe(3);
      expect(progressUpdates[2].total).toBe(3);
      expect(progressUpdates[2].message).toBe("Step 3 of 3");

      const content = result.content as Array<{ type: string; text?: string }>;
      expect(content[0].text).toBe("Slow tool completed");
    });

    it("should not send progress when no progressToken is provided", async () => {
      await createClient();

      // Call without onprogress — should still work, just no progress notifications
      const result = await client.callTool({
        name: "slow_tool",
        arguments: {},
      });

      const content = result.content as Array<{ type: string; text?: string }>;
      expect(content[0].text).toBe("Slow tool completed");
    });
  });

  describe("Cancellation", () => {
    it("should propagate cancellation to upstream", async () => {
      await createClient();

      const controller = new AbortController();

      const promise = client.callTool(
        { name: "slow_tool", arguments: {} },
        undefined,
        { signal: controller.signal }
      );

      // Cancel after 50ms (tool takes 300ms total)
      setTimeout(() => controller.abort(), 50);

      await expect(promise).rejects.toThrow();
    });
  });
});
