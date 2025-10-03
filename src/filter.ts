import { minimatch } from "minimatch";

export class Filter {
  constructor(
    private excludePatterns: string[],
    private includePatterns: string[] = []
  ) {}

  shouldExclude(name: string): boolean {
    // Step 1: Check include patterns (if specified)
    if (this.includePatterns.length > 0) {
      const isIncluded = this.includePatterns.some((pattern) =>
        minimatch(name, pattern)
      );
      if (!isIncluded) return true; // Not included = excluded
    }

    // Step 2: Check exclude patterns (explicit exclude always wins)
    const isExcluded = this.excludePatterns.some((pattern) =>
      minimatch(name, pattern)
    );
    if (isExcluded) return true;

    // Step 3: Default allow
    return false;
  }

  filterList<T extends { name: string }>(items: T[]): T[] {
    return items.filter((item) => !this.shouldExclude(item.name));
  }
}
