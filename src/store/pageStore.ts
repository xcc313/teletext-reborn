import { validatePage } from '../model';
import type { Page, Violation } from '../model';

export interface PageRejection {
  /** The page number when the rejected value had a numeric one. */
  number: number | undefined;
  violations: Violation[];
}

export interface PageStoreOptions {
  /** Called for every rejected page. Defaults to logging each violation with console.warn. */
  onReject?: (rejection: PageRejection) => void;
}

export interface PageStore {
  /** The current page for a number. Safe to pass as a navigation `lookup`. */
  get(number: number): Page | undefined;
  /**
   * Validation gate: stores the page when it passes validatePage and returns
   * true. Otherwise reports the violations, keeps whatever page was stored
   * under that number, and returns false.
   */
  set(page: Page): boolean;
  /** Page numbers that currently have a page, in ascending order. */
  numbers(): number[];
  /** Listener is called with each accepted page. Returns an unsubscribe function. */
  subscribe(listener: (page: Page) => void): () => void;
}

function logRejection({ number, violations }: PageRejection): void {
  const label = number === undefined ? 'page' : `page ${number}`;
  for (const v of violations) {
    const where =
      (v.row === undefined ? '' : ` row ${v.row}`) + (v.col === undefined ? '' : ` col ${v.col}`);
    console.warn(`Rejected ${label}: [${v.rule}]${where}: ${v.message}`);
  }
}

export function createPageStore(options: PageStoreOptions = {}): PageStore {
  const onReject = options.onReject ?? logRejection;
  const pages = new Map<number, Page>();
  const listeners = new Set<(page: Page) => void>();

  return {
    get: (number) => pages.get(number),
    set(page) {
      const result = validatePage(page);
      if (!result.valid) {
        const number = (page as { number?: unknown } | null | undefined)?.number;
        onReject({
          number: typeof number === 'number' ? number : undefined,
          violations: result.violations,
        });
        return false;
      }
      pages.set(page.number, page);
      for (const listener of [...listeners]) listener(page);
      return true;
    },
    numbers: () => [...pages.keys()].sort((a, b) => a - b),
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
