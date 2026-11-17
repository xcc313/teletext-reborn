import { parseWeatherLocation } from './config';
import type { AppEnv } from './config';
import { createNewsSource } from './connectors/news';
import { createWeatherSource } from './connectors/weather';
import type { FetchLike } from './connectors/weather';
import type { Page } from './model';
import { attachKeyboard, createNavigationController } from './nav';
import type { NavigationController } from './nav';
import { FASTEXT_SLOT } from './pipeline/buildPage';
import { renderPage } from './renderer';
import {
  createAboutPage,
  createIndexPage,
  createPageStore,
  createRefreshLoop,
} from './store';
import type { PageStore, Scheduler } from './store';

export interface AppOptions {
  /** Element the app draws into. Its children are replaced. */
  root: HTMLElement;
  /** Network boundary for both connectors. Defaults to the global fetch. */
  fetch?: FetchLike;
  /** Optional configuration. With nothing set the app runs in demo mode. */
  env?: AppEnv;
  now?: () => Date;
  /** Timer for the refresh loop. Defaults to the global timers. */
  scheduler?: Scheduler;
  refreshIntervalMs?: number;
  /** Where keydown events are read from. Defaults to the root's document. */
  keyTarget?: EventTarget;
  /** Called when a refresh fails. Defaults to console.warn. */
  onError?: (error: unknown) => void;
}

export interface App {
  readonly controller: NavigationController;
  readonly store: PageStore;
  /** Resolves when the first refresh of pages 101 and 302 has finished. Never rejects. */
  readonly ready: Promise<void>;
  /** Stops refreshing and removes the event listeners. */
  destroy(): void;
}

const KEYPAD_LAYOUT = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLR', '0'] as const;
const FASTEXT_ROW = 24;

function defaultOnError(error: unknown): void {
  const reason = error instanceof Error ? error.message : String(error);
  console.warn(`Refresh failed: ${reason}`);
}

function buildKeypad(doc: Document): HTMLElement {
  const keypad = doc.createElement('div');
  keypad.className = 'tt-keypad';
  keypad.setAttribute('role', 'group');
  keypad.setAttribute('aria-label', 'Page number keypad');
  for (const label of KEYPAD_LAYOUT) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'tt-key';
    button.dataset['key'] = label;
    button.textContent = label;
    keypad.append(button);
  }
  return keypad;
}

/**
 * Wires the whole app into `root`: page store with pages 100 and 888, news and
 * weather sources on a refresh loop, navigation (keyboard, on-screen keypad,
 * fastext clicks) and the DOM renderer. Network, clock, timers and
 * configuration are all injectable.
 */
export function createApp(options: AppOptions): App {
  const { root, env = {}, onError = defaultOnError } = options;
  const now = options.now ?? (() => new Date());
  const doc = root.ownerDocument;
  const fetchFn: FetchLike = options.fetch ?? ((url) => globalThis.fetch(url));

  const news = createNewsSource({ fetch: fetchFn, apiKey: env.VITE_NEWS_API_KEY, now, onError });
  const weather = createWeatherSource({
    fetch: fetchFn,
    location: parseWeatherLocation(env),
    now,
    onError,
  });

  const store = createPageStore();
  store.set(createIndexPage(now()));
  store.set(createAboutPage(now(), { newsMode: news.mode, location: weather.location }));

  const screen = doc.createElement('div');
  screen.className = 'tt-screen';
  root.replaceChildren(screen, buildKeypad(doc));

  const draw = (page: Page): void => {
    renderPage(page, screen);
  };

  const controller = createNavigationController({ lookup: store.get, now, onChange: draw });
  draw(controller.view());

  // A refreshed or late-arriving page replaces what is on screen.
  const unsubscribe = store.subscribe((page) => {
    if (page.number === controller.currentNumber) controller.refresh();
  });

  const detachKeyboard = attachKeyboard(options.keyTarget ?? doc, controller);

  // Fastext row: each 10-column slot activates its link, whatever cell is clicked.
  const onScreenClick = (event: Event): void => {
    if (!(event.target instanceof Element)) return;
    const cell = event.target.closest<HTMLElement>('.tt-cell');
    if (cell?.dataset['row'] !== String(FASTEXT_ROW)) return;
    const slot = Math.floor(Number(cell.dataset['col']) / FASTEXT_SLOT);
    const link = controller.view().fastext[slot];
    if (link) controller.activateFastext(link.color);
  };
  screen.addEventListener('click', onScreenClick);

  const onKeypadClick = (event: Event): void => {
    if (!(event.target instanceof Element)) return;
    const key = event.target.closest<HTMLElement>('.tt-key')?.dataset['key'];
    if (key === undefined) return;
    if (key === 'CLR') controller.cancelEntry();
    else controller.pressKey(key);
  };
  const keypad = root.querySelector('.tt-keypad');
  keypad?.addEventListener('click', onKeypadClick);

  const loop = createRefreshLoop({
    store,
    sources: [news, weather],
    intervalMs: options.refreshIntervalMs,
    scheduler: options.scheduler,
    onError,
  });

  return {
    controller,
    store,
    ready: loop.start(),
    destroy() {
      loop.stop();
      unsubscribe();
      detachKeyboard();
      screen.removeEventListener('click', onScreenClick);
      keypad?.removeEventListener('click', onKeypadClick);
    },
  };
}
