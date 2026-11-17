import { describe, expect, it } from 'vitest';
import { COLS, validatePage } from '../../src/model';
import type { Page, Row } from '../../src/model';
import {
  NEWS_PAGE_NUMBER,
  buildNewsUrl,
  createNewsPage,
  createNewsSource,
  fetchHeadlines,
  loadDemoFeed,
  parseDemoFeed,
  parseNewsResponse,
  resolveNewsApiKey,
  summarizeHeadline,
} from '../../src/connectors/news';
import type { NewsItem } from '../../src/connectors/news';
import type { FetchLike } from '../../src/connectors/weather';
import demoFeedFile from '../../public/demo-news.json';
import gnewsFixture from '../fixtures/gnews-top-headlines.json';

const NOW = new Date(2026, 10, 16, 9, 31);
const KEY = 'test-key-123';

function rowText(row: Row | undefined): string {
  return (row ?? []).map((cell) => cell.char).join('').trimEnd();
}

function pageText(page: Page): string {
  return page.rows.map(rowText).join('\n');
}

function okFetch(payload: unknown = gnewsFixture): FetchLike & { urls: string[] } {
  const urls: string[] = [];
  const fn = (url: string): Promise<Response> => {
    urls.push(url);
    return Promise.resolve(new Response(JSON.stringify(payload), { status: 200 }));
  };
  return Object.assign(fn, { urls });
}

const failingFetch: FetchLike = () => Promise.reject(new TypeError('network down'));

/** Serves the bundled public/demo-news.json the way the dev server would. */
const demoFetch: FetchLike = () =>
  Promise.resolve(new Response(JSON.stringify(demoFeedFile), { status: 200 }));

const demoItems = parseDemoFeed(demoFeedFile);
const loadDemo = (): Promise<readonly NewsItem[]> => Promise.resolve(demoItems);

describe('summarizeHeadline', () => {
  it('keeps a short headline on one line', () => {
    expect(summarizeHeadline('Local team wins cup')).toEqual(['Local team wins cup']);
  });

  it('wraps a medium headline over two lines of at most 40 columns', () => {
    const lines = summarizeHeadline('Council approves plan to reopen the old railway line to passengers');
    expect(lines).toEqual(['Council approves plan to reopen the old', 'railway line to passengers']);
  });

  it('collapses whitespace and control characters', () => {
    expect(summarizeHeadline('  Local   team\nwins \t cup\u0000final ')).toEqual(['Local team wins cup final']);
  });

  it('shortens a long headline to two lines ending in an ellipsis', () => {
    const lines = summarizeHeadline(
      'Tech firm unveils battery that charges in under five minutes, claiming a decade of useful life without any loss',
    );
    expect(lines).toHaveLength(2);
    expect(lines[1]?.endsWith('...')).toBe(true);
    expect(lines.every((line) => line.length <= COLS)).toBe(true);
  });

  it('truncates a single overlong word', () => {
    const lines = summarizeHeadline('x'.repeat(100));
    expect(lines.length).toBeLessThanOrEqual(2);
    expect(lines.every((line) => line.length <= COLS)).toBe(true);
  });

  it('returns no lines for a blank headline', () => {
    expect(summarizeHeadline('')).toEqual([]);
    expect(summarizeHeadline(' \n\t ')).toEqual([]);
  });
});

describe('buildNewsUrl', () => {
  it('targets the GNews top-headlines endpoint with the key encoded', () => {
    const url = new URL(buildNewsUrl('a b&c'));
    expect(url.origin + url.pathname).toBe('https://gnews.io/api/v4/top-headlines');
    expect(url.searchParams.get('apikey')).toBe('a b&c');
    expect(url.searchParams.get('lang')).toBe('en');
    expect(url.searchParams.get('max')).toBe('10');
  });
});

describe('resolveNewsApiKey', () => {
  it('returns a trimmed key', () => {
    expect(resolveNewsApiKey('  abc ')).toBe('abc');
  });

  it.each([undefined, '', '   ', null, 42])('treats %s as no key', (raw) => {
    expect(resolveNewsApiKey(raw)).toBeUndefined();
  });
});

describe('parseNewsResponse', () => {
  it('extracts normalizable titles and skips articles without one', () => {
    const items = parseNewsResponse(gnewsFixture);
    expect(items).toHaveLength(4);
    expect(items[0]).toEqual({ title: 'Council approves plan to reopen the old railway line to passengers' });
    expect(items[2]).toEqual({ title: 'Local team wins cup final' });
  });

  it.each([
    ['null', null],
    ['a string', 'nope'],
    ['missing articles', { totalArticles: 0 }],
    ['non-array articles', { articles: 'x' }],
    ['no usable titles', { articles: [{ title: '' }, { title: 5 }, null] }],
    ['an error body', { errors: ['Invalid API key'] }],
  ])('rejects %s', (_label, payload) => {
    expect(() => parseNewsResponse(payload)).toThrow();
  });
});

describe('fetchHeadlines', () => {
  it('requests the provider URL with the key and returns items', async () => {
    const fetchFn = okFetch();
    const items = await fetchHeadlines(fetchFn, KEY);
    expect(fetchFn.urls).toEqual([buildNewsUrl(KEY)]);
    expect(items).toHaveLength(4);
  });

  it('rejects on network failure, HTTP error status and invalid JSON', async () => {
    await expect(fetchHeadlines(failingFetch, KEY)).rejects.toThrow();
    const http403: FetchLike = () => Promise.resolve(new Response('no', { status: 403 }));
    await expect(fetchHeadlines(http403, KEY)).rejects.toThrow(/403/);
    const notJson: FetchLike = () => Promise.resolve(new Response('<html>', { status: 200 }));
    await expect(fetchHeadlines(notJson, KEY)).rejects.toThrow();
  });

  it('does not put the API key in error messages', async () => {
    const http401: FetchLike = () => Promise.resolve(new Response('no', { status: 401 }));
    await expect(fetchHeadlines(http401, KEY)).rejects.not.toThrow(KEY);
  });
});

describe('bundled demo feed (public/demo-news.json)', () => {
  it('parses into at least five headlines', () => {
    expect(demoItems.length).toBeGreaterThanOrEqual(5);
  });

  it('loads through loadDemoFeed from the default bundled URL', async () => {
    const urls: string[] = [];
    const items = await loadDemoFeed((url) => {
      urls.push(url);
      return demoFetch(url);
    });
    expect(urls).toEqual(['/demo-news.json']);
    expect(items).toEqual(demoItems);
  });

  it('rejects malformed demo feeds', async () => {
    expect(() => parseDemoFeed({ items: [] })).toThrow();
    expect(() => parseDemoFeed({ items: [{ title: 3 }] })).toThrow();
    expect(() => parseDemoFeed(null)).toThrow();
    const http404: FetchLike = () => Promise.resolve(new Response('', { status: 404 }));
    await expect(loadDemoFeed(http404)).rejects.toThrow(/404/);
  });
});

describe('createNewsPage', () => {
  const items = parseNewsResponse(gnewsFixture);
  const page = createNewsPage(items, NOW, { mode: 'live' });

  it('is page 101 and passes validatePage', () => {
    expect(page.number).toBe(NEWS_PAGE_NUMBER);
    expect(NEWS_PAGE_NUMBER).toBe(101);
    expect(page.stale).toBe(false);
    expect(validatePage(page)).toEqual({ valid: true, violations: [] });
  });

  it('has the standard header and fastext row', () => {
    expect(rowText(page.rows[0])).toBe('P101 TELETEXT REBORN 09:31');
    expect(rowText(page.rows[24])).toContain('INDEX');
    expect(page.fastext.map((l) => l.color)).toEqual(['red', 'green', 'yellow', 'cyan']);
  });

  it('shows summarized headlines, each line within 40 columns', () => {
    const text = pageText(page);
    expect(text).toContain('NEWS HEADLINES');
    expect(text).toContain('Council approves plan to reopen the old');
    expect(text).toContain('Local team wins cup final');
    for (const row of page.rows) expect(row).toHaveLength(COLS);
  });

  it('labels demo content as a demo feed and live content as not', () => {
    expect(pageText(createNewsPage(items, NOW, { mode: 'demo' }))).toContain('DEMO FEED');
    expect(pageText(page)).not.toContain('DEMO FEED');
  });

  it('marks the page stale on request', () => {
    const stale = createNewsPage(items, NOW, { mode: 'demo', stale: true });
    expect(stale.stale).toBe(true);
    expect(rowText(stale.rows[0])).toBe('P101 TELETEXT REBORN 09:31 STALE');
    expect(validatePage(stale).valid).toBe(true);
  });

  it('only shows whole headlines when there are more than fit', () => {
    const many: NewsItem[] = Array.from({ length: 40 }, (_, i) => ({ title: `Headline number ${i + 1} is here` }));
    const full = createNewsPage(many, NOW, { mode: 'live' });
    expect(validatePage(full).valid).toBe(true);
    const text = pageText(full);
    expect(text).toContain('Headline number 1 is here');
    expect(text).not.toContain('Headline number 40 is here');
  });

  it('never splits a headline across the end of the content area', () => {
    const twoLiners = Array.from({ length: 12 }, (_, i) => ({
      title: `Long headline ${i} that needs two lines to be shown in full on the screen`,
    }));
    const lines = pageText(createNewsPage(twoLiners, NOW, { mode: 'live' })).split('\n');
    const starts = lines.filter((l) => l.startsWith('Long headline')).length;
    const ends = lines.filter((l) => l.endsWith('on the screen')).length;
    expect(starts).toBeGreaterThan(0);
    expect(starts).toBeLessThan(12);
    expect(ends).toBe(starts);
  });
});

describe('createNewsSource: provider mode (API key configured)', () => {
  it('fetches from the provider and generates a fresh live page 101', async () => {
    const fetchFn = okFetch();
    const source = createNewsSource({ fetch: fetchFn, apiKey: KEY, now: () => NOW, loadDemoFeed: loadDemo });
    expect(source.mode).toBe('live');
    const page = await source.refresh();
    expect(fetchFn.urls).toEqual([buildNewsUrl(KEY)]);
    expect(page.number).toBe(101);
    expect(page.stale).toBe(false);
    expect(pageText(page)).toContain('Local team wins cup final');
    expect(pageText(page)).not.toContain('DEMO FEED');
    expect(validatePage(page).valid).toBe(true);
    expect(source.lastGood).toBe(page);
  });

  it('returns the last good page marked stale when a later fetch fails', async () => {
    let fail = false;
    const errors: unknown[] = [];
    const source = createNewsSource({
      fetch: (url) => (fail ? failingFetch(url) : okFetch()(url)),
      apiKey: KEY,
      now: () => NOW,
      loadDemoFeed: loadDemo,
      onError: (error) => errors.push(error),
    });
    const good = await source.refresh();
    fail = true;
    const stale = await source.refresh();

    expect(stale.stale).toBe(true);
    expect(rowText(stale.rows[0])).toBe('P101 TELETEXT REBORN 09:31 STALE');
    expect(stale.rows.slice(1)).toEqual(good.rows.slice(1));
    expect(validatePage(stale).valid).toBe(true);
    expect(errors).toHaveLength(1);
    expect(source.lastGood).toBe(good);
  });

  it('falls back to stale last-good on HTTP errors and malformed payloads', async () => {
    const responses: Response[] = [
      new Response(JSON.stringify(gnewsFixture), { status: 200 }),
      new Response('', { status: 503 }),
      new Response(JSON.stringify({ articles: [] }), { status: 200 }),
    ];
    const source = createNewsSource({
      fetch: () => Promise.resolve(responses.shift() ?? new Response('', { status: 500 })),
      apiKey: KEY,
      now: () => NOW,
      loadDemoFeed: loadDemo,
    });
    const good = await source.refresh();
    for (let i = 0; i < 2; i++) {
      const stale = await source.refresh();
      expect(stale.stale).toBe(true);
      expect(stale.rows.slice(1)).toEqual(good.rows.slice(1));
    }
  });

  it('becomes fresh again after a failed refresh is followed by a good one', async () => {
    const outcomes = [true, false, true];
    const source = createNewsSource({
      fetch: (url) => (outcomes.shift() ? okFetch()(url) : failingFetch(url)),
      apiKey: KEY,
      now: () => NOW,
      loadDemoFeed: loadDemo,
    });
    await source.refresh();
    expect((await source.refresh()).stale).toBe(true);
    expect((await source.refresh()).stale).toBe(false);
  });

  it('falls back to the stale-marked demo feed when the very first fetch fails', async () => {
    const errors: unknown[] = [];
    const source = createNewsSource({
      fetch: failingFetch,
      apiKey: KEY,
      now: () => NOW,
      loadDemoFeed: loadDemo,
      onError: (error) => errors.push(error),
    });
    const page = await source.refresh();
    expect(page.number).toBe(101);
    expect(page.stale).toBe(true);
    expect(pageText(page)).toContain('DEMO FEED');
    expect(pageText(page)).toContain(demoItems[0]?.title.slice(0, 30));
    expect(validatePage(page).valid).toBe(true);
    expect(source.lastGood).toBeUndefined();
    expect(errors).toHaveLength(1);
  });

  it('returns a stale "unavailable" page if both the provider and the demo feed fail', async () => {
    const source = createNewsSource({
      fetch: failingFetch,
      apiKey: KEY,
      now: () => NOW,
      loadDemoFeed: () => Promise.reject(new Error('demo missing')),
    });
    const page = await source.refresh();
    expect(page.stale).toBe(true);
    expect(pageText(page)).toContain('NEWS UNAVAILABLE');
    expect(validatePage(page).valid).toBe(true);
  });
});

describe('createNewsSource: demo mode (no API key)', () => {
  it.each([undefined, ''])('renders the bundled demo feed without any network call (key=%j)', async (apiKey) => {
    let calls = 0;
    const source = createNewsSource({
      fetch: (url) => {
        calls++;
        return okFetch()(url);
      },
      ...(apiKey === undefined ? {} : { apiKey }),
      now: () => NOW,
      loadDemoFeed: loadDemo,
    });
    expect(source.mode).toBe('demo');
    const page = await source.refresh();
    expect(calls).toBe(0);
    expect(page.number).toBe(101);
    expect(page.stale).toBe(false);
    expect(pageText(page)).toContain('DEMO FEED');
    expect(pageText(page)).toContain(demoItems[0]?.title.slice(0, 30));
    expect(validatePage(page).valid).toBe(true);
    expect(source.lastGood).toBe(page);
  });

  it('loads the default demo feed from the bundled URL through the injected fetch', async () => {
    const urls: string[] = [];
    const source = createNewsSource({
      fetch: (url) => {
        urls.push(url);
        return demoFetch(url);
      },
      now: () => NOW,
    });
    const page = await source.refresh();
    expect(urls).toEqual(['/demo-news.json']);
    expect(pageText(page)).toContain('DEMO FEED');
  });

  it('returns a stale "unavailable" page when the demo feed cannot be loaded', async () => {
    const errors: unknown[] = [];
    const source = createNewsSource({
      now: () => NOW,
      loadDemoFeed: () => Promise.reject(new Error('demo missing')),
      onError: (error) => errors.push(error),
    });
    const page = await source.refresh();
    expect(page.stale).toBe(true);
    expect(pageText(page)).toContain('NEWS UNAVAILABLE');
    expect(validatePage(page).valid).toBe(true);
    expect(errors).toHaveLength(1);
    expect(source.lastGood).toBeUndefined();
  });
});
