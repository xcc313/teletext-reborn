import fc from 'fast-check';
import { describe, it } from 'vitest';
import { validatePage } from '../../src/model';
import type { Page } from '../../src/model';
import { createPageStore } from '../../src/store';
import { makeTestPage } from '../nav/testPages';

const pageNumber = fc.constantFrom(100, 101, 302, 888);

const validPage: fc.Arbitrary<unknown> = fc
  .tuple(pageNumber, fc.boolean())
  .map(([n, stale]) => makeTestPage(n, [100, 101, 302, 888], stale));

const invalidPage: fc.Arbitrary<unknown> = fc.oneof(
  pageNumber.map((n) => {
    const page = makeTestPage(n);
    return { ...page, rows: page.rows.slice(0, 24) };
  }),
  pageNumber.map((n) => {
    const page = makeTestPage(n);
    const rows = page.rows.map((row) => row.map((cell) => ({ ...cell })));
    (rows[5] ?? [])[7] = { char: 'X', fg: 'white', bg: 'orange' as never };
    return { ...page, rows };
  }),
  pageNumber.map((n) => ({ ...makeTestPage(n), number: n + 1000 })),
  pageNumber.map((n) => ({ ...makeTestPage(n), stale: true })), // header lacks the marker
  pageNumber.map((n) => ({ ...makeTestPage(n), fastext: [] })),
  fc.anything(),
);

describe('page store (property)', () => {
  /** **Validates: Requirements 5.2, 5.3** */
  it('never holds an invalid page, and a rejected set() leaves the stored page unchanged', () => {
    fc.assert(
      fc.property(
        fc.array(fc.oneof(validPage, invalidPage), { maxLength: 40 }),
        (candidates) => {
          const store = createPageStore({ onReject: () => {} });
          for (const candidate of candidates) {
            const before = new Map(store.numbers().map((n) => [n, store.get(n)]));
            const accepted = store.set(candidate as Page);
            if (accepted !== validatePage(candidate).valid) return false;
            if (!accepted) {
              if (store.numbers().length !== before.size) return false;
              for (const [n, page] of before) if (store.get(n) !== page) return false;
            }
            for (const n of store.numbers()) {
              if (!validatePage(store.get(n)).valid) return false;
            }
          }
          return true;
        },
      ),
    );
  });
});
