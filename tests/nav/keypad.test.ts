import { describe, expect, it } from 'vitest';
import { formatEntry, pressKey } from '../../src/nav';

// RED step (task 5.1): src/nav does not exist yet.
//
// Assumed API, exported from src/nav/index.ts:
//   pressKey(entry: string, key: string): { entry: string; page?: number }
//     - entry is the digits typed so far ('' to 2 digits).
//     - A digit extends the entry; the third digit completes it: entry resets to ''
//       and `page` carries the number.
//     - The first digit must be 1-8 (pages are 100-899); other first digits are ignored.
//     - Non-digit keys are ignored.
//   formatEntry(entry: string): string
//     - 4-char header display: 'P' followed by the digits padded with '-' to 3.
//
// Requirements: 2.1, 2.4

describe('pressKey', () => {
  it('starts an entry with the first digit', () => {
    expect(pressKey('', '3')).toEqual({ entry: '3' });
  });

  it('extends a partial entry', () => {
    expect(pressKey('3', '0')).toEqual({ entry: '30' });
  });

  it('completes on the third digit and resets the entry', () => {
    expect(pressKey('30', '2')).toEqual({ entry: '', page: 302 });
  });

  it.each(['0', '9'])('ignores %s as the first digit', (key) => {
    expect(pressKey('', key)).toEqual({ entry: '' });
  });

  it('accepts 0 and 9 after the first digit', () => {
    expect(pressKey('1', '0')).toEqual({ entry: '10' });
    expect(pressKey('89', '9')).toEqual({ entry: '', page: 899 });
  });

  it.each(['a', 'Enter', '12', '', ' '])('ignores non-digit key %j', (key) => {
    expect(pressKey('3', key)).toEqual({ entry: '3' });
  });
});

describe('formatEntry', () => {
  it.each([
    ['', 'P---'],
    ['3', 'P3--'],
    ['30', 'P30-'],
  ])('formats %j as %j', (entry, expected) => {
    expect(formatEntry(entry)).toBe(expected);
  });
});
