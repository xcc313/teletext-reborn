// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import type { App } from '../src/app';
import { parseWeatherLocation } from '../src/config';
import type { FetchLike } from '../src/connectors/weather';
import demoFeed from '../public/demo-news.json';
import gnews from './fixtures/gnews-top-headlines.json';
import meteo from './fixtures/open-meteo-london.json';

// Task 9: the whole app wired together, with only the network stubbed.
// Requirements: 1.x, 2.x, 3.x, 4.x, 5.x

const NOW = new Date(2026, 10, 16, 9, 0);

interface Stub {
  fetchFn: FetchLike;
  urls: string[];
}

/** Routes by URL. A route set to `null` fails like a dropped connection. */
function stubFetch(routes: { weather?: unknown | null; gnews?: unknown | null; demo?: unknown | null } = {}): Stub {
  const urls: string[] = [];
  const fetchFn: FetchLike = (url) => {
    urls.push(url);
    const route = url.includes('open-meteo')
      ? 'weather'
      : url.includes('gnews.io')
        ? 'gnews'
        : 'demo';
    const defaults = { weather: meteo, gnews, demo: demoFeed };
    const payload = route in routes ? routes[route] : defaults[route];
    if (payload === null) return Promise.reject(new TypeError('network down'));
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(payload) });
  };
  return { fetchFn, urls };
}

let root: HTMLElement;
let app: App | undefined;

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  root = document.getElementById('app') as HTMLElement;
});

afterEach(() => {
  app?.destroy();
  app = undefined;
});

const noTimers = { setInterval: () => 0, clearInterval: () => {} };

async function boot(options: Partial<Parameters<typeof createApp>[0]> = {}): Promise<App> {
  app = createApp({
    root,
    fetch: stubFetch().fetchFn,
    now: () => NOW,
    scheduler: noTimers,
    onError: () => {},
    ...options,
  });
  await app.ready;
  return app;
}

const rowTexts = (): string[] =>
  Array.from(root.querySelectorAll('.tt-row')).map((row) => row.textContent ?? '');
const screenText = (): string => rowTexts().join('\n');

const press = (key: string): void => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key }));
};
const type = (digits: string): void => {
  for (const digit of digits) press(digit);
};
const clickCell = (row: number, col: number): void => {
  root
    .querySelector<HTMLElement>(`.tt-cell[data-row="${row}"][data-col="${col}"]`)
    ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
};
const clickKey = (key: string): void => {
  root
    .querySelector<HTMLElement>(`.tt-key[data-key="${key}"]`)
    ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
};

describe('createApp', () => {
  it('boots to page 100 as a 40x25 grid', async () => {
    await boot();
    const rows = rowTexts();
    expect(rows).toHaveLength(25);
    expect(rows.every((row) => row.length === 40)).toBe(true);
    expect(rows[0]).toMatch(/^P100 TELETEXT REBORN 09:00/);
    expect(screenText()).toContain('INDEX');
  });

  it('typing 101 shows the news page (demo feed with no key)', async () => {
    await boot();
    type('101');
    expect(rowTexts()[0]).toMatch(/^P101 /);
    expect(screenText()).toContain('DEMO FEED');
    expect(screenText()).toContain('Teletext returns');
  });

  it('typing 302 shows the weather page for London by default', async () => {
    const { fetchFn, urls } = stubFetch();
    await boot({ fetch: fetchFn });
    type('302');
    expect(rowTexts()[0]).toMatch(/^P302 /);
    expect(screenText()).toContain('WEATHER - LONDON');
    expect(urls.some((u) => u.includes('latitude=51.5072'))).toBe(true);
  });

  it('typing 888 shows the about page in demo mode with the default location', async () => {
    await boot();
    type('888');
    expect(screenText()).toContain('DEMO FEED (NO API KEY SET)');
    expect(screenText()).toContain('LONDON (DEFAULT LOCATION)');
  });

  it('shows a not-found page for an unknown page and keeps navigating', async () => {
    await boot();
    type('777');
    expect(screenText()).toContain('PAGE NOT FOUND');
    expect(screenText()).toContain('PAGE 777 IS NOT ON AIR');
    type('100');
    expect(rowTexts()[0]).toMatch(/^P100 /);
  });

  it('ignores a first digit of 9, so 999 can never be entered', async () => {
    await boot();
    type('999');
    expect(app?.controller.currentNumber).toBe(100);
    expect(app?.controller.entry).toBe('');
  });

  it('shows the partial entry in the header while typing', async () => {
    await boot();
    type('30');
    expect(rowTexts()[0]?.endsWith('P30-')).toBe(true);
    press('Escape');
    expect(rowTexts()[0]?.endsWith('P30-')).toBe(false);
  });

  it('navigates when a fastext label is clicked', async () => {
    await boot();
    clickCell(24, 12); // second slot: green, NEWS
    expect(rowTexts()[0]).toMatch(/^P101 /);
    clickCell(24, 25); // third slot: yellow, WEATHER
    expect(rowTexts()[0]).toMatch(/^P302 /);
    clickCell(24, 3); // first slot: red, INDEX
    expect(rowTexts()[0]).toMatch(/^P100 /);
  });

  it('ignores clicks outside the fastext row', async () => {
    await boot();
    clickCell(5, 12);
    expect(rowTexts()[0]).toMatch(/^P100 /);
  });

  it('navigates with the colour keys on the keyboard', async () => {
    await boot();
    press('y');
    expect(rowTexts()[0]).toMatch(/^P302 /);
  });

  it('navigates with the on-screen keypad', async () => {
    await boot();
    clickKey('3');
    clickKey('0');
    expect(rowTexts()[0]?.endsWith('P30-')).toBe(true);
    clickKey('CLR');
    expect(rowTexts()[0]?.endsWith('P30-')).toBe(false);
    clickKey('3');
    clickKey('0');
    clickKey('2');
    expect(rowTexts()[0]).toMatch(/^P302 /);
  });

  it('shows a stale "unavailable" weather page when the weather fetch fails', async () => {
    await boot({ fetch: stubFetch({ weather: null }).fetchFn });
    type('302');
    expect(screenText()).toContain('WEATHER DATA UNAVAILABLE');
    expect(rowTexts()[0]).toContain('STALE');
    expect(rowTexts()).toHaveLength(25);
  });

  it('still serves every page when all network access fails', async () => {
    await boot({ fetch: stubFetch({ weather: null, gnews: null, demo: null }).fetchFn });
    expect(screenText()).toContain('INDEX');
    type('101');
    expect(screenText()).toContain('NEWS UNAVAILABLE');
    type('888');
    expect(screenText()).toContain('ABOUT TELETEXT REBORN');
  });

  it('uses the live news provider when a key is passed in the env', async () => {
    const { fetchFn, urls } = stubFetch();
    await boot({ fetch: fetchFn, env: { VITE_NEWS_API_KEY: 'test-key' } });
    type('101');
    expect(urls.some((u) => u.includes('gnews.io') && u.includes('apikey=test-key'))).toBe(true);
    expect(screenText()).toContain('LATEST HEADLINES');
    expect(screenText()).not.toContain('DEMO FEED');
  });

  it('uses the weather location from the env', async () => {
    const { fetchFn, urls } = stubFetch();
    await boot({
      fetch: fetchFn,
      env: {
        VITE_WEATHER_LATITUDE: '48.8566',
        VITE_WEATHER_LONGITUDE: '2.3522',
        VITE_WEATHER_NAME: 'Paris',
      },
    });
    type('302');
    expect(screenText()).toContain('WEATHER - PARIS');
    expect(urls.some((u) => u.includes('latitude=48.8566') && u.includes('longitude=2.3522'))).toBe(
      true,
    );
    type('888');
    expect(screenText()).toContain('PARIS (CONFIGURED)');
  });

  it('redraws the current page when a refresh brings new content', async () => {
    let tick: () => void = () => {};
    const scheduler = {
      setInterval: (callback: () => void) => {
        tick = callback;
        return 1;
      },
      clearInterval: () => {},
    };
    let temperature = 11;
    const fetchFn: FetchLike = (url) => {
      const payload = url.includes('open-meteo')
        ? { ...meteo, current: { ...meteo.current, temperature_2m: temperature } }
        : url.includes('gnews.io')
          ? gnews
          : demoFeed;
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(payload) });
    };
    await boot({ fetch: fetchFn, scheduler });
    type('302');
    expect(screenText()).toContain('TEMP 11C');

    temperature = 23;
    tick();
    await vi.waitFor(() => {
      expect(screenText()).toContain('TEMP 23C');
    });
  });

  it('shows a page that arrives after the viewer asked for it', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const slow: FetchLike = async (url) => {
      await gate;
      return stubFetch().fetchFn(url);
    };
    app = createApp({ root, fetch: slow, now: () => NOW, scheduler: noTimers, onError: () => {} });
    type('302');
    expect(screenText()).toContain('PAGE NOT FOUND');
    release();
    await app.ready;
    expect(screenText()).toContain('WEATHER - LONDON');
  });
});

describe('parseWeatherLocation', () => {
  it('returns undefined when nothing, or only one coordinate, is set', () => {
    expect(parseWeatherLocation({})).toBeUndefined();
    expect(parseWeatherLocation({ VITE_WEATHER_LATITUDE: '10', VITE_WEATHER_LONGITUDE: ' ' })).toBeUndefined();
    expect(parseWeatherLocation({ VITE_WEATHER_LATITUDE: 'abc', VITE_WEATHER_LONGITUDE: '10' })).toBeUndefined();
  });

  it('names an unnamed location by its coordinates', () => {
    expect(
      parseWeatherLocation({ VITE_WEATHER_LATITUDE: '10.5', VITE_WEATHER_LONGITUDE: '-20' }),
    ).toEqual({ name: '10.5, -20', latitude: 10.5, longitude: -20 });
  });
});
