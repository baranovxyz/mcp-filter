import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { execFileSync } from "child_process";
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

    it("should use transport factory for client transport", () => {
      // Verify we import and use the transport factory
      expect(indexSource).toContain('createClientTransport } from "./transport.js"');

      // Verify we create transport via factory
      expect(indexSource).toContain("createClientTransport(config.transportConfig)");
    });

    it("should delegate subprocess management to transport layer", () => {
      // The transport factory (in transport.ts) handles subprocess spawning
      // for stdio transports, passing env and stderr configuration.
      // The main index.ts should not handle these details directly.

      // Verify we're using the transport config abstraction
      expect(indexSource).toContain("config.transportConfig");
    });
  });

  describe("Transport Configuration", () => {
    it("should use both client and server transports", () => {
      // Verify dual role: client to upstream (via factory), server to caller (stdio)
      expect(indexSource).toContain("createClientTransport");
      expect(indexSource).toContain("StdioServerTransport");
    });

    it("should connect to upstream via two-phase init", () => {
      expect(indexSource).toContain("proxy.connectToUpstream(clientTransport)");
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
    it("should use transport config abstraction", () => {
      // The new architecture uses config.transportConfig instead of
      // directly accessing upstreamCommand
      expect(indexSource).toContain("config.transportConfig");
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
    // Note: createRequire is used to load package.json (standard ESM pattern)
    expect(indexSource).toContain("import ");
    expect(indexSource).toContain("createRequire");
  });

  it("should have error handling", () => {
    expect(indexSource).toContain("try {");
    expect(indexSource).toContain("catch");
    expect(indexSource).toContain("logger.error");
  });

  it("should read version from package.json (not hardcoded)", () => {
    expect(indexSource).toContain("createRequire(import.meta.url)");
    expect(indexSource).toContain('require("../package.json")');
    // Verify no hardcoded version string in proxy instantiation
    expect(indexSource).not.toMatch(/version:\s*["'][\d.]+["']/);
  });
});

describe("Logger Architecture", () => {
  let loggerSource: string;

  beforeAll(() => {
    const loggerPath = path.resolve(__dirname, "../../src/logger.ts");
    loggerSource = readFileSync(loggerPath, "utf-8");
  });

  it("should redirect stdout to stderr so log messages never corrupt MCP JSON-RPC", () => {
    // Consola sends info/success/log to stdout by default.
    // MCP uses stdout for JSON-RPC, so any log line on stdout causes
    // clients (e.g. Cursor) to fail with "not valid JSON" parse errors.
    expect(loggerSource).toContain("stdout: process.stderr");
    expect(loggerSource).toContain("stderr: process.stderr");
  });
});

describe("CLI Flags", () => {
  const filterBin = path.resolve(__dirname, "../../dist/index.js");

  it("should print version with --version", () => {
    const pkg = JSON.parse(
      readFileSync(path.resolve(__dirname, "../../package.json"), "utf-8")
    );
    const output = execFileSync("node", [filterBin, "--version"], {
      encoding: "utf-8",
    }).trim();
    expect(output).toBe(pkg.version);
  });

  it("should print help with --help and exit 0", () => {
    const output = execFileSync("node", [filterBin, "--help"], {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    // --help prints to stderr, stdout may be empty
    // The process should exit 0 (no throw)
  });

  it("should exit 1 with usage on invalid args", () => {
    try {
      execFileSync("node", [filterBin, "--invalid-flag"], {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      expect.unreachable("Should have exited with code 1");
    } catch (error: unknown) {
      expect((error as { status: number }).status).toBe(1);
    }
  });
});
