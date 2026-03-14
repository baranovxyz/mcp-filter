import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn, type ChildProcess } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * SSE transport integration tests.
 *
 * Spins up a local SSE MCP server, then connects mcp-filter to it
 * via --transport sse --upstream-url. Tests filtering works end-to-end
 * over the deprecated SSE transport.
 */
describe.sequential("SSE Transport", () => {
  const filterBin = path.resolve(__dirname, "../../dist/index.js");
  const sseFixture = path.resolve(__dirname, "../fixtures/sse-server.ts");

  let sseServerProcess: ChildProcess;
  let ssePort: number;

  beforeAll(async () => {
    // Start local SSE MCP server on random port
    sseServerProcess = spawn("npx", ["tsx", sseFixture, "0"], {
      env: process.env,
      stdio: ["pipe", "pipe", "inherit"],
    });

    // Wait for the server to print LISTENING:<port>
    ssePort = await new Promise<number>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("SSE fixture server did not start within 10s"));
      }, 10000);

      let output = "";
      sseServerProcess.stdout!.on("data", (data: Buffer) => {
        output += data.toString();
        const match = output.match(/LISTENING:(\d+)/);
        if (match) {
          clearTimeout(timeout);
          resolve(parseInt(match[1], 10));
        }
      });

      sseServerProcess.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      sseServerProcess.on("exit", (code) => {
        clearTimeout(timeout);
        reject(new Error(`SSE fixture exited with code ${code}`));
      });
    });
  }, 15000);

  afterAll(() => {
    if (sseServerProcess) {
      sseServerProcess.kill("SIGTERM");
    }
  });

  it("should connect to local SSE MCP server and list tools", async () => {
    const client = new Client(
      { name: "sse-list-test", version: "1.0.0" },
      { capabilities: {} }
    );

    const transport = new StdioClientTransport({
      command: "node",
      args: [
        filterBin,
        "--exclude", "blocked_*",
        "--transport", "sse",
        "--upstream-url", `http://127.0.0.1:${ssePort}/sse`,
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

  it("should support include mode over SSE", async () => {
    const client = new Client(
      { name: "sse-include-test", version: "1.0.0" },
      { capabilities: {} }
    );

    const transport = new StdioClientTransport({
      command: "node",
      args: [
        filterBin,
        "--include", "allowed_*",
        "--transport", "sse",
        "--upstream-url", `http://127.0.0.1:${ssePort}/sse`,
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

  it("should call allowed tools over SSE", async () => {
    const client = new Client(
      { name: "sse-call-test", version: "1.0.0" },
      { capabilities: {} }
    );

    const transport = new StdioClientTransport({
      command: "node",
      args: [
        filterBin,
        "--exclude", "blocked_*",
        "--transport", "sse",
        "--upstream-url", `http://127.0.0.1:${ssePort}/sse`,
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

  it("should block excluded tools over SSE", async () => {
    const client = new Client(
      { name: "sse-block-test", version: "1.0.0" },
      { capabilities: {} }
    );

    const transport = new StdioClientTransport({
      command: "node",
      args: [
        filterBin,
        "--exclude", "blocked_*",
        "--transport", "sse",
        "--upstream-url", `http://127.0.0.1:${ssePort}/sse`,
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

  it("should handle rsync-style patterns over SSE", async () => {
    const client = new Client(
      { name: "sse-rsync-test", version: "1.0.0" },
      { capabilities: {} }
    );

    const transport = new StdioClientTransport({
      command: "node",
      args: [
        filterBin,
        "--exclude", "blocked_*",
        "--include", "*_tool",
        "--transport", "sse",
        "--upstream-url", `http://127.0.0.1:${ssePort}/sse`,
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
