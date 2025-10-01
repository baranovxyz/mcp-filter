import { describe, it, expect } from 'vitest';
import { parseArgs } from '../../src/cli.js';

describe('CLI Parser', () => {
  describe('parseArgs', () => {
    it('should parse single disable pattern', () => {
      const result = parseArgs(['--disable', 'test*', '--', 'node', 'server.js']);

      expect(result.disablePatterns).toEqual(['test*']);
      expect(result.upstreamCommand).toEqual(['node', 'server.js']);
    });

    it('should parse multiple disable patterns', () => {
      const result = parseArgs([
        '--disable', 'playwright*',
        '--disable', 'debug_*',
        '--', 'npx', 'my-server'
      ]);

      expect(result.disablePatterns).toEqual(['playwright*', 'debug_*']);
      expect(result.upstreamCommand).toEqual(['npx', 'my-server']);
    });

    it('should parse upstream command with arguments', () => {
      const result = parseArgs([
        '--disable', 'test',
        '--', 'node', 'server.js', '--port', '3000'
      ]);

      expect(result.upstreamCommand).toEqual(['node', 'server.js', '--port', '3000']);
    });

    it('should handle no disable patterns', () => {
      const result = parseArgs(['--', 'node', 'server.js']);

      expect(result.disablePatterns).toEqual([]);
      expect(result.upstreamCommand).toEqual(['node', 'server.js']);
    });

    it('should throw error if no upstream command', () => {
      expect(() => parseArgs(['--disable', 'test'])).toThrow(
        'No upstream command specified'
      );
    });

    it('should throw error if disable has no pattern', () => {
      expect(() => parseArgs(['--disable'])).toThrow(
        '--disable requires a pattern argument'
      );
    });

    it('should throw error on unknown argument', () => {
      expect(() => parseArgs(['--unknown', '--', 'node', 'server.js'])).toThrow(
        'Unknown argument: --unknown'
      );
    });

    it('should handle empty upstream command after --', () => {
      expect(() => parseArgs(['--'])).toThrow(
        'No upstream command specified'
      );
    });
  });
});
