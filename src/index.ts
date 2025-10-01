#!/usr/bin/env node

import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseArgs } from './cli.js';
import { Filter } from './filter.js';
import { ProxyServer } from './proxy.js';

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);

  let config;
  try {
    config = parseArgs(args);
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    console.error('Usage: mcp-filter [--disable <pattern>]... -- <upstream-command> [args...]');
    console.error('Example: mcp-filter --disable "playwright*" -- npx @playwright/mcp');
    process.exit(1);
  }

  console.error(`Starting MCP filter with ${config.disablePatterns.length} pattern(s)`);
  config.disablePatterns.forEach(p => console.error(`  Disable: ${p}`));

  // Spawn upstream server
  const upstreamProcess = spawnUpstream(config.upstreamCommand);

  // Create filter
  const filter = new Filter(config.disablePatterns);

  // Create proxy server
  const proxy = new ProxyServer(
    {
      name: 'mcp-filter',
      version: '0.1.0',
    },
    filter
  );

  // Connect client to upstream server via subprocess stdio
  const clientTransport = new StdioClientTransport({
    command: config.upstreamCommand[0],
    args: config.upstreamCommand.slice(1),
    stderr: 'pipe',
  });

  await proxy.getClient().connect(clientTransport);
  console.error('Connected to upstream server');

  // Connect server to current process stdio (for the MCP client calling us)
  const serverTransport = new StdioServerTransport();
  await proxy.getServer().connect(serverTransport);
  console.error('MCP filter proxy ready');

  // Handle cleanup
  const cleanup = () => {
    console.error('Shutting down...');
    upstreamProcess.kill();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

function spawnUpstream(command: string[]): ChildProcessWithoutNullStreams {
  const [cmd, ...args] = command;

  const proc = spawn(cmd, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // Forward stderr to our stderr
  proc.stderr.on('data', (data) => {
    process.stderr.write(data);
  });

  proc.on('error', (error) => {
    console.error(`Failed to start upstream server: ${error.message}`);
    process.exit(1);
  });

  proc.on('exit', (code) => {
    console.error(`Upstream server exited with code ${code}`);
    process.exit(code || 0);
  });

  return proc;
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
