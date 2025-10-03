export interface FilterConfig {
  excludePatterns: string[];
  includePatterns: string[];
  upstreamCommand: string[];
}

export function parseArgs(args: string[]): FilterConfig {
  const excludePatterns: string[] = [];
  const includePatterns: string[] = [];
  const upstreamCommand: string[] = [];

  let inUpstreamCommand = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (inUpstreamCommand) {
      upstreamCommand.push(arg);
      continue;
    }

    if (arg === "--") {
      inUpstreamCommand = true;
      continue;
    }

    if (arg === "--exclude") {
      const pattern = args[++i];
      if (!pattern) {
        throw new Error("--exclude requires a pattern argument");
      }
      excludePatterns.push(pattern);
      continue;
    }

    if (arg === "--include") {
      const pattern = args[++i];
      if (!pattern) {
        throw new Error("--include requires a pattern argument");
      }
      includePatterns.push(pattern);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (upstreamCommand.length === 0) {
    throw new Error(
      "No upstream command specified. Use -- to separate filter args from upstream command"
    );
  }

  return {
    excludePatterns,
    includePatterns,
    upstreamCommand,
  };
}
