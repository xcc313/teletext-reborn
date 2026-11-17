import { describe, expect, it, vi } from 'vitest';
import { createNavigationController } from '../../src/nav';
import { createPageStore } from '../../src/store';
import type { PageRejection } from '../../src/store';
import type { Page } from '../../src/model';
import { makeTestPage, rowText } from '../nav/testPages';

// Task 8: the store is the validation gate (requirements 5.2, 5.3).

/** A page that fails validatePage: row 24 is missing. */
function brokenPage(number: number): Page {
  const page = makeTestPage(number);
  return { ...page, rows: page.rows.slice(0, 24) };
}

describe('createPageStore', () => {
  it('returns undefined for a page that was never stored', () => {
    expect(createPageStore().get(101)).toBeUndefined();
  });

  it('stores a valid page and reports it accepted', () => {
    const store = createPageStore();
    const page = makeTestPage(101);
    expect(store.set(page)).toBe(true);
    expect(store.get(101)).toEqual(page);
    expect(store.numbers()).toEqual([101]);
  });

  it('replaces the page with the same number', () => {
    const store = createPageStore();
    store.set(makeTestPage(101));
    const next = makeTestPage(101, [100, 101, 302, 888], true);
    expect(store.set(next)).toBe(true);
    expect(store.get(101)?.stale).toBe(true);
    expect(store.numbers()).toEqual([101]);
  });

  describe('validation gate', () => {
    it('rejects an invalid page, keeps the last good one, and reports the violations', () => {
      const onReject = vi.fn<(rejection: PageRejection) => void>();
      const store = createPageStore({ onReject });
      const good = makeTestPage(101);
      store.set(good);

      expect(store.set(brokenPage(101))).toBe(false);

      expect(store.get(101)).toEqual(good);
      expect(onReject).toHaveBeenCalledTimes(1);
      const rejection = onReject.mock.calls[0]?.[0];
      expect(rejection?.number).toBe(101);
      expect(rejection?.violations.map((v) => v.rule)).toContain('grid');
    });

    it('rejects an invalid page when there is no previous page, leaving the slot empty', () => {
      const store = createPageStore({ onReject: () => {} });
      expect(store.set(brokenPage(302))).toBe(false);
      expect(store.get(302)).toBeUndefined();
      expect(store.numbers()).toEqual([]);
    });

    it('rejects a page whose header does not match its number', () => {
      const store = createPageStore({ onReject: () => {} });
      const mismatched: Page = { ...makeTestPage(101), number: 102 };
      expect(store.set(mismatched)).toBe(false);
      expect(store.get(102)).toBeUndefined();
    });

    it('rejects values that are not pages without throwing', () => {
      const onReject = vi.fn<(rejection: PageRejection) => void>();
      const store = createPageStore({ onReject });
      for (const junk of [null, undefined, 42, 'page', {}, []]) {
        expect(store.set(junk as unknown as Page)).toBe(false);
      }
      expect(onReject).toHaveBeenCalledTimes(6);
      expect(onReject.mock.calls[0]?.[0].number).toBeUndefined();
      expect(store.numbers()).toEqual([]);
    });

    it('logs row and column of each violation when no onReject is given', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const page = makeTestPage(101);
        const rows = page.rows.map((row) => row.map((cell) => ({ ...cell })));
        (rows[3] as Page['rows'][number])[5] = { char: 'X', fg: 'white', bg: 'orange' as never };
        expect(createPageStore().set({ ...page, rows })).toBe(false);
        const logged = warn.mock.calls.map((call) => call.join(' ')).join('\n');
        expect(logged).toContain('101');
        expect(logged).toContain('row 3');
        expect(logged).toContain('col 5');
      } finally {
        warn.mockRestore();
      }
    });
  });

  describe('subscribe', () => {
    it('notifies with each accepted page and not for rejected ones', () => {
      const store = createPageStore({ onReject: () => {} });
      const listener = vi.fn<(page: Page) => void>();
      store.subscribe(listener);

      const a = makeTestPage(101);
      store.set(a);
      store.set(brokenPage(101));
      const b = makeTestPage(302);
      store.set(b);

      expect(listener.mock.calls.map((c) => c[0])).toEqual([a, b]);
    });

    it('stops notifying after unsubscribe', () => {
      const store = createPageStore();
      const listener = vi.fn();
      const unsubscribe = store.subscribe(listener);
      unsubscribe();
      store.set(makeTestPage(101));
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('navigation integration', () => {
    it('serves as the controller lookup and shows refreshed pages after refresh()', () => {
      const store = createPageStore();
      store.set(makeTestPage(100));
      store.set(makeTestPage(101));
      const controller = createNavigationController({
        lookup: store.get,
        now: () => new Date(2025, 0, 2, 9, 5),
      });

      controller.navigate(101);
      expect(rowText(controller.view(), 1)).toContain('CONTENT OF 101');

      store.set(makeTestPage(101, [100, 101, 302, 888], true));
      expect(controller.view().stale).toBe(true);

      controller.navigate(555);
      expect(rowText(controller.view(), 1)).toContain('PAGE NOT FOUND');
    });

    it('re-emits the view through onChange when a subscribed store gets a new page', () => {
      const store = createPageStore();
      store.set(makeTestPage(100));
      const onChange = vi.fn<(view: Page) => void>();
      const controller = createNavigationController({ lookup: store.get, onChange });
      store.subscribe((page) => {
        if (page.number === controller.currentNumber) controller.refresh();
      });

      store.set(makeTestPage(100, [100, 101, 302, 888], true));
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0]?.[0].stale).toBe(true);
    });
  });
});
