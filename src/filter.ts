import { minimatch } from 'minimatch';

export class Filter {
  constructor(private patterns: string[]) {}

  shouldDisable(name: string): boolean {
    return this.patterns.some(pattern => minimatch(name, pattern));
  }

  filterList<T extends { name: string }>(items: T[]): T[] {
    return items.filter(item => !this.shouldDisable(item.name));
  }
}
