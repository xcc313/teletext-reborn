import { COLS } from '../model';
import type { Page } from '../model';
import {
  CONTENT_ROWS,
  DEFAULT_SERVICE,
  buildPage,
  markStale,
  styledLines,
} from '../pipeline/buildPage';
import type { BodyLine } from '../pipeline/buildPage';
import { typeset } from '../pipeline/typeset';
import type { FetchLike } from './weather';

export const NEWS_PAGE_NUMBER = 101;

/** Longest summary of one headline, in teletext lines. */
export const MAX_HEADLINE_LINES = 2;

/** Headlines requested from the provider. */
const MAX_ARTICLES = 10;

/**
 * Where the bundled demo feed is served from (the file lives in public/).
 * Honors Vite's `base` setting.
 */
export const DEMO_FEED_URL = `${import.meta.env.BASE_URL}demo-news.json`;

const ELLIPSIS = '...';
const HIGH_SURROGATE = /[\uD800-\uDBFF]$/;

const LIVE_NOTE = 'LATEST HEADLINES';
const DEMO_NOTE = 'DEMO FEED - SAMPLE HEADLINES';

export interface NewsItem {
  title: string;
}

export class NewsParseError extends Error {
  constructor(message: string) {
    super(`Unexpected news response: ${message}`);
    this.name = 'NewsParseError';
  }
}

/**
 * Optional news provider key. Returns the trimmed key, or undefined when the
 * value is missing, blank, or not a string (which selects the demo feed).
 */
export function resolveNewsApiKey(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const key = raw.trim();
  return key === '' ? undefined : key;
}

/** GNews top-headlines request. The key is URL-encoded. */
export function buildNewsUrl(apiKey: string): string {
  const params = new URLSearchParams({
    category: 'general',
    lang: 'en',
    max: String(MAX_ARTICLES),
    apikey: apiKey,
  });
  return `https://gnews.io/api/v4/top-headlines?${params.toString()}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Collapses whitespace and control characters into single spaces. */
function normalizeTitle(title: string): string {
  return title.replace(/[\p{Cc}\s]+/gu, ' ').trim();
}

/** Keeps entries that have a non-blank string `title`; throws when none do. */
function extractItems(entries: readonly unknown[], where: string): NewsItem[] {
  const items: NewsItem[] = [];
  for (const entry of entries) {
    if (!isRecord(entry) || typeof entry['title'] !== 'string') continue;
    const title = normalizeTitle(entry['title']);
    if (title !== '') items.push({ title });
  }
  if (items.length === 0) throw new NewsParseError(`"${where}" has no headlines`);
  return items;
}

function entriesOf(payload: unknown, key: string): unknown[] {
  if (!isRecord(payload)) throw new NewsParseError('payload must be an object');
  const value = payload[key];
  if (!Array.isArray(value)) throw new NewsParseError(`"${key}" must be an array`);
  return value as unknown[];
}

/** Validates a GNews payload and extracts the headlines. */
export function parseNewsResponse(payload: unknown): NewsItem[] {
  return extractItems(entriesOf(payload, 'articles'), 'articles');
}

/** Validates the bundled demo feed (`{ "items": [{ "title": "..." }] }`). */
export function parseDemoFeed(payload: unknown): NewsItem[] {
  return extractItems(entriesOf(payload, 'items'), 'items');
}

async function getJson(fetchFn: FetchLike, url: string, label: string): Promise<unknown> {
  const response = await fetchFn(url);
  // Never include the URL: it carries the API key.
  if (!response.ok) throw new Error(`${label} request failed with HTTP ${response.status}`);
  return response.json();
}

/** Fetches and parses provider headlines. Rejects on any failure. */
export async function fetchHeadlines(fetchFn: FetchLike, apiKey: string): Promise<NewsItem[]> {
  return parseNewsResponse(await getJson(fetchFn, buildNewsUrl(apiKey), 'News'));
}

/** Loads the bundled demo feed from public/demo-news.json. Rejects on any failure. */
export async function loadDemoFeed(
  fetchFn: FetchLike = (url) => globalThis.fetch(url),
  url: string = DEMO_FEED_URL,
): Promise<NewsItem[]> {
  return parseDemoFeed(await getJson(fetchFn, url, 'Demo feed'));
}

/** Cuts a line to fit an ellipsis within COLS columns, preferring a word boundary. */
function ellipsize(line: string): string {
  const room = COLS - ELLIPSIS.length;
  let cut = line;
  if (line.length > room) {
    cut = line.slice(0, room);
    if (HIGH_SURROGATE.test(cut)) cut = cut.slice(0, -1);
    if (line[room] !== ' ') {
      const space = cut.lastIndexOf(' ');
      if (space > 0) cut = cut.slice(0, space);
    }
  }
  return `${cut.trimEnd()}${ELLIPSIS}`;
}

/**
 * Summarizes a headline into at most MAX_HEADLINE_LINES lines of at most 40
 * columns: whitespace is normalized, the text is word-wrapped, and anything
 * beyond the last allowed line is replaced by "...". Blank input gives [].
 */
export function summarizeHeadline(title: string): string[] {
  const lines = typeset(normalizeTitle(title));
  if (lines.length <= MAX_HEADLINE_LINES) return lines;
  const kept = lines.slice(0, MAX_HEADLINE_LINES);
  kept[MAX_HEADLINE_LINES - 1] = ellipsize(kept[MAX_HEADLINE_LINES - 1] ?? '');
  return kept;
}

export interface NewsPageOptions {
  /** `demo` pages are labelled as a demo feed. */
  mode: 'live' | 'demo';
  stale?: boolean;
  service?: string;
}

/**
 * Builds page 101. Headlines are shown whole, in order, separated by a blank
 * row, until the next one no longer fits in the content area. Pure; the result
 * passes validatePage.
 */
export function createNewsPage(
  items: readonly NewsItem[],
  now: Date,
  options: NewsPageOptions,
): Page {
  const { mode, stale = false, service = DEFAULT_SERVICE } = options;
  const body: BodyLine[] = [
    ...styledLines('NEWS HEADLINES', 'white', 'blue'),
    ...styledLines(mode === 'demo' ? DEMO_NOTE : LIVE_NOTE, 'cyan'),
    { text: '' },
  ];

  let shown = 0;
  for (const item of items) {
    const lines = summarizeHeadline(item.title);
    if (lines.length === 0) continue;
    const separator = shown === 0 ? 0 : 1;
    if (body.length + separator + lines.length > CONTENT_ROWS) break;
    if (separator === 1) body.push({ text: '' });
    for (const text of lines) body.push({ text, fg: 'white', bg: 'black' });
    shown++;
  }

  return buildPage({ number: NEWS_PAGE_NUMBER, now, body, service, stale });
}

/** Stale placeholder for page 101 when neither live nor demo headlines are available. */
export function createNewsUnavailablePage(now: Date, service: string = DEFAULT_SERVICE): Page {
  return buildPage({
    number: NEWS_PAGE_NUMBER,
    now,
    service,
    stale: true,
    body: [
      ...styledLines('NEWS HEADLINES', 'white', 'blue'),
      { text: '' },
      ...styledLines('NEWS UNAVAILABLE', 'yellow'),
      ...styledLines('WILL RETRY AUTOMATICALLY.'),
    ],
  });
}

export interface NewsSourceOptions {
  /** Network boundary; defaults to the global fetch. */
  fetch?: FetchLike;
  /** Provider key. Missing or blank selects the bundled demo feed. */
  apiKey?: string;
  /** Demo feed loader; defaults to fetching the bundled public/demo-news.json. */
  loadDemoFeed?: () => Promise<readonly NewsItem[]>;
  now?: () => Date;
  service?: string;
  /** Called with the reason whenever a refresh fails. */
  onError?: (error: unknown) => void;
}

export interface NewsSource {
  /** `live` when a provider key is configured, otherwise `demo`. */
  readonly mode: 'live' | 'demo';
  /** The most recent successfully generated page, if any. */
  readonly lastGood: Page | undefined;
  /**
   * Returns page 101.
   *
   * - no key: the bundled demo feed (fresh, labelled as a demo feed);
   * - key, fetch ok: live headlines;
   * - key, fetch failed: the last good page marked stale, or, if there is
   *   none yet, the demo feed marked stale;
   * - demo feed also unavailable: a stale "unavailable" page.
   */
  refresh(): Promise<Page>;
}

export function createNewsSource(options: NewsSourceOptions = {}): NewsSource {
  const fetchFn: FetchLike = options.fetch ?? ((url) => globalThis.fetch(url));
  const apiKey = resolveNewsApiKey(options.apiKey);
  const loadDemo = options.loadDemoFeed ?? (() => loadDemoFeed(fetchFn));
  const now = options.now ?? (() => new Date());
  const service = options.service ?? DEFAULT_SERVICE;
  let lastGood: Page | undefined;
  let demoItems: readonly NewsItem[] | undefined;

  async function demoPage(stale: boolean): Promise<Page> {
    try {
      demoItems ??= await loadDemo();
      const page = createNewsPage(demoItems, now(), { mode: 'demo', stale, service });
      // A stand-in for failed live data is not "good" content to fall back to.
      if (!stale) lastGood = page;
      return page;
    } catch (error) {
      options.onError?.(error);
      return lastGood === undefined ? createNewsUnavailablePage(now(), service) : markStale(lastGood);
    }
  }

  return {
    mode: apiKey === undefined ? 'demo' : 'live',
    get lastGood() {
      return lastGood;
    },
    async refresh() {
      if (apiKey === undefined) return demoPage(false);
      try {
        const items = await fetchHeadlines(fetchFn, apiKey);
        lastGood = createNewsPage(items, now(), { mode: 'live', service });
        return lastGood;
      } catch (error) {
        options.onError?.(error);
        return lastGood === undefined ? demoPage(true) : markStale(lastGood);
      }
    },
  };
}
