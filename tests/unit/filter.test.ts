import { describe, it, expect } from 'vitest';
import { Filter } from '../../src/filter.js';

describe('Filter', () => {
  describe('shouldDisable', () => {
    it('should match exact name', () => {
      const filter = new Filter(['exact_match']);

      expect(filter.shouldDisable('exact_match')).toBe(true);
      expect(filter.shouldDisable('not_exact')).toBe(false);
    });

    it('should match wildcard patterns', () => {
      const filter = new Filter(['playwright*']);

      expect(filter.shouldDisable('playwright_navigate')).toBe(true);
      expect(filter.shouldDisable('playwright_click')).toBe(true);
      expect(filter.shouldDisable('playwright')).toBe(true);
      expect(filter.shouldDisable('other_tool')).toBe(false);
    });

    it('should match suffix patterns', () => {
      const filter = new Filter(['*_admin']);

      expect(filter.shouldDisable('delete_admin')).toBe(true);
      expect(filter.shouldDisable('user_admin')).toBe(true);
      expect(filter.shouldDisable('admin_tool')).toBe(false);
    });

    it('should match middle patterns', () => {
      const filter = new Filter(['test_*_debug']);

      expect(filter.shouldDisable('test_foo_debug')).toBe(true);
      expect(filter.shouldDisable('test_bar_baz_debug')).toBe(true);
      expect(filter.shouldDisable('test_debug')).toBe(false);
    });

    it('should match any pattern in list', () => {
      const filter = new Filter(['playwright*', 'debug_*', 'admin']);

      expect(filter.shouldDisable('playwright_click')).toBe(true);
      expect(filter.shouldDisable('debug_log')).toBe(true);
      expect(filter.shouldDisable('admin')).toBe(true);
      expect(filter.shouldDisable('safe_tool')).toBe(false);
    });

    it('should handle empty pattern list', () => {
      const filter = new Filter([]);

      expect(filter.shouldDisable('any_tool')).toBe(false);
    });
  });

  describe('filterList', () => {
    it('should filter items by name', () => {
      const filter = new Filter(['test*']);
      const items = [
        { name: 'test_one', value: 1 },
        { name: 'keep_this', value: 2 },
        { name: 'test_two', value: 3 },
        { name: 'also_keep', value: 4 },
      ];

      const result = filter.filterList(items);

      expect(result).toEqual([
        { name: 'keep_this', value: 2 },
        { name: 'also_keep', value: 4 },
      ]);
    });

    it('should preserve all items when no patterns match', () => {
      const filter = new Filter(['nonexistent']);
      const items = [
        { name: 'tool1', desc: 'a' },
        { name: 'tool2', desc: 'b' },
      ];

      const result = filter.filterList(items);

      expect(result).toEqual(items);
    });

    it('should filter all items when pattern matches all', () => {
      const filter = new Filter(['*']);
      const items = [
        { name: 'tool1' },
        { name: 'tool2' },
        { name: 'tool3' },
      ];

      const result = filter.filterList(items);

      expect(result).toEqual([]);
    });

    it('should handle empty item list', () => {
      const filter = new Filter(['test*']);
      const result = filter.filterList([]);

      expect(result).toEqual([]);
    });
  });
});
