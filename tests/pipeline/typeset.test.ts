import { describe, expect, it } from 'vitest';
import { typeset } from '../../src/pipeline/typeset';

// RED step (task 3.1): src/pipeline/typeset does not exist yet; task 3.2 implements it.
//
// Assumed API (to be implemented in 3.2):
//   typeset(text: string): string[]
//   - Pure function. Each returned string is a line of at most 40 characters.
//   - Input lines are split on \n or \r\n.
//   - Words wrap greedily at spaces; lines carry no leading/trailing spaces.
//   - A single word longer than 40 chars is truncated to its first 40 chars and
//     placed on its own line (any pending line is flushed first).
//   - Empty input ('') returns [].
//   - A blank input line is preserved as '' in the output.
//
// Requirements: 1.4, 4.3, 5.1, 6.2

const MAX = 40;

describe('typeset: word wrap at 40 columns', () => {
  it('leaves a short line unchanged', () => {
    expect(typeset('HELLO WORLD')).toEqual(['HELLO WORLD']);
  });

  it('keeps a line of exactly 40 characters on one line', () => {
    const line = `${'A'.repeat(19)} ${'B'.repeat(20)}`; // 19 + 1 + 20 = 40
    expect(line).toHaveLength(MAX);
    expect(typeset(line)).toEqual([line]);
  });

  it('wraps at a word boundary when a line would reach 41 characters', () => {
    const text = `${'A'.repeat(20)} ${'B'.repeat(20)}`; // 41 chars
    expect(typeset(text)).toEqual(['A'.repeat(20), 'B'.repeat(20)]);
  });

  it('wraps a long sentence into lines of at most 40 columns without splitting words', () => {
    const text =
      'The quick brown fox jumps over the lazy dog while the broadcast continues across the nation tonight';
    const lines = typeset(text);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(MAX);
      expect(line).toBe(line.trim());
    }
    expect(lines.join(' ')).toBe(text);
  });
});

describe('typeset: long-word truncation', () => {
  it('truncates a single word longer than 40 characters to 40', () => {
    expect(typeset('X'.repeat(60))).toEqual(['X'.repeat(MAX)]);
  });

  it('puts a truncated long word on its own line after preceding text', () => {
    expect(typeset(`HELLO ${'Y'.repeat(50)} BYE`)).toEqual(['HELLO', 'Y'.repeat(MAX), 'BYE']);
  });

  it('keeps a word of exactly 40 characters intact', () => {
    const word = 'Z'.repeat(MAX);
    expect(typeset(word)).toEqual([word]);
  });
});

describe('typeset: empty input', () => {
  it('returns no lines for an empty string', () => {
    expect(typeset('')).toEqual([]);
  });
});

describe('typeset: blank lines', () => {
  it('preserves a single blank line between paragraphs', () => {
    expect(typeset('FIRST\n\nSECOND')).toEqual(['FIRST', '', 'SECOND']);
  });

  it('preserves multiple consecutive blank lines', () => {
    expect(typeset('A\n\n\nB')).toEqual(['A', '', '', 'B']);
  });

  it('wraps each paragraph independently', () => {
    const long = `${'A'.repeat(25)} ${'B'.repeat(25)}`;
    expect(typeset(`${long}\n\nEND`)).toEqual(['A'.repeat(25), 'B'.repeat(25), '', 'END']);
  });

  it('treats \\r\\n the same as \\n', () => {
    expect(typeset('ONE\r\n\r\nTWO')).toEqual(['ONE', '', 'TWO']);
  });
});
