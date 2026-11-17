import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { typeset } from '../../src/pipeline/typeset';

// Task 3.3: property-based tests for typeset().
// Requirements: 1.4, 4.3, 5.1, 6.2

const MAX = 40;

// No unpaired surrogate (lib target lacks String.prototype.isWellFormed).
const isWellFormed = (s: string): boolean =>
  !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s);

const SEPARATORS = [' ', '  ', '\t', '\n', '\r\n', '\n\n', '\u00a0', '\u2028', '\u3000', ' \n '];

// Arbitrary UTF-16 strings, including lone surrogates.
const binaryText = fc.string({ unit: 'binary', maxLength: 300 });

// Well-formed unicode (code points, graphemes, emoji, combining marks).
const unicodeText = fc.string({ unit: 'grapheme', maxLength: 300 });

// Mostly whitespace with a few word characters mixed in.
const whitespaceHeavy = fc
  .array(fc.constantFrom(...SEPARATORS, 'a', 'WORD', '\u{1F600}'), { maxLength: 120 })
  .map((parts) => parts.join(''));

// Words of 0-120 characters (often longer than 40) joined by assorted separators.
const longWords = fc
  .array(
    fc.tuple(
      fc.string({ unit: fc.constantFrom('a', 'Z', '9', '\u00e9', '\u{1F600}'), maxLength: 120 }),
      fc.constantFrom(...SEPARATORS),
    ),
    { maxLength: 20 },
  )
  .map((pairs) => pairs.map(([word, sep]) => word + sep).join(''));

const inputs: Array<[string, fc.Arbitrary<string>]> = [
  ['arbitrary UTF-16 (binary)', binaryText],
  ['well-formed unicode', unicodeText],
  ['whitespace-heavy', whitespaceHeavy],
  ['long words', longWords],
];

describe.each(inputs)('typeset properties: %s', (_name, arbitraryText) => {
  it('never emits a line longer than 40 columns (Validates: Requirements 1.4, 4.3, 6.2)', () => {
    fc.assert(
      fc.property(arbitraryText, (text) => {
        for (const line of typeset(text)) {
          expect(line.length).toBeLessThanOrEqual(MAX);
        }
      }),
    );
  });

  it('never throws and returns an array of strings (Validates: Requirements 5.1, 6.2)', () => {
    fc.assert(
      fc.property(arbitraryText, (text) => {
        const lines = typeset(text);
        expect(Array.isArray(lines)).toBe(true);
        for (const line of lines) expect(typeof line).toBe('string');
      }),
    );
  });

  it('never emits lines with leading or trailing whitespace (Validates: Requirements 1.4, 6.2)', () => {
    fc.assert(
      fc.property(arbitraryText, (text) => {
        for (const line of typeset(text)) {
          expect(line).toBe(line.trim());
        }
      }),
    );
  });
});

describe('typeset properties: surrogate pairs', () => {
  it('truncating an overlong word never splits a surrogate pair (Validates: Requirements 1.4, 6.2)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: MAX + 1 }),
        fc.integer({ min: 1, max: 40 }),
        (prefixLength, emojiCount) => {
          // Place astral characters so that a pair can straddle the 40-unit cut.
          const word = 'a'.repeat(prefixLength) + '\u{1F600}'.repeat(emojiCount);
          for (const line of typeset(word)) {
            expect(line.length).toBeLessThanOrEqual(MAX);
            expect(isWellFormed(line)).toBe(true);
          }
        },
      ),
    );
  });

  it('well-formed input yields well-formed output (Validates: Requirements 1.4, 6.2)', () => {
    fc.assert(
      fc.property(unicodeText, (text) => {
        for (const line of typeset(text)) {
          expect(isWellFormed(line)).toBe(true);
        }
      }),
    );
  });
});

describe('typeset regressions found by property tests', () => {
  it('does not leave a lone high surrogate when truncating at the 40-unit boundary', () => {
    // 39 ASCII chars + one astral char: the pair starts at index 39, so slice(0, 40) would cut it in half.
    const word = `${'a'.repeat(39)}\u{1F600}${'b'.repeat(5)}`;
    const [line] = typeset(word);
    expect(line).toBe('a'.repeat(39));
    expect(isWellFormed(line ?? '')).toBe(true);
  });
});
