import { describe, expect, it, vi } from 'vitest';
import { createPageStore, createRefreshLoop, DEFAULT_REFRESH_INTERVAL_MS } from '../../src/store';
import type { PageSource, Scheduler } from '../../src/store';
import type { Page } from '../../src/model';
import { makeTestPage } from '../nav/testPages';

// Task 8: refresh loop (requirement 3.2) with an injectable scheduler.

function fakeScheduler() {
  let callback: (() => void) | undefined;
  const scheduler: Scheduler & { tick(): void } = {
    setInterval: vi.fn((fn: () => void, _ms: number) => {
      callback = fn;
      return 'handle';
    }),
    clearInterval: vi.fn(() => {
      callback = undefined;
    }),
    tick() {
      callback?.();
    },
  };
  return scheduler;
}

/** Lets pending promise callbacks run. */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** Source whose pages carry a version in the content row (and a distinct generatedAt). */
function countingSource(number: number): PageSource & { calls: number } {
  const source = {
    calls: 0,
    refresh(): Promise<Page> {
      source.calls++;
      const page = makeTestPage(number);
      return Promise.resolve({ ...page, generatedAt: `call-${source.calls}` });
    },
  };
  return source;
}

describe('createRefreshLoop', () => {
  it('refreshes every source into the store as soon as it starts', async () => {
    const store = createPageStore();
    const news = countingSource(101);
    const weather = countingSource(302);
    const loop = createRefreshLoop({
      store,
      sources: [news, weather],
      scheduler: fakeScheduler(),
    });

    await loop.start();

    expect(store.get(101)?.generatedAt).toBe('call-1');
    expect(store.get(302)?.generatedAt).toBe('call-1');
  });

  it('regenerates the pages on every interval tick', async () => {
    const store = createPageStore();
    const news = countingSource(101);
    const scheduler = fakeScheduler();
    const loop = createRefreshLoop({
      store,
      sources: [news],
      intervalMs: 60_000,
      scheduler,
    });

    await loop.start();
    expect(scheduler.setInterval).toHaveBeenCalledTimes(1);
    expect(vi.mocked(scheduler.setInterval).mock.calls[0]?.[1]).toBe(60_000);

    scheduler.tick();
    await flush();
    expect(store.get(101)?.generatedAt).toBe('call-2');
    scheduler.tick();
    await flush();
    expect(store.get(101)?.generatedAt).toBe('call-3');
  });

  it('defaults to DEFAULT_REFRESH_INTERVAL_MS, also for unusable intervals', async () => {
    for (const intervalMs of [undefined, 0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const scheduler = fakeScheduler();
      const loop = createRefreshLoop({
        store: createPageStore(),
        sources: [],
        scheduler,
        ...(intervalMs === undefined ? {} : { intervalMs }),
      });
      await loop.start();
      expect(vi.mocked(scheduler.setInterval).mock.calls[0]?.[1]).toBe(DEFAULT_REFRESH_INTERVAL_MS);
    }
  });

  it('stops ticking after stop(), and can be started again', async () => {
    const store = createPageStore();
    const news = countingSource(101);
    const scheduler = fakeScheduler();
    const loop = createRefreshLoop({ store, sources: [news], scheduler });

    await loop.start();
    expect(loop.running).toBe(true);
    loop.stop();
    expect(loop.running).toBe(false);
    expect(scheduler.clearInterval).toHaveBeenCalledWith('handle');

    scheduler.tick();
    await flush();
    expect(news.calls).toBe(1);

    await loop.start();
    expect(news.calls).toBe(2);
    expect(scheduler.setInterval).toHaveBeenCalledTimes(2);
  });

  it('does not schedule a second timer when started twice', async () => {
    const scheduler = fakeScheduler();
    const news = countingSource(101);
    const loop = createRefreshLoop({ store: createPageStore(), sources: [news], scheduler });
    await loop.start();
    await loop.start();
    expect(scheduler.setInterval).toHaveBeenCalledTimes(1);
    expect(news.calls).toBe(1);
  });

  it('reports a failing source and still refreshes the others', async () => {
    const store = createPageStore();
    const onError = vi.fn();
    const boom = new Error('boom');
    const failing: PageSource = { refresh: () => Promise.reject(boom) };
    const throwing: PageSource = {
      refresh: () => {
        throw boom;
      },
    };
    const loop = createRefreshLoop({
      store,
      sources: [failing, throwing, countingSource(302)],
      scheduler: fakeScheduler(),
      onError,
    });

    await expect(loop.refreshNow()).resolves.toBeUndefined();

    expect(onError).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledWith(boom);
    expect(store.get(302)).toBeDefined();
  });

  it('keeps the previous page when a source produces an invalid one', async () => {
    const onReject = vi.fn();
    const store = createPageStore({ onReject });
    const good = makeTestPage(101);
    let next: Page = good;
    const source: PageSource = { refresh: () => Promise.resolve(next) };
    const loop = createRefreshLoop({ store, sources: [source], scheduler: fakeScheduler() });

    await loop.refreshNow();
    next = { ...good, rows: good.rows.slice(0, 10) };
    await loop.refreshNow();

    expect(store.get(101)).toEqual(good);
    expect(onReject).toHaveBeenCalledTimes(1);
  });

  it('skips a source that is still refreshing when the next tick arrives', async () => {
    let release: (page: Page) => void = () => {};
    const slow = {
      calls: 0,
      refresh(): Promise<Page> {
        slow.calls++;
        return new Promise<Page>((resolve) => {
          release = resolve;
        });
      },
    };
    const store = createPageStore();
    const scheduler = fakeScheduler();
    const loop = createRefreshLoop({ store, sources: [slow], scheduler });

    const first = loop.start();
    scheduler.tick();
    await flush();
    expect(slow.calls).toBe(1);

    release(makeTestPage(101));
    await first;
    expect(store.get(101)).toBeDefined();

    scheduler.tick();
    await flush();
    expect(slow.calls).toBe(2);
  });

  it('uses the global timers by default', async () => {
    vi.useFakeTimers();
    try {
      const news = countingSource(101);
      const loop = createRefreshLoop({
        store: createPageStore(),
        sources: [news],
        intervalMs: 1000,
      });
      await loop.start();
      expect(news.calls).toBe(1);
      await vi.advanceTimersByTimeAsync(3000);
      expect(news.calls).toBe(4);
      loop.stop();
      await vi.advanceTimersByTimeAsync(3000);
      expect(news.calls).toBe(4);
    } finally {
      vi.useRealTimers();
    }
  });
});
