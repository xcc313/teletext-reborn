import fc from 'fast-check';
import { describe, it } from 'vitest';
import { COLS, validatePage } from '../../src/model';
import { MAX_HEADLINE_LINES, createNewsPage, summarizeHeadline } from '../../src/connectors/news';
import type { NewsItem } from '../../src/connectors/news';

const anyText = fc.string({ unit: 'binary', maxLength: 400 });
const items: fc.Arbitrary<NewsItem[]> = fc.array(fc.record({ title: anyText }), { maxLength: 30 });

describe('headline summarization (property)', () => {
  /** **Validates: Requirements 4.3, 1.4, 6.2** */
  it('never emits more than MAX_HEADLINE_LINES lines or a line longer than 40 columns', () => {
    fc.assert(
      fc.property(anyText, (title) => {
        const lines = summarizeHeadline(title);
        return (
          lines.length <= MAX_HEADLINE_LINES &&
          lines.every((line) => line.length <= COLS && line.length > 0)
        );
      }),
    );
  });
});

describe('page 101 generation (property)', () => {
  /** **Validates: Requirements 4.1, 4.2, 4.3, 1.1, 1.4, 5.2** */
  it('produces a page that passes validatePage for any headlines, mode and stale flag', () => {
    fc.assert(
      fc.property(items, fc.constantFrom('live', 'demo'), fc.boolean(), (list, mode, stale) => {
        const page = createNewsPage(list, new Date(2026, 10, 16, 9, 31), { mode, stale });
        return validatePage(page).valid;
      }),
    );
  });
});
