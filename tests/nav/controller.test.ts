import { describe, expect, it, vi } from 'vitest';
import { createNavigationController } from '../../src/nav';
import type { Page } from '../../src/model';
import { makeTestPage, rowText } from './testPages';

// RED step (task 5.1): src/nav does not exist yet.
//
// Assumed API, exported from src/nav/index.ts:
//   createNavigationController({ lookup, now?, initialPage?, onChange? }): NavigationController
//     lookup(number): Page | undefined   page source (the store in task 8); not called for entry state
//     now(): Date                        clock for generated not-found pages (default: new Date)
//     initialPage                        default 100
//     onChange(view: Page)               called after every state change and refresh()
//   controller:
//     view(): Page                       lookup(current) or not-found page; while a partial entry
//                                        exists, header cols 36-39 show formatEntry(entry).
//                                        Never mutates the page returned by lookup.
//     currentNumber / entry              readonly state
//     pressKey(key)                      keypad digit; the third digit navigates
//     activateFastext(color)             navigate to the current view's link of that color
//     navigate(number)                   go to a page directly; clears any partial entry
//     cancelEntry()                      drop a partial entry
//     refresh()                          re-emit the view (e.g. after the store updated a page)
//
// Requirements: 2.1, 2.2, 2.3, 2.4

const NOW = new Date(2025, 0, 2, 9, 5);

function setup(initialPage?: number) {
  const pages = new Map<number, Page>([
    [100, makeTestPage(100, [100, 101, 302, 888])],
    [101, makeTestPage(101, [100, 101, 302, 888])],
    [302, makeTestPage(302, [100, 101, 302, 888])],
    [888, makeTestPage(888, [101, 302, 100, 100])],
  ]);
  const lookup = vi.fn((n: number) => pages.get(n));
  const onChange = vi.fn<(view: Page) => void>();
  const controller = createNavigationController({
    lookup,
    now: () => NOW,
    onChange,
    ...(initialPage === undefined ? {} : { initialPage }),
  });
  return { controller, pages, lookup, onChange };
}

const type = (c: { pressKey(k: string): void }, digits: string): void => {
  for (const d of digits) c.pressKey(d);
};

describe('keypad entry loads the target page (Req 2.1)', () => {
  it('starts on page 100 by default', () => {
    const { controller } = setup();
    expect(controller.currentNumber).toBe(100);
    expect(controller.view().number).toBe(100);
  });

  it('starts on the given initial page', () => {
    expect(setup(302).controller.view().number).toBe(302);
  });

  it('loads the page after three digits', () => {
    const { controller } = setup();
    type(controller, '302');
    expect(controller.currentNumber).toBe(302);
    expect(controller.view().number).toBe(302);
    expect(controller.entry).toBe('');
  });

  it('does not navigate before the third digit', () => {
    const { controller } = setup();
    type(controller, '30');
    expect(controller.currentNumber).toBe(100);
  });

  it('navigates again after a completed entry', () => {
    const { controller } = setup();
    type(controller, '302');
    type(controller, '101');
    expect(controller.view().number).toBe(101);
  });

  it('notifies onChange with the loaded page', () => {
    const { controller, onChange } = setup();
    type(controller, '302');
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ number: 302 }));
  });

  it('navigate() loads a page directly', () => {
    const { controller } = setup();
    controller.navigate(888);
    expect(controller.view().number).toBe(888);
  });
});

describe('partial entry shows in the header (Req 2.4)', () => {
  it('shows typed digits at the right end of row 0', () => {
    const { controller } = setup();
    controller.pressKey('3');
    expect(rowText(controller.view(), 0).slice(36)).toBe('P3--');
    controller.pressKey('0');
    expect(rowText(controller.view(), 0).slice(36)).toBe('P30-');
  });

  it('keeps the current page header and content while typing', () => {
    const { controller } = setup();
    controller.pressKey('3');
    const view = controller.view();
    expect(view.number).toBe(100);
    expect(rowText(view, 0).slice(0, 26)).toBe('P100 TELETEXT REBORN 12:34');
    expect(rowText(view, 1).trimEnd()).toBe('CONTENT OF 100');
  });

  it('keeps the header row 40 cells wide and palette-only', () => {
    const { controller } = setup();
    controller.pressKey('3');
    const header = controller.view().rows[0] ?? [];
    expect(header).toHaveLength(40);
    for (const c of header.slice(36)) {
      expect(c.fg).toBe('white');
      expect(c.bg).toBe('black');
    }
  });

  it('does not mutate the looked-up page', () => {
    const { controller, pages } = setup();
    controller.pressKey('3');
    controller.view();
    expect(rowText(pages.get(100) as Page, 0).slice(36)).toBe('    ');
  });

  it('notifies onChange on each partial digit', () => {
    const { controller, onChange } = setup();
    controller.pressKey('3');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(rowText(onChange.mock.calls[0]?.[0] as Page, 0).slice(36)).toBe('P3--');
  });

  it('removes the partial entry when it is cancelled', () => {
    const { controller } = setup();
    type(controller, '30');
    controller.cancelEntry();
    expect(controller.entry).toBe('');
    expect(rowText(controller.view(), 0).slice(36)).toBe('    ');
  });

  it('ignores a first digit that cannot start a page number', () => {
    const { controller, onChange } = setup();
    controller.pressKey('9');
    expect(controller.entry).toBe('');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows no entry once a page has loaded', () => {
    const { controller } = setup();
    type(controller, '302');
    expect(rowText(controller.view(), 0).slice(36)).toBe('    ');
  });
});

describe('unknown page number shows the not-found page (Req 2.2)', () => {
  it('shows a not-found page carrying the requested number', () => {
    const { controller } = setup();
    type(controller, '555');
    const view = controller.view();
    expect(view.number).toBe(555);
    expect(rowText(view, 0).trimEnd()).toBe('P555 TELETEXT REBORN 09:05');
    const body = view.rows.map((_, i) => rowText(view, i)).join('\n');
    expect(body).toContain('PAGE NOT FOUND');
  });

  it('allows further keypad navigation from the not-found page', () => {
    const { controller } = setup();
    type(controller, '555');
    type(controller, '302');
    expect(controller.view().number).toBe(302);
    expect(rowText(controller.view(), 1).trimEnd()).toBe('CONTENT OF 302');
  });

  it('allows fastext navigation from the not-found page', () => {
    const { controller } = setup();
    type(controller, '555');
    controller.activateFastext('green');
    expect(controller.view().number).toBe(101);
  });

  it('shows a page that appears in the lookup later', () => {
    const { controller, pages } = setup();
    type(controller, '555');
    pages.set(555, makeTestPage(555));
    controller.refresh();
    expect(rowText(controller.view(), 1).trimEnd()).toBe('CONTENT OF 555');
  });
});

describe('fastext activation navigates (Req 2.3)', () => {
  it.each([
    ['red', 100],
    ['green', 101],
    ['yellow', 302],
    ['cyan', 888],
  ] as const)('%s link goes to %s', (color, target) => {
    const { controller } = setup();
    controller.navigate(302);
    controller.activateFastext(color);
    expect(controller.view().number).toBe(target);
  });

  it('follows the targets of the current page', () => {
    const { controller } = setup();
    controller.navigate(888);
    controller.activateFastext('red');
    expect(controller.view().number).toBe(101);
  });

  it('drops a partial entry when a fastext link is used', () => {
    const { controller } = setup();
    type(controller, '30');
    controller.activateFastext('green');
    expect(controller.entry).toBe('');
    expect(controller.view().number).toBe(101);
  });

  it('notifies onChange with the target page', () => {
    const { controller, onChange } = setup();
    controller.activateFastext('yellow');
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ number: 302 }));
  });
});

describe('refresh', () => {
  it('re-emits the current view with the latest lookup result', () => {
    const { controller, pages, onChange } = setup();
    pages.set(100, makeTestPage(100, [100, 101, 302, 888], true));
    controller.refresh();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ stale: true }));
  });
});
