export interface FilterConfig {
  disablePatterns: string[];
  upstreamCommand: string[];
}

export function parseArgs(args: string[]): FilterConfig {
  const disablePatterns: string[] = [];
  const upstreamCommand: string[] = [];

  let inUpstreamCommand = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (inUpstreamCommand) {
      upstreamCommand.push(arg);
      continue;
    }

    if (arg === '--') {
      inUpstreamCommand = true;
      continue;
    }

    if (arg === '--disable') {
      const pattern = args[++i];
      if (!pattern) {
        throw new Error('--disable requires a pattern argument');
      }
      disablePatterns.push(pattern);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (upstreamCommand.length === 0) {
    throw new Error('No upstream command specified. Use -- to separate filter args from upstream command');
  }

  return {
    disablePatterns,
    upstreamCommand
  };
}
