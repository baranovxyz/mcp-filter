import { createConsola } from "consola";

// Create logger that outputs to stderr to not interfere with MCP JSON-RPC on stdout
export const logger = createConsola({
  stderr: process.stderr,
});
