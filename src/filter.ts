import { minimatch } from "minimatch";
import { FilterPattern } from "./cli.js";

export class Filter {
  private hasIncludePatterns: boolean;

  constructor(private patterns: FilterPattern[]) {
    this.hasIncludePatterns = patterns.some((p) => p.type === "include");
  }

  shouldExclude(name: string): boolean {
    // Evaluate patterns in order - first match wins (rsync-style)
    for (const pattern of this.patterns) {
      if (minimatch(name, pattern.pattern)) {
        // First pattern that matches determines the outcome
        return pattern.type === "exclude";
      }
    }

    // No pattern matched - determine default behavior
    // If there are include patterns, default is exclude (whitelist mode)
    // Otherwise, default is include (allow all)
    return this.hasIncludePatterns;
  }

  filterList<T extends { name: string }>(items: T[]): T[] {
    return items.filter((item) => !this.shouldExclude(item.name));
  }
}
