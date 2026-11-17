import { afterEach, describe, expect, it, vi } from 'vitest';
import { createNavigationController } from '../../src/nav';
import { createNewsSource } from '../../src/connectors/news';
import { createWeatherSource } from '../../src/connectors/weather';
import type { FetchLike } from '../../src/connectors/weather';
import {
  createAboutPage,
  createIndexPage,
  createPageStore,
  createRefreshLoop,
} from '../../src/store';
import { DEFAULT_WEATHER_LOCATION } from '../../src/connectors/weather';
import gnews from '../fixtures/gnews-top-headlines.json';
import meteo from '../fixtures/open-meteo-london.json';

// Task 8: store + refresh loop + real connector sources, with only the network stubbed.

const INTERVAL = 15 * 60 * 1000;

afterEach(() => {
  vi.useRealTimers();
});

function routedFetch() {
  const urls: string[] = [];
  const fetchFn: FetchLike = (url) => {
    urls.push(url);
    const payload = url.includes('open-meteo') ? meteo : gnews;
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(payload) });
  };
  return { fetchFn, urls };
}

describe('store + refresh loop + connector sources', () => {
  it('regenerates pages 101 and 302 on every interval and serves them to navigation', async () => {
    vi.useFakeTimers({ now: new Date(2026, 10, 16, 9, 0) });
    const { fetchFn, urls } = routedFetch();
    const store = createPageStore();
    const news = createNewsSource({ fetch: fetchFn, apiKey: 'test-key' });
    const weather = createWeatherSource({ fetch: fetchFn });
    const loop = createRefreshLoop({
      store,
      sources: [news, weather],
      intervalMs: INTERVAL,
    });
    store.set(createIndexPage(new Date()));
    store.set(createAboutPage(new Date(), { newsMode: news.mode, location: weather.location }));

    await loop.start();
    const firstNews = store.get(101);
    const firstWeather = store.get(302);
    expect(firstNews?.generatedAt).toBe(new Date(2026, 10, 16, 9, 0).toISOString());
    expect(firstWeather?.number).toBe(302);
    expect(urls).toHaveLength(2);

    await vi.advanceTimersByTimeAsync(INTERVAL);

    expect(urls).toHaveLength(4);
    expect(store.get(101)?.generatedAt).toBe(new Date(2026, 10, 16, 9, 15).toISOString());
    expect(store.get(302)?.generatedAt).toBe(new Date(2026, 10, 16, 9, 15).toISOString());

    const controller = createNavigationController({ lookup: store.get });
    controller.navigate(302);
    expect(controller.view().number).toBe(302);
    controller.navigate(888);
    expect(controller.view().number).toBe(888);
    loop.stop();
  });

  it('keeps the last good page, marked stale, when a later refresh fails', async () => {
    vi.useFakeTimers({ now: new Date(2026, 10, 16, 9, 0) });
    let failing = false;
    const fetchFn: FetchLike = () =>
      failing
        ? Promise.reject(new TypeError('network down'))
        : Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(meteo) });
    const store = createPageStore();
    const weather = createWeatherSource({ fetch: fetchFn, location: DEFAULT_WEATHER_LOCATION });
    const loop = createRefreshLoop({ store, sources: [weather], intervalMs: INTERVAL });

    await loop.start();
    expect(store.get(302)?.stale).toBe(false);

    failing = true;
    await vi.advanceTimersByTimeAsync(INTERVAL);

    expect(store.get(302)?.stale).toBe(true);
    loop.stop();
  });

  it('serves the demo news feed through the store with no key configured', async () => {
    const store = createPageStore();
    const news = createNewsSource({
      loadDemoFeed: () => Promise.resolve([{ title: 'Sample headline' }]),
    });
    const loop = createRefreshLoop({ store, sources: [news], scheduler: { setInterval: () => 0, clearInterval: () => {} } });
    await loop.refreshNow();
    expect(store.get(101)?.rows.map((r) => r.map((c) => c.char).join('')).join('\n')).toContain(
      'DEMO FEED',
    );
  });
});
