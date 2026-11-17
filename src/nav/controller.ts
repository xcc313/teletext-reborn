import { COLS } from '../model';
import type { Cell, FastextColor, Page, Row } from '../model';
import { formatEntry, pressKey } from './keypad';
import { createNotFoundPage } from './notFound';

export interface NavigationOptions {
  /** Page source, e.g. the page store. Called on every view(), so refreshed pages show up. */
  lookup: (number: number) => Page | undefined;
  /** Clock used for generated not-found pages. */
  now?: () => Date;
  /** Page shown first. Default 100. */
  initialPage?: number;
  /** Called with the new view after every state change and refresh(). */
  onChange?: (view: Page) => void;
}

export interface NavigationController {
  readonly currentNumber: number;
  /** Digits of a partially typed page number, '' when none. */
  readonly entry: string;
  /** The page to display: the current page, or a not-found page, with any partial entry in the header. */
  view(): Page;
  pressKey(key: string): void;
  activateFastext(color: FastextColor): void;
  navigate(number: number): void;
  cancelEntry(): void;
  refresh(): void;
}

const DEFAULT_PAGE = 100;

/** Header cell range that shows the partial entry (right-aligned, 4 cells). */
const ENTRY_COL = COLS - 4;

function withEntryInHeader(page: Page, entry: string): Page {
  const header: Row = (page.rows[0] ?? []).map((cell): Cell => ({ ...cell }));
  Array.from(formatEntry(entry)).forEach((char, i) => {
    header[ENTRY_COL + i] = { char, fg: 'white', bg: 'black' };
  });
  return { ...page, rows: [header, ...page.rows.slice(1)] };
}

export function createNavigationController(options: NavigationOptions): NavigationController {
  const { lookup, now = () => new Date(), onChange } = options;
  let currentNumber = options.initialPage ?? DEFAULT_PAGE;
  let entry = '';

  const view = (): Page => {
    const page = lookup(currentNumber) ?? createNotFoundPage(currentNumber, now());
    return entry === '' ? page : withEntryInHeader(page, entry);
  };

  const emit = (): void => {
    onChange?.(view());
  };

  const navigate = (number: number): void => {
    currentNumber = number;
    entry = '';
    emit();
  };

  return {
    get currentNumber() {
      return currentNumber;
    },
    get entry() {
      return entry;
    },
    view,
    pressKey(key) {
      const result = pressKey(entry, key);
      if (result.page !== undefined) {
        navigate(result.page);
      } else if (result.entry !== entry) {
        entry = result.entry;
        emit();
      }
    },
    activateFastext(color) {
      const link = view().fastext.find((l) => l.color === color);
      if (link) navigate(link.target);
    },
    navigate,
    cancelEntry() {
      if (entry === '') return;
      entry = '';
      emit();
    },
    refresh: emit,
  };
}
