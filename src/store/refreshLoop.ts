import type { Page } from '../model';
import type { PageStore } from './pageStore';

/**
 * Default refresh period: 15 minutes. Keeps a free-tier news key (100 requests
 * a day) within its quota; Open-Meteo has no practical limit at this rate.
 */
export const DEFAULT_REFRESH_INTERVAL_MS = 15 * 60 * 1000;

/** Anything that produces a page on demand, e.g. the news and weather sources. */
export interface PageSource {
  refresh(): Promise<Page>;
}

/** Injectable timer, so tests control time. */
export interface Scheduler {
  setInterval(callback: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

const globalScheduler: Scheduler = {
  setInterval: (callback, ms) => globalThis.setInterval(callback, ms),
  clearInterval: (handle) => {
    globalThis.clearInterval(handle as ReturnType<typeof globalThis.setInterval>);
  },
};

export interface RefreshLoopOptions {
  store: Pick<PageStore, 'set'>;
  sources: readonly PageSource[];
  /** Defaults to DEFAULT_REFRESH_INTERVAL_MS; non-positive or non-finite values fall back to it. */
  intervalMs?: number;
  /** Defaults to the global timers. */
  scheduler?: Scheduler;
  /** Called when a source throws or rejects. The other sources are unaffected. */
  onError?: (error: unknown) => void;
}

export interface RefreshLoop {
  readonly running: boolean;
  /** Refreshes now, then every interval. Resolves when the first refresh is done. No-op if running. */
  start(): Promise<void>;
  stop(): void;
  /** Refreshes every source once and puts the pages through the store. Never rejects. */
  refreshNow(): Promise<void>;
}

export function createRefreshLoop(options: RefreshLoopOptions): RefreshLoop {
  const { store, sources, onError, scheduler = globalScheduler } = options;
  const intervalMs =
    options.intervalMs !== undefined && Number.isFinite(options.intervalMs) && options.intervalMs > 0
      ? options.intervalMs
      : DEFAULT_REFRESH_INTERVAL_MS;
  const inFlight = new Set<PageSource>();
  let handle: unknown;
  let running = false;

  async function refreshSource(source: PageSource): Promise<void> {
    if (inFlight.has(source)) return;
    inFlight.add(source);
    try {
      store.set(await source.refresh());
    } catch (error) {
      onError?.(error);
    } finally {
      inFlight.delete(source);
    }
  }

  const refreshNow = async (): Promise<void> => {
    await Promise.all(sources.map(refreshSource));
  };

  return {
    get running() {
      return running;
    },
    refreshNow,
    async start() {
      if (running) return;
      running = true;
      handle = scheduler.setInterval(() => {
        void refreshNow();
      }, intervalMs);
      await refreshNow();
    },
    stop() {
      if (!running) return;
      running = false;
      scheduler.clearInterval(handle);
      handle = undefined;
    },
  };
}
