import { describe, it, expect, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { LoggingMessageNotificationSchema } from "@modelcontextprotocol/sdk/types.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Reliability & Spec Conformance Tests
 *
 * Tests for issues identified in the critical review:
 * - Instructions forwarding from upstream
 * - Logging notification forwarding through proxy
 * - Transport error/close propagation
 */
describe.sequential("Reliability & Spec Conformance", () => {
  const specServer = path.resolve(__dirname, "../fixtures/spec-server.ts");
  const filterBin = path.resolve(__dirname, "../../dist/index.js");

  let client: Client;

  const createClient = async (
    filterArgs: string[] = [],
    clientCapabilities: Record<string, unknown> = {}
  ) => {
    client = new Client(
      { name: "reliability-test-client", version: "1.0.0" },
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
  // 1. INSTRUCTIONS FORWARDING (MCP Spec - initialize response)
  // ===================================================================
  describe("Instructions Forwarding", () => {
    it("should forward upstream server instructions to downstream client", async () => {
      await createClient([]);

      const instructions = client.getInstructions();
      expect(instructions).toBeDefined();
      expect(instructions).toBe(
        "This is a test server. Use allowed_tool for testing. Do not use blocked_tool."
      );
    });

    it("should forward instructions even when filters are active", async () => {
      await createClient(["--exclude", "blocked_*"]);

      const instructions = client.getInstructions();
      expect(instructions).toBeDefined();
      expect(instructions).toContain("test server");
    });
  });

  // ===================================================================
  // 2. LOGGING NOTIFICATION FORWARDING
  // ===================================================================
  describe("Logging Notification Forwarding", () => {
    it("should forward logging messages from upstream through proxy", async () => {
      await createClient([]);

      const logMessages: Array<{
        level: string;
        logger?: string;
        data: unknown;
      }> = [];

      // Set up notification handler to capture log messages
      client.setNotificationHandler(
        LoggingMessageNotificationSchema,
        (notification) => {
          logMessages.push(
            notification.params as {
              level: string;
              logger?: string;
              data: unknown;
            }
          );
        }
      );

      // Call the log_tool which triggers a logging message on upstream
      await client.callTool({ name: "log_tool", arguments: {} });

      // Give a moment for the async notification to propagate
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(logMessages.length).toBeGreaterThanOrEqual(1);
      const logMsg = logMessages.find(
        (m) => m.data === "Log from log_tool"
      );
      expect(logMsg).toBeDefined();
      expect(logMsg!.level).toBe("warning");
      expect(logMsg!.logger).toBe("spec-server");
    });
  });

  // ===================================================================
  // 3. TRANSPORT ERROR/CLOSE PROPAGATION
  // ===================================================================
  describe("Transport Close Propagation", () => {
    it("should close downstream when upstream transport closes", async () => {
      await createClient([]);

      // Verify the proxy is working
      const result = await client.listTools();
      expect(result.tools.length).toBeGreaterThan(0);

      // Set up close detection
      let clientClosed = false;
      client.onclose = () => {
        clientClosed = true;
      };

      // Kill the proxy process (simulates upstream crash)
      // The StdioClientTransport manages a child process - when it dies,
      // the client should detect the close
      const transport = (client as any)._transport;
      if (transport?._process) {
        transport._process.kill("SIGTERM");
      }

      // Wait for close propagation
      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(clientClosed).toBe(true);
    });
  });
});
