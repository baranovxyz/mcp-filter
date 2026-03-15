import { createConsola } from "consola";

// Force ALL output to stderr so nothing interferes with MCP JSON-RPC on stdout.
// By default consola sends info/success/log to stdout — we must override both streams.
export const logger = createConsola({
  stdout: process.stderr,
  stderr: process.stderr,
});
