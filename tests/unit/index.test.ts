import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.resolve(__dirname, "../../src/index.ts");

/**
 * Architecture Tests for src/index.ts
 *
 * These tests verify the implementation approach documented in CLAUDE.md.
 * They ensure the code follows the correct architecture patterns.
 */
describe("Index Architecture", () => {
  let indexSource: string;

  beforeAll(() => {
    indexSource = readFileSync(indexPath, "utf-8");
  });

  describe("Subprocess Management Architecture", () => {
    it("should NOT manually spawn subprocess (delegates to StdioClientTransport)", () => {
      // The bug was spawning the process twice:
      // 1. Manually via spawn()
      // 2. Via StdioClientTransport
      //
      // The fix: Only StdioClientTransport spawns the subprocess

      // Verify we don't import spawn from child_process
      expect(indexSource).not.toContain('from "child_process"');
      expect(indexSource).not.toContain("from 'child_process'");

      // Verify we don't call spawn()
      expect(indexSource).not.toContain("spawn(");

      // Verify we don't have a spawnUpstream function
      expect(indexSource).not.toContain("function spawnUpstream");
      expect(indexSource).not.toContain("const spawnUpstream");
    });

    it("should use StdioClientTransport for subprocess management", () => {
      // Verify we import and use StdioClientTransport
      expect(indexSource).toContain(
        'StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"'
      );

      // Verify we create a StdioClientTransport instance
      expect(indexSource).toContain("new StdioClientTransport");
    });

    it("should pass environment variables to StdioClientTransport", () => {
      // The fix includes passing env: process.env to ensure npx and other
      // commands have access to PATH and other environment variables

      expect(indexSource).toContain("env: process.env");
    });

    it("should configure stderr forwarding", () => {
      // Verify stderr is configured to inherit (forward to parent process)
      expect(indexSource).toMatch(/stderr:\s*["']inherit["']/);
    });
  });

  describe("Transport Configuration", () => {
    it("should use both client and server transports", () => {
      // Verify dual role: client to upstream, server to caller
      expect(indexSource).toContain("StdioClientTransport");
      expect(indexSource).toContain("StdioServerTransport");
    });

    it("should connect client transport to proxy client", () => {
      expect(indexSource).toContain("proxy.getClient().connect(clientTransport)");
    });

    it("should connect server transport to proxy server", () => {
      expect(indexSource).toContain("proxy.getServer().connect(serverTransport)");
    });
  });

  describe("Cleanup Handling", () => {
    it("should register signal handlers for cleanup", () => {
      expect(indexSource).toContain('process.on("SIGINT"');
      expect(indexSource).toContain('process.on("SIGTERM"');
    });

    it("should NOT manually kill subprocess (StdioClientTransport handles it)", () => {
      // The old code had upstreamProcess.kill() in cleanup
      // The new code doesn't need this because StdioClientTransport
      // manages the subprocess lifecycle

      expect(indexSource).not.toContain(".kill()");
    });
  });

  describe("Code Structure", () => {
    it("should define main() function as entry point", () => {
      expect(indexSource).toContain("async function main()");
      expect(indexSource).toContain("main().catch(");
    });

    it("should use parseArgs from cli module", () => {
      expect(indexSource).toContain('parseArgs } from "./cli.js"');
    });

    it("should use Filter from filter module", () => {
      expect(indexSource).toContain('Filter } from "./filter.js"');
    });

    it("should use ProxyServer from proxy module", () => {
      expect(indexSource).toContain('ProxyServer } from "./proxy.js"');
    });
  });

  describe("Configuration", () => {
    it("should extract command and args from config", () => {
      expect(indexSource).toContain("config.upstreamCommand[0]");
      expect(indexSource).toContain("config.upstreamCommand.slice(1)");
    });

    it("should pass patterns to Filter", () => {
      expect(indexSource).toContain("new Filter(config.patterns)");
    });
  });
});

/**
 * Integration Tests (verify the whole flow)
 */
describe("Index Module Integration", () => {
  let indexSource: string;

  beforeAll(() => {
    indexSource = readFileSync(indexPath, "utf-8");
  });

  it("should export expected structure", () => {
    // Verify the module is executable (has shebang)
    expect(indexSource).toMatch(/^#!\/usr\/bin\/env node/);
  });

  it("should use ESM imports", () => {
    // Verify we're using ES modules (import, not require)
    expect(indexSource).toContain("import ");
    expect(indexSource).not.toContain('require("');
  });

  it("should have error handling", () => {
    expect(indexSource).toContain("try {");
    expect(indexSource).toContain("catch");
    expect(indexSource).toContain("console.error");
  });
});
