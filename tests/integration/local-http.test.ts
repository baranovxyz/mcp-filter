import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn, type ChildProcess } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Local HTTP transport integration tests.
 *
 * Spins up a local StreamableHTTP MCP server, then connects mcp-filter
 * to it via --upstream-url. Tests filtering works end-to-end over HTTP
 * without depending on external services.
 */
describe.sequential("Local HTTP Transport", () => {
  const filterBin = path.resolve(__dirname, "../../dist/index.js");
  const httpFixture = path.resolve(__dirname, "../fixtures/http-server.ts");

  let httpServerProcess: ChildProcess;
  let httpPort: number;

  beforeAll(async () => {
    // Start local HTTP MCP server on random port
    httpServerProcess = spawn("npx", ["tsx", httpFixture, "0"], {
      env: process.env,
      stdio: ["pipe", "pipe", "inherit"],
    });

    // Wait for the server to print LISTENING:<port>
    httpPort = await new Promise<number>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("HTTP fixture server did not start within 10s"));
      }, 10000);

      let output = "";
      httpServerProcess.stdout!.on("data", (data: Buffer) => {
        output += data.toString();
        const match = output.match(/LISTENING:(\d+)/);
        if (match) {
          clearTimeout(timeout);
          resolve(parseInt(match[1], 10));
        }
      });

      httpServerProcess.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      httpServerProcess.on("exit", (code) => {
        clearTimeout(timeout);
        reject(new Error(`HTTP fixture exited with code ${code}`));
      });
    });
  }, 15000);

  afterAll(() => {
    if (httpServerProcess) {
      httpServerProcess.kill("SIGTERM");
    }
  });

  it("should connect to local HTTP MCP server and list tools", async () => {
    const client = new Client(
      { name: "local-http-test", version: "1.0.0" },
      { capabilities: {} }
    );

    const transport = new StdioClientTransport({
      command: "node",
      args: [
        filterBin,
        "--exclude", "blocked_*",
        "--upstream-url", `http://127.0.0.1:${httpPort}/mcp`,
      ],
    });

    await client.connect(transport);

    const result = await client.listTools();
    const names = result.tools.map((t) => t.name);

    expect(names).toContain("allowed_tool");
    expect(names).toContain("another_tool");
    expect(names).not.toContain("blocked_tool");

    await client.close();
  }, 10000);

  it("should support include mode over HTTP", async () => {
    const client = new Client(
      { name: "local-http-include-test", version: "1.0.0" },
      { capabilities: {} }
    );

    const transport = new StdioClientTransport({
      command: "node",
      args: [
        filterBin,
        "--include", "allowed_*",
        "--upstream-url", `http://127.0.0.1:${httpPort}/mcp`,
      ],
    });

    await client.connect(transport);

    const result = await client.listTools();
    const names = result.tools.map((t) => t.name);

    expect(names).toContain("allowed_tool");
    expect(names).not.toContain("blocked_tool");
    expect(names).not.toContain("another_tool");

    await client.close();
  }, 10000);

  it("should call allowed tools over HTTP", async () => {
    const client = new Client(
      { name: "local-http-call-test", version: "1.0.0" },
      { capabilities: {} }
    );

    const transport = new StdioClientTransport({
      command: "node",
      args: [
        filterBin,
        "--exclude", "blocked_*",
        "--upstream-url", `http://127.0.0.1:${httpPort}/mcp`,
      ],
    });

    await client.connect(transport);

    const result = await client.callTool({
      name: "allowed_tool",
      arguments: { message: "hello" },
    });

    const content = result.content as Array<{ type: string; text?: string }>;
    expect(content[0].text).toContain("Called: allowed_tool");

    await client.close();
  }, 10000);

  it("should block excluded tools over HTTP", async () => {
    const client = new Client(
      { name: "local-http-block-test", version: "1.0.0" },
      { capabilities: {} }
    );

    const transport = new StdioClientTransport({
      command: "node",
      args: [
        filterBin,
        "--exclude", "blocked_*",
        "--upstream-url", `http://127.0.0.1:${httpPort}/mcp`,
      ],
    });

    await client.connect(transport);

    await expect(
      client.callTool({
        name: "blocked_tool",
        arguments: { message: "test" },
      })
    ).rejects.toThrow();

    await client.close();
  }, 10000);

  it("should support custom headers (passthrough)", async () => {
    const client = new Client(
      { name: "local-http-header-test", version: "1.0.0" },
      { capabilities: {} }
    );

    const transport = new StdioClientTransport({
      command: "node",
      args: [
        filterBin,
        "--exclude", "blocked_*",
        "--upstream-url", `http://127.0.0.1:${httpPort}/mcp`,
        "--header", "X-Test-Header: test-value",
      ],
    });

    await client.connect(transport);

    const result = await client.listTools();
    expect(result.tools.length).toBeGreaterThan(0);

    await client.close();
  }, 10000);

  it("should handle rsync-style patterns over HTTP", async () => {
    const client = new Client(
      { name: "local-http-rsync-test", version: "1.0.0" },
      { capabilities: {} }
    );

    // Exclude blocked, then include *_tool pattern
    const transport = new StdioClientTransport({
      command: "node",
      args: [
        filterBin,
        "--exclude", "blocked_*",
        "--include", "*_tool",
        "--upstream-url", `http://127.0.0.1:${httpPort}/mcp`,
      ],
    });

    await client.connect(transport);

    const result = await client.listTools();
    const names = result.tools.map((t) => t.name);

    expect(names).toContain("allowed_tool");
    expect(names).toContain("another_tool");
    expect(names).not.toContain("blocked_tool");

    await client.close();
  }, 10000);
});
